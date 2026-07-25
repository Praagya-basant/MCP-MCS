import { supabase } from '@/shared/lib/supabaseClient';
import { sendNotification } from '@/shared/lib/notify';
import { shortenBuyerName } from '@/shared/utils/formatters';

const MOVEMENT_SELECT =
  '*, sample:samples(id, bt_code, product_name, buyer_id, hall_id, buyer:buyers(id, name), hall:halls(id, hall_number))';

function mapMovement(movement) {
  if (!movement?.sample?.buyer) return movement;
  return {
    ...movement,
    sample: { ...movement.sample, buyer: { ...movement.sample.buyer, name: shortenBuyerName(movement.sample.buyer.name) } },
  };
}

export async function listMovements() {
  const { data, error } = await supabase
    .from('movements')
    .select(MOVEMENT_SELECT)
    .order('picked_at', { ascending: false });
  if (error) throw error;
  return data.map(mapMovement);
}

export async function getOpenMovementForSample(sampleId) {
  const { data, error } = await supabase
    .from('movements')
    .select(MOVEMENT_SELECT)
    .eq('sample_id', sampleId)
    .eq('status', 'out')
    .order('picked_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? mapMovement(data) : data;
}

export async function listMovementsForSample(sampleId) {
  const { data, error } = await supabase
    .from('movements')
    .select('*')
    .eq('sample_id', sampleId)
    .order('picked_at', { ascending: false });
  if (error) throw error;
  return data;
}

/**
 * Logs an issue via the atomic `checkout_sample` RPC (updates
 * samples.status + inserts the movement row in one transaction — the RPC
 * name matches the DB function, which we don't rename since schema.sql is
 * untouched). Email is intentionally NOT awaited: it must never delay the
 * UI response to a successful DB write, and `sendNotification` already
 * swallows its own errors so a failed send can't surface here either.
 */
export async function issueSample({
  sample,
  pickedByName,
  destination,
  reason,
  reasonOther,
  notes,
  loggedByName,
}) {
  const { data: movement, error } = await supabase.rpc('checkout_sample', {
    p_sample_id: sample.id,
    p_picked_by_name: pickedByName,
    // The app no longer collects a picker email, but the DB column is
    // NOT NULL (schema.sql is untouched) — an empty string satisfies
    // that constraint without needing a migration.
    p_picked_by_email: '',
    p_destination: destination,
    p_reason: reason,
    p_reason_other: reasonOther || null,
    p_notes: notes || null,
  });

  if (error) throw error;

  sendNotification('checkout', {
    btCode: sample.bt_code,
    productName: sample.product_name,
    hallNumber: sample.hall?.hall_number,
    buyerId: sample.buyer_id,
    pickedByName,
    destination,
    reason: reason === 'Other' ? reasonOther : reason,
    pickedAt: movement.picked_at,
    loggedByName,
  });

  return movement;
}

/**
 * Confirms a return via the atomic `return_sample` RPC. Same
 * fire-and-forget email treatment as issueSample above.
 */
export async function returnSample({ movement, sample }) {
  const { data: returned, error } = await supabase.rpc('return_sample', {
    p_movement_id: movement.id,
  });

  if (error) throw error;

  sendNotification('return', {
    btCode: sample.bt_code,
    productName: sample.product_name,
    hallNumber: sample.hall?.hall_number,
    buyerId: sample.buyer_id,
    returnedAt: returned.returned_at,
  });

  return returned;
}

/**
 * Wipes the entire movements audit trail — admin only, enforced inside
 * the `clear_movement_history` RPC itself (SECURITY DEFINER, checks
 * is_super_admin()). It also resets any currently-issued samples back to
 * 'in_hall' in the same transaction, so nothing is left stuck "Issued"
 * with no movement record to return against. Irreversible.
 */
export async function clearMovementHistory() {
  const { error } = await supabase.rpc('clear_movement_history');
  if (error) throw error;
}
