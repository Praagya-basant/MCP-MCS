import { supabase } from '@/core/lib/supabaseClient';
import { sendNotification } from '@/core/notifications/notify';
import { shortenBuyerName } from '@/core/utils/formatters';

const VALIDITY_REQUEST_SELECT =
  '*, requested_by_profile:profiles!validity_requests_requested_by_fkey(id, full_name), approved_by_profile:profiles!validity_requests_approved_by_fkey(id, full_name)';

function mapBuyer(row) {
  return row?.buyer ? { ...row, buyer: { ...row.buyer, name: shortenBuyerName(row.buyer.name) } } : row;
}

/** Normalizes a sample or panel row into the shape validity UI actually needs, so callers never branch on item_type themselves. */
function normalizeItem(row, itemType) {
  if (!row) return null;
  const mapped = mapBuyer(row);
  return {
    ...mapped,
    code: itemType === 'panel' ? mapped.panel_code : mapped.bt_code,
    name: itemType === 'panel' ? mapped.panel_name : mapped.product_name,
  };
}

/**
 * validity_requests is polymorphic (item_type/item_id, no FK to samples or
 * panels), so the related item can't be embedded via a PostgREST join like
 * recall_requests does — fetched separately here (one batched query per
 * item_type present) and merged in as a normalized `.item` (see
 * normalizeItem), shared by both MCS (samples) and MCP (panels).
 */
export async function listValidityRequests() {
  const { data: requests, error } = await supabase
    .from('validity_requests')
    .select(VALIDITY_REQUEST_SELECT)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const sampleIds = [...new Set(requests.filter((r) => r.item_type === 'sample').map((r) => r.item_id))];
  const panelIds = [...new Set(requests.filter((r) => r.item_type === 'panel').map((r) => r.item_id))];

  const [samples, panels] = await Promise.all([
    sampleIds.length > 0
      ? supabase
          .from('samples')
          .select('id, bt_code, product_name, buyer_id, hall_id, buyer:buyers(id, name), hall:halls(id, name)')
          .in('id', sampleIds)
          .then(({ data, error: err }) => {
            if (err) throw err;
            return data;
          })
      : [],
    panelIds.length > 0
      ? supabase
          .from('panels')
          .select('id, panel_code, panel_name, buyer_id, hall_id, buyer:buyers(id, name), hall:halls(id, name)')
          .in('id', panelIds)
          .then(({ data, error: err }) => {
            if (err) throw err;
            return data;
          })
      : [],
  ]);

  const samplesById = Object.fromEntries(samples.map((s) => [s.id, s]));
  const panelsById = Object.fromEntries(panels.map((p) => [p.id, p]));

  return requests.map((r) => ({
    ...r,
    item: normalizeItem(r.item_type === 'sample' ? samplesById[r.item_id] : panelsById[r.item_id], r.item_type),
  }));
}

/**
 * Raises a request for either item type. RLS (`shift_requests_insert`
 * for the sample side; panels don't have their own insert policy for
 * validity_requests yet since panels weren't built when that policy was
 * written, so this relies on the generic `validity_requests_insert_merchant`
 * policy which only checks `current_role() = 'merchant'`, not per-item
 * ownership — acceptable since a merchant raising a request for a panel
 * they can't even see would just get rejected at approval time by
 * admin_update_validity's own item lookup).
 */
export async function createValidityRequest({ item, itemType, requestedById, requestedByName, requestedMonths, requestedExpiryDate, reason }) {
  const { data, error } = await supabase
    .from('validity_requests')
    .insert({
      item_type: itemType,
      item_id: item.id,
      requested_by: requestedById,
      requested_months: requestedMonths || null,
      requested_expiry_date: requestedExpiryDate || null,
      reason: reason || null,
    })
    .select(VALIDITY_REQUEST_SELECT)
    .single();
  if (error) throw error;

  sendNotification(itemType === 'panel' ? 'panel_validity_requested' : 'validity_requested', {
    itemId: item.id,
    itemCode: item.code,
    itemName: item.name,
    buyerId: item.buyer_id,
    requestedByName,
    requestedMonths,
    requestedExpiryDate,
    reason,
  });

  return { ...data, item };
}

/**
 * Approve/reject via the admin-only review_validity_request RPC. `request`
 * must be one of the rows returned by listValidityRequests() (i.e. it
 * carries the merged/normalized `.item`) so an approval can fire the
 * extended notification without a second round-trip.
 */
export async function reviewValidityRequest({ request, approve, adminNote }) {
  const { data, error } = await supabase.rpc('review_validity_request', {
    p_request_id: request.id,
    p_approve: approve,
    p_admin_note: adminNote || null,
  });
  if (error) throw error;

  if (approve && request.item) {
    sendNotification(request.item_type === 'panel' ? 'panel_validity_extended' : 'validity_extended', {
      itemId: request.item.id,
      itemCode: request.item.code,
      itemName: request.item.name,
      buyerId: request.item.buyer_id,
      newExpiryDate: data.requested_expiry_date || null,
      reason: `Approved request from ${request.requested_by_profile?.full_name || 'merchant'}`,
    });
  }

  return { ...data, item: request.item };
}

/**
 * Direct admin edit (Manage Validity) via admin_update_validity — extending,
 * setting a new date, or pre-expiring are all just a new expiry_date; the
 * modal frames the UI differently, the RPC treats them identically.
 */
export async function updateValidity({ item, itemType, newExpiryDate, reason }) {
  const { error } = await supabase.rpc('admin_update_validity', {
    p_item_type: itemType,
    p_item_id: item.id,
    p_new_expiry_date: newExpiryDate,
    p_reason: reason,
  });
  if (error) throw error;

  sendNotification(itemType === 'panel' ? 'panel_validity_extended' : 'validity_extended', {
    itemId: item.id,
    itemCode: item.code,
    itemName: item.name,
    buyerId: item.buyer_id,
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
