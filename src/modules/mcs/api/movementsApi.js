import { supabase } from '@/shared/lib/supabaseClient';
import { sendNotification } from '@/shared/lib/notify';

const MOVEMENT_SELECT =
  '*, sample:samples(id, bt_code, product_name, buyer_id, hall_id, buyer:buyers(id, name), hall:halls(id, hall_number))';

export async function listMovements() {
  const { data, error } = await supabase
    .from('movements')
    .select(MOVEMENT_SELECT)
    .order('picked_at', { ascending: false });
  if (error) throw error;
  return data;
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
  return data;
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
 * Logs a checkout via the atomic `checkout_sample` RPC (updates
 * samples.status + inserts the movement row in one transaction), then
 * fires the two checkout emails. Returns the full sample+movement info
 * needed by the caller to update its local state / show a toast.
 */
export async function checkoutSample({
  sample,
  pickedByName,
  pickedByEmail,
  destination,
  reason,
  reasonOther,
  notes,
  loggedByName,
}) {
  const { data: movement, error } = await supabase.rpc('checkout_sample', {
    p_sample_id: sample.id,
    p_picked_by_name: pickedByName,
    p_picked_by_email: pickedByEmail,
    p_destination: destination,
    p_reason: reason,
    p_reason_other: reasonOther || null,
    p_notes: notes || null,
  });

  if (error) throw error;

  await sendNotification('checkout', {
    btCode: sample.bt_code,
    productName: sample.product_name,
    hallNumber: sample.hall?.hall_number,
    buyerId: sample.buyer_id,
    pickedByName,
    pickedByEmail,
    destination,
    reason: reason === 'Other' ? reasonOther : reason,
    pickedAt: movement.picked_at,
    loggedByName,
  });

  return movement;
}

/**
 * Confirms a return via the atomic `return_sample` RPC, then fires the
 * return email to the buyer's merchant contacts.
 */
export async function returnSample({ movement, sample }) {
  const { data: returned, error } = await supabase.rpc('return_sample', {
    p_movement_id: movement.id,
  });

  if (error) throw error;

  await sendNotification('return', {
    btCode: sample.bt_code,
    productName: sample.product_name,
    hallNumber: sample.hall?.hall_number,
    buyerId: sample.buyer_id,
    returnedAt: returned.returned_at,
  });

  return returned;
}
