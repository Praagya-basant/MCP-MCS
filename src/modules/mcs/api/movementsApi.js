import { supabase, SAMPLE_IMAGES_BUCKET } from '@/shared/lib/supabaseClient';
import { sendNotification } from '@/shared/lib/notify';
import { shortenBuyerName } from '@/shared/utils/formatters';

/**
 * Photo/signature both land in the same public `sample-images` bucket
 * (no new bucket/RLS needed — its existing admin/hall-manager upload
 * policies already cover any path prefix, not just the sample-image
 * paths it was originally built for), under movements/{movementId}/ so
 * everything about one issue event lives together.
 */
async function uploadMovementFile(movementId, file, filename) {
  const path = `movements/${movementId}/${filename}`;
  const { error } = await supabase.storage.from(SAMPLE_IMAGES_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(SAMPLE_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

const MOVEMENT_SELECT =
  '*, sample:samples(id, bt_code, product_name, image_url, buyer_id, hall_id, buyer:buyers(id, name), hall:halls(id, hall_number, name)), logged_by_profile:profiles(id, full_name)';

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

// Only listMovementsForSample needs the from/destination hall names (the
// drawer's "From -> To" journey timeline) — listMovements()/
// getOpenMovementForSample() above stay on '*' since their callers only
// ever show the free-text `destination` column, not the resolved hall.
const MOVEMENT_WITH_HALLS_SELECT =
  '*, from_hall:halls!movements_from_hall_id_fkey(id, name), destination_hall:halls!movements_destination_hall_id_fkey(id, name)';

export async function listMovementsForSample(sampleId) {
  const { data, error } = await supabase
    .from('movements')
    .select(MOVEMENT_WITH_HALLS_SELECT)
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
 *
 * The movement id is generated here (not left to the RPC's default)
 * specifically so photo/signature can be uploaded to their final
 * movements/{id}/ path BEFORE the RPC call, letting the URLs be written
 * in the same insert instead of a follow-up update.
 */
export async function issueSample({
  sample,
  pickedByName,
  destination,
  reason,
  reasonOther,
  notes,
  loggedByName,
  photoFile,
  signatureBlob,
  purchaserName,
  supplierName,
}) {
  const movementId = crypto.randomUUID();

  let photoUrl = null;
  if (photoFile) {
    const ext = photoFile.name?.split('.').pop()?.toLowerCase() || 'jpg';
    photoUrl = await uploadMovementFile(movementId, photoFile, `photo.${ext}`);
  }

  let signatureUrl = null;
  if (signatureBlob) {
    signatureUrl = await uploadMovementFile(movementId, signatureBlob, 'signature.png');
  }

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
    p_photo_url: photoUrl,
    p_signature_url: signatureUrl,
    p_purchaser_name: purchaserName || null,
    p_supplier_name: supplierName || null,
    p_movement_id: movementId,
  });

  if (error) throw error;

  sendNotification('checkout', {
    sampleId: sample.id,
    btCode: sample.bt_code,
    productName: sample.product_name,
    hallName: sample.hall?.name,
    buyerId: sample.buyer_id,
    pickedByName,
    destination,
    reason: reason === 'Other' ? reasonOther : reason,
    pickedAt: movement.picked_at,
    loggedByName,
    photoUrl,
  });

  return movement;
}

/**
 * Forwards an already-checked-out sample onward to a new destination via
 * the atomic `forward_sample` RPC — closes the current active movement
 * leg and opens a new one in the same transaction (see schema.sql
 * section 9). `movement` must be the sample's current open ('out') leg.
 */
export async function forwardSample({
  sample,
  movement,
  pickedByName,
  destination,
  reason,
  reasonOther,
  notes,
  photoFile,
  signatureBlob,
  purchaserName,
  supplierName,
}) {
  const newMovementId = crypto.randomUUID();

  let photoUrl = null;
  if (photoFile) {
    const ext = photoFile.name?.split('.').pop()?.toLowerCase() || 'jpg';
    photoUrl = await uploadMovementFile(newMovementId, photoFile, `photo.${ext}`);
  }

  let signatureUrl = null;
  if (signatureBlob) {
    signatureUrl = await uploadMovementFile(newMovementId, signatureBlob, 'signature.png');
  }

  const { data: newMovement, error } = await supabase.rpc('forward_sample', {
    p_movement_id: movement.id,
    p_picked_by_name: pickedByName,
    p_picked_by_email: '',
    p_destination: destination,
    p_reason: reason,
    p_reason_other: reasonOther || null,
    p_notes: notes || null,
    p_photo_url: photoUrl,
    p_signature_url: signatureUrl,
    p_purchaser_name: purchaserName || null,
    p_supplier_name: supplierName || null,
    p_new_movement_id: newMovementId,
  });

  if (error) throw error;

  sendNotification('forward', {
    sampleId: sample.id,
    btCode: sample.bt_code,
    productName: sample.product_name,
    fromDestination: movement.destination,
    buyerId: sample.buyer_id,
    pickedByName,
    destination,
    reason: reason === 'Other' ? reasonOther : reason,
    pickedAt: newMovement.picked_at,
    photoUrl,
  });

  return newMovement;
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
    sampleId: sample.id,
    btCode: sample.bt_code,
    productName: sample.product_name,
    hallName: sample.hall?.name,
    hallId: sample.hall_id,
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
