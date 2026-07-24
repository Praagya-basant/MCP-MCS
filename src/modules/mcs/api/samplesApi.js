import { supabase, SAMPLE_IMAGES_BUCKET } from '@/shared/lib/supabaseClient';

const SAMPLE_SELECT = '*, buyer:buyers(id, name), hall:halls(id, hall_number)';

export async function listSamples() {
  const { data, error } = await supabase
    .from('samples')
    .select(SAMPLE_SELECT)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getSample(id) {
  const { data, error } = await supabase.from('samples').select(SAMPLE_SELECT).eq('id', id).single();
  if (error) throw error;
  return data;
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
  return data;
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
