import { supabase, SAMPLE_IMAGES_BUCKET } from '@/shared/lib/supabaseClient';
import { shortenBuyerName } from '@/shared/utils/formatters';

const SAMPLE_SELECT = '*, buyer:buyers(id, name), hall:halls(id, hall_number)';

function mapSample(sample) {
  return sample.buyer ? { ...sample, buyer: { ...sample.buyer, name: shortenBuyerName(sample.buyer.name) } } : sample;
}

export async function listSamples() {
  const { data, error } = await supabase
    .from('samples')
    .select(SAMPLE_SELECT)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(mapSample);
}

export async function getSample(id) {
  const { data, error } = await supabase.from('samples').select(SAMPLE_SELECT).eq('id', id).single();
  if (error) throw error;
  return mapSample(data);
}

/**
 * Used by the /sample/:btCode email deep link. `maybeSingle` (not
 * `single`) so a missing or RLS-blocked BT code resolves to `null`
 * instead of throwing — the caller shows a "not found" state either way,
 * which also keeps this from leaking whether a code exists outside the
 * viewer's scope.
 */
export async function getSampleByBtCode(btCode) {
  const { data, error } = await supabase.from('samples').select(SAMPLE_SELECT).eq('bt_code', btCode).maybeSingle();
  if (error) throw error;
  return data ? mapSample(data) : null;
}

export async function createSample({ buyerId, hallId, btCode, productRef, productName, imageUrl }) {
  const { data, error } = await supabase
    .from('samples')
    .insert({
      buyer_id: buyerId,
      hall_id: hallId,
      bt_code: btCode,
      product_ref: productRef || null,
      product_name: productName,
      image_url: imageUrl || null,
    })
    .select(SAMPLE_SELECT)
    .single();
  if (error) throw error;
  return mapSample(data);
}

/**
 * Uploads to the public `sample-images` bucket and returns the public URL
 * to store on the sample row (see schema.sql storage policies).
 */
export async function uploadSampleImage(file) {
  const ext = file.name.split('.').pop();
  const path = `${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(SAMPLE_IMAGES_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(SAMPLE_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
