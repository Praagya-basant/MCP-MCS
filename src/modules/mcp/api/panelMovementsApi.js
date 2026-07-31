import { supabase, SAMPLE_IMAGES_BUCKET } from '@/shared/lib/supabaseClient';
import { shortenBuyerName } from '@/shared/utils/formatters';

// Same public `sample-images` bucket MCS's movementsApi.js uses (its RLS
// is bucket-scoped, not path-scoped), under panel-movements/{id}/ so a
// panel's photo/signature never collides with a sample movement's even
// if both modules ever reused numeric-only ids (they don't — both are
// uuids — but the distinct prefix keeps the bucket's contents legible).
async function uploadPanelMovementFile(movementId, file, filename) {
  const path = `panel-movements/${movementId}/${filename}`;
  const { error } = await supabase.storage.from(SAMPLE_IMAGES_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(SAMPLE_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

const PANEL_MOVEMENT_WITH_HALLS_SELECT =
  '*, from_hall:halls!panel_movements_from_hall_id_fkey(id, name), destination_hall:halls!panel_movements_destination_hall_id_fkey(id, name)';

const PANEL_MOVEMENT_SELECT =
  '*, panel:panels(id, panel_code, panel_name, image_url, buyer_id, hall_id, buyer:buyers(id, name), hall:halls(id, hall_number, name))';

function mapPanelMovement(movement) {
  if (!movement?.panel?.buyer) return movement;
  return {
    ...movement,
    panel: { ...movement.panel, buyer: { ...movement.panel.buyer, name: shortenBuyerName(movement.panel.buyer.name) } },
  };
}

/**
 * All panel movements with the parent panel joined — used by the list
 * pages to compute each panel's open-hop / current-destination (only
 * panel_id/hop_number/status are read there, the rest of the join is
 * unused overhead in that path) and by the MCP dashboard's Top Movements
 * table (which does need the joined panel/buyer/hall).
 */
export async function listPanelMovements() {
  const { data, error } = await supabase
    .from('panel_movements')
    .select(PANEL_MOVEMENT_SELECT)
    .order('picked_at', { ascending: false });
  if (error) throw error;
  return data.map(mapPanelMovement);
}

export async function getOpenPanelMovement(panelId) {
  const { data, error } = await supabase
    .from('panel_movements')
    .select('*')
    .eq('panel_id', panelId)
    .eq('status', 'out')
    .order('picked_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listPanelMovementsForPanel(panelId) {
  const { data, error } = await supabase
    .from('panel_movements')
    .select(PANEL_MOVEMENT_WITH_HALLS_SELECT)
    .eq('panel_id', panelId)
    .order('picked_at', { ascending: false });
  if (error) throw error;
  return data;
}

/**
 * Mirrors samplesApi/movementsApi's issueSample() exactly — see that
 * file's doc comment for why the movement id is pre-generated. No
 * sendNotification() call here (unlike issueSample): panel movement
 * emails/in-app/push are deferred to a later pass, same scope cut as
 * retire and the MCP dashboard.
 */
export async function issuePanel({
  panel,
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
  const movementId = crypto.randomUUID();

  let photoUrl = null;
  if (photoFile) {
    const ext = photoFile.name?.split('.').pop()?.toLowerCase() || 'jpg';
    photoUrl = await uploadPanelMovementFile(movementId, photoFile, `photo.${ext}`);
  }

  let signatureUrl = null;
  if (signatureBlob) {
    signatureUrl = await uploadPanelMovementFile(movementId, signatureBlob, 'signature.png');
  }

  const { data: movement, error } = await supabase.rpc('checkout_panel', {
    p_panel_id: panel.id,
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
    p_movement_id: movementId,
  });

  if (error) throw error;
  return movement;
}

/** Mirrors movementsApi's forwardSample(). `movement` must be the panel's current open ('out') leg. */
export async function forwardPanel({
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
    photoUrl = await uploadPanelMovementFile(newMovementId, photoFile, `photo.${ext}`);
  }

  let signatureUrl = null;
  if (signatureBlob) {
    signatureUrl = await uploadPanelMovementFile(newMovementId, signatureBlob, 'signature.png');
  }

  const { data: newMovement, error } = await supabase.rpc('forward_panel', {
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
  return newMovement;
}

export async function returnPanel({ movement }) {
  const { data: returned, error } = await supabase.rpc('return_panel', { p_movement_id: movement.id });
  if (error) throw error;
  return returned;
}
