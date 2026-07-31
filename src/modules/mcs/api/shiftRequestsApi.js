import { supabase } from '@/shared/lib/supabaseClient';
import { sendNotification } from '@/shared/lib/notify';
import { shortenBuyerName } from '@/shared/utils/formatters';

// from_hall_id/to_hall_id ARE real FKs (unlike validity_requests'
// item_id), so those embed directly via PostgREST. The sample itself is
// still polymorphic (item_type/item_id) and gets merged in separately,
// same pattern as validityApi.listValidityRequests().
const SHIFT_REQUEST_SELECT =
  '*, from_hall:halls!shift_requests_from_hall_id_fkey(id, name), to_hall:halls!shift_requests_to_hall_id_fkey(id, name), requested_by_profile:profiles!shift_requests_requested_by_fkey(id, full_name)';

function mapSample(sample) {
  return sample?.buyer ? { ...sample, buyer: { ...sample.buyer, name: shortenBuyerName(sample.buyer.name) } } : sample;
}

export async function listShiftRequests() {
  const { data: requests, error } = await supabase
    .from('shift_requests')
    .select(SHIFT_REQUEST_SELECT)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const sampleIds = [...new Set(requests.filter((r) => r.item_type === 'sample').map((r) => r.item_id))];
  let samplesById = {};
  if (sampleIds.length > 0) {
    const { data: samples, error: samplesErr } = await supabase
      .from('samples')
      .select('id, bt_code, product_name, buyer_id, hall_id, buyer:buyers(id, name)')
      .in('id', sampleIds);
    if (samplesErr) throw samplesErr;
    samplesById = Object.fromEntries(samples.map((s) => [s.id, mapSample(s)]));
  }

  return requests.map((r) => ({ ...r, sample: r.item_type === 'sample' ? samplesById[r.item_id] : null }));
}

/**
 * Raises a request for the current hall manager or the sample's own
 * merchant to move it to a different home hall — RLS
 * (`shift_requests_insert`) enforces both the hall/buyer entitlement and
 * that the sample is actually `in_hall` right now, so no RPC is needed
 * for this half (only the admin-approval half is, since that's the
 * transactional part).
 */
export async function createShiftRequest({ sample, toHallId, note, requestedById, requestedByName, requestedByRole }) {
  const { data, error } = await supabase
    .from('shift_requests')
    .insert({
      item_type: 'sample',
      item_id: sample.id,
      from_hall_id: sample.hall_id,
      to_hall_id: toHallId,
      requested_by: requestedById,
      note: note || null,
    })
    .select(SHIFT_REQUEST_SELECT)
    .single();
  if (error) throw error;

  sendNotification('shift_requested', {
    sampleId: sample.id,
    btCode: sample.bt_code,
    productName: sample.product_name,
    buyerId: sample.buyer_id,
    fromHallId: sample.hall_id,
    toHallId,
    note,
    requestedByName,
    requestedByRole,
    requestedById,
  });

  return { ...data, sample };
}

/**
 * Approve/reject via the admin-only review_shift_request RPC. `request`
 * must come from listShiftRequests() (carries the merged `.sample`) so
 * the decision notification doesn't need a second round-trip.
 */
export async function reviewShiftRequest({ request, approve, adminNote }) {
  const { data, error } = await supabase.rpc('review_shift_request', {
    p_request_id: request.id,
    p_approve: approve,
    p_admin_note: adminNote || null,
  });
  if (error) throw error;

  sendNotification('shift_decided', {
    sampleId: request.item_id,
    btCode: request.sample?.bt_code,
    productName: request.sample?.product_name,
    buyerId: request.sample?.buyer_id,
    fromHallId: request.from_hall_id,
    toHallId: request.to_hall_id,
    approved: approve,
    adminNote,
    requestedById: request.requested_by,
  });

  return { ...data, sample: request.sample };
}
