import { supabase } from '@/shared/lib/supabaseClient';
import { sendNotification } from '@/shared/lib/notify';
import { shortenBuyerName } from '@/shared/utils/formatters';

const VALIDITY_REQUEST_SELECT =
  '*, requested_by_profile:profiles!validity_requests_requested_by_fkey(id, full_name), approved_by_profile:profiles!validity_requests_approved_by_fkey(id, full_name)';

function mapSample(sample) {
  return sample?.buyer ? { ...sample, buyer: { ...sample.buyer, name: shortenBuyerName(sample.buyer.name) } } : sample;
}

/**
 * validity_requests is polymorphic (item_type/item_id, no FK to samples or
 * panels), so the related item can't be embedded via a PostgREST join like
 * recall_requests does — fetched separately here and merged in. Only
 * 'sample' requests exist until the MCP (panels) module lands.
 */
export async function listValidityRequests() {
  const { data: requests, error } = await supabase
    .from('validity_requests')
    .select(VALIDITY_REQUEST_SELECT)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const sampleIds = [...new Set(requests.filter((r) => r.item_type === 'sample').map((r) => r.item_id))];
  let samplesById = {};
  if (sampleIds.length > 0) {
    const { data: samples, error: samplesErr } = await supabase
      .from('samples')
      .select('id, bt_code, product_name, buyer_id, hall_id, buyer:buyers(id, name), hall:halls(id, name)')
      .in('id', sampleIds);
    if (samplesErr) throw samplesErr;
    samplesById = Object.fromEntries(samples.map((s) => [s.id, mapSample(s)]));
  }

  return requests.map((r) => ({ ...r, sample: r.item_type === 'sample' ? samplesById[r.item_id] : null }));
}

export async function createValidityRequest({ sample, requestedById, requestedByName, requestedMonths, requestedExpiryDate, reason }) {
  const { data, error } = await supabase
    .from('validity_requests')
    .insert({
      item_type: 'sample',
      item_id: sample.id,
      requested_by: requestedById,
      requested_months: requestedMonths || null,
      requested_expiry_date: requestedExpiryDate || null,
      reason: reason || null,
    })
    .select(VALIDITY_REQUEST_SELECT)
    .single();
  if (error) throw error;

  sendNotification('validity_requested', {
    sampleId: sample.id,
    btCode: sample.bt_code,
    productName: sample.product_name,
    requestedByName,
    requestedMonths,
    requestedExpiryDate,
    reason,
  });

  return { ...data, sample };
}

/**
 * Approve/reject via the admin-only review_validity_request RPC. `request`
 * must be one of the rows returned by listValidityRequests() (i.e. it
 * carries the merged `.sample`) so an approval can fire the
 * 'validity_extended' email without a second round-trip.
 */
export async function reviewValidityRequest({ request, approve, adminNote }) {
  const { data, error } = await supabase.rpc('review_validity_request', {
    p_request_id: request.id,
    p_approve: approve,
    p_admin_note: adminNote || null,
  });
  if (error) throw error;

  if (approve && request.sample) {
    sendNotification('validity_extended', {
      sampleId: request.sample.id,
      btCode: request.sample.bt_code,
      productName: request.sample.product_name,
      buyerId: request.sample.buyer_id,
      newExpiryDate: data.requested_expiry_date || null,
      reason: `Approved request from ${request.requested_by_profile?.full_name || 'merchant'}`,
    });
  }

  return { ...data, sample: request.sample };
}

/**
 * Direct admin edit (Manage Validity) via admin_update_validity — extending,
 * setting a new date, or pre-expiring are all just a new expiry_date; the
 * modal frames the UI differently, the RPC treats them identically.
 */
export async function updateValidity({ sample, newExpiryDate, reason }) {
  const { error } = await supabase.rpc('admin_update_validity', {
    p_item_type: 'sample',
    p_item_id: sample.id,
    p_new_expiry_date: newExpiryDate,
    p_reason: reason,
  });
  if (error) throw error;

  sendNotification('validity_extended', {
    sampleId: sample.id,
    btCode: sample.bt_code,
    productName: sample.product_name,
    buyerId: sample.buyer_id,
    newExpiryDate,
    reason,
  });
}

export async function listValidityChanges(itemId) {
  const { data, error } = await supabase
    .from('validity_changes')
    .select('*, changed_by_profile:profiles(id, full_name)')
    .eq('item_id', itemId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}
