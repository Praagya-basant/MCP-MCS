import { supabase, SAMPLE_IMAGES_BUCKET } from '@/shared/lib/supabaseClient';
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
 * panel_movements history is untouched.
 */
export async function retirePanel({ panelId, reason }) {
  const { data, error } = await supabase.rpc('retire_panel', { p_panel_id: panelId, p_reason: reason });
  if (error) throw error;
  return mapPanel(data);
}

/**
 * Same public `sample-images` bucket MCS uses (see samplesApi.js /
 * movementsApi.js), under a `panels/` prefix — its RLS is bucket-scoped
 * (admin OR hall_manager), not path-scoped, so no new storage policy is
 * needed for a new module to share it.
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
