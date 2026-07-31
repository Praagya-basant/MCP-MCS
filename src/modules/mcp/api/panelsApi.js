import { supabase, SAMPLE_IMAGES_BUCKET } from '@/shared/lib/supabaseClient';
import { sendNotification } from '@/shared/lib/notify';
import { shortenBuyerName } from '@/shared/utils/formatters';

const PANEL_SELECT = '*, buyer:buyers(id, name), hall:halls(id, hall_number, name)';

function mapPanel(panel) {
  return panel.buyer ? { ...panel, buyer: { ...panel.buyer, name: shortenBuyerName(panel.buyer.name) } } : panel;
}

export async function listPanels() {
  const { data, error } = await supabase.from('panels').select(PANEL_SELECT).order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(mapPanel);
}

export async function getPanel(id) {
  const { data, error } = await supabase.from('panels').select(PANEL_SELECT).eq('id', id).single();
  if (error) throw error;
  return mapPanel(data);
}

export async function createPanel({
  buyerId,
  hallId,
  panelCode,
  panelName,
  panelRef,
  panelFinish,
  finishRecipe,
  collectionName,
  isShared,
  imageUrl,
  signedBy,
  signedDate,
  validityMonths,
  expiryDate,
  dateAddedToHall,
}) {
  const { data, error } = await supabase
    .from('panels')
    .insert({
      buyer_id: buyerId,
      hall_id: hallId,
      panel_code: panelCode,
      panel_name: panelName,
      panel_ref: panelRef || null,
      panel_finish: panelFinish || null,
      finish_recipe: finishRecipe || null,
      collection_name: collectionName || null,
      is_shared: !!isShared,
      image_url: imageUrl || null,
      signed_by: signedBy || null,
      signed_date: signedDate || null,
      validity_months: validityMonths || null,
      expiry_date: expiryDate || null,
      date_added_to_hall: dateAddedToHall || null,
    })
    .select(PANEL_SELECT)
    .single();
  if (error) throw error;
  return mapPanel(data);
}

/**
 * Admin-only, via the retire_panel RPC (checks is_super_admin() and that
 * the panel isn't currently issued itself — see schema.sql section 14).
 * Archived, not deleted: only status + the retired_* columns change,
 * panel_movements history is untouched. `panel` (not just its id) is
 * required so the notification has panel_code/name/hall/buyer without a
 * second round trip.
 */
export async function retirePanel({ panel, reason }) {
  const { data, error } = await supabase.rpc('retire_panel', { p_panel_id: panel.id, p_reason: reason });
  if (error) throw error;

  sendNotification('panel_retired', {
    panelId: panel.id,
    panelCode: panel.panel_code,
    panelName: panel.panel_name,
    buyerId: panel.buyer_id,
    hallId: panel.hall_id,
    reason,
  });

  return mapPanel(data);
}

/**
 * Same public `sample-images` bucket MCS uses (see samplesApi.js /
 * movementsApi.js), under a `panels/` prefix — its RLS is bucket-scoped
 * (admin, hall_manager, or merchant), not path-scoped, so no new storage
 * policy is needed for a new module to share it.
 */
export async function uploadPanelImage(file) {
  const ext = file.name.split('.').pop();
  const path = `panels/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(SAMPLE_IMAGES_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(SAMPLE_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function sanitizePathSegment(value) {
  return String(value || '').trim().replace(/[^a-zA-Z0-9-_]+/g, '_') || 'unknown';
}

/**
 * Row-level "add/replace image" flow (Admin Panels' camera button, and
 * the merchant's own "Replace Image" action in the panel drawer) —
 * distinct from uploadPanelImage() above, which is only used by the hall
 * manager's Add Panel form. NOT available to hall_manager past that
 * initial upload — set_panel_image() (called below) only accepts admin
 * or the panel's own (or a shared panel's any) merchant, per the access
 * matrix. Path is deterministic — `panels/{buyer}/{panel_code}.ext` —
 * same reasoning as uploadAndSetSampleImage: re-uploading overwrites the
 * same object (`upsert: true`) instead of orphaning the old file.
 */
export async function uploadAndSetPanelImage({ panel, file }) {
  const ext = file.name.split('.').pop().toLowerCase();
  const folder = sanitizePathSegment(panel.buyer?.name);
  const path = `panels/${folder}/${panel.panel_code}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(SAMPLE_IMAGES_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  });
  if (uploadError) throw uploadError;

  const { data: pub } = supabase.storage.from(SAMPLE_IMAGES_BUCKET).getPublicUrl(path);
  const imageUrl = `${pub.publicUrl}?t=${Date.now()}`;

  const { data: updated, error } = await supabase.rpc('set_panel_image', {
    p_panel_id: panel.id,
    p_image_url: imageUrl,
  });
  if (error) throw error;

  return mapPanel({ ...panel, ...updated });
}
