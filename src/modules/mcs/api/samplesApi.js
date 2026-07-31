import { supabase, SAMPLE_IMAGES_BUCKET } from '@/shared/lib/supabaseClient';
import { shortenBuyerName } from '@/shared/utils/formatters';

const SAMPLE_SELECT = '*, buyer:buyers(id, name), hall:halls(id, hall_number, name)';

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

export async function createSample({
  buyerId,
  hallId,
  btCode,
  productRef,
  productName,
  imageUrl,
  collectionName,
  signedBy,
  signedDate,
  validityMonths,
  expiryDate,
  dateAddedToHall,
}) {
  const { data, error } = await supabase
    .from('samples')
    .insert({
      buyer_id: buyerId,
      hall_id: hallId,
      bt_code: btCode,
      product_ref: productRef || null,
      product_name: productName,
      image_url: imageUrl || null,
      collection_name: collectionName || null,
      signed_by: signedBy || null,
      signed_date: signedDate || null,
      validity_months: validityMonths || null,
      expiry_date: expiryDate || null,
      date_added_to_hall: dateAddedToHall || null,
    })
    .select(SAMPLE_SELECT)
    .single();
  if (error) throw error;
  return mapSample(data);
}

/**
 * Bulk-inserts parsed Excel rows for the admin "Upload Samples" flow. Each
 * row carries its own resolved `hallId` (parsed from the file — see
 * UploadSamplesModal), not a single hall shared across the batch. Callers
 * should only pass rows that already validated (status "valid"); BT codes
 * already present in the DB — or repeated within the same file — are
 * still skipped here rather than sent to the insert, since `bt_code` is
 * unique and a single conflicting row would otherwise fail the whole
 * batch. Returns the inserted samples plus the rows that were skipped
 * (each tagged with why) so the caller can show both counts.
 */
export async function bulkImportSamples({ buyerId, rows }) {
  const seen = new Set();
  const withinFileDuplicates = [];
  const uniqueRows = [];

  for (const row of rows) {
    if (seen.has(row.btCode)) {
      withinFileDuplicates.push(row);
    } else {
      seen.add(row.btCode);
      uniqueRows.push(row);
    }
  }

  const { data: existing, error: existingErr } = await supabase
    .from('samples')
    .select('bt_code')
    .in('bt_code', uniqueRows.map((r) => r.btCode));
  if (existingErr) throw existingErr;

  const existingSet = new Set(existing.map((e) => e.bt_code));
  const toInsert = uniqueRows.filter((r) => !existingSet.has(r.btCode));
  const alreadyInDb = uniqueRows.filter((r) => existingSet.has(r.btCode));

  let inserted = [];
  if (toInsert.length > 0) {
    const { data, error: insertErr } = await supabase
      .from('samples')
      .insert(
        toInsert.map((r) => ({
          buyer_id: buyerId,
          hall_id: r.hallId,
          bt_code: r.btCode,
          product_ref: r.productRef || null,
          product_name: r.productName,
          image_url: null,
          status: 'in_hall',
        }))
      )
      .select(SAMPLE_SELECT);
    if (insertErr) throw insertErr;
    inserted = data.map(mapSample);
  }

  return {
    inserted,
    skipped: [...alreadyInDb, ...withinFileDuplicates],
  };
}

/**
 * Admin-only hall reassignment (Edit Sample Hall). Plain direct update —
 * `samples_update_admin` RLS already grants admins full UPDATE on
 * `samples`, so unlike checkout/return this doesn't need a SECURITY
 * DEFINER RPC.
 */
export async function updateSampleHall({ sampleId, hallId }) {
  const { data, error } = await supabase
    .from('samples')
    .update({ hall_id: hallId })
    .eq('id', sampleId)
    .select(SAMPLE_SELECT)
    .single();
  if (error) throw error;
  return mapSample(data);
}

/**
 * Permanently deletes a sample and its movement/recall/comment history.
 * There's no direct DELETE policy on any of those tables, so this goes
 * through the delete_sample() SECURITY DEFINER RPC (same pattern as
 * checkout_sample/return_sample), which also rejects the call server-side
 * if the sample is currently checked out.
 */
export async function deleteSample(sampleId) {
  const { error } = await supabase.rpc('delete_sample', { p_sample_id: sampleId });
  if (error) throw error;
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

function sanitizePathSegment(value) {
  return String(value || '').trim().replace(/[^a-zA-Z0-9-_]+/g, '_') || 'unknown';
}

/**
 * Row-level "add/replace image" flow (Admin & Hall Samples' camera
 * button) — distinct from uploadSampleImage() above, which is only used
 * by the Add Sample form. Path is deterministic — `{buyer}/{bt_code}.ext`
 * (e.g. `MDM/BT0069C.jpeg`) — rather than a random filename, specifically
 * so re-uploading for the same sample overwrites the same object
 * (`upsert: true`) instead of orphaning the old file in storage.
 */
export async function uploadAndSetSampleImage({ sample, file }) {
  const ext = file.name.split('.').pop().toLowerCase();
  const folder = sanitizePathSegment(sample.buyer?.name);
  const path = `${folder}/${sample.bt_code}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(SAMPLE_IMAGES_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  });
  if (uploadError) throw uploadError;

  const { data: pub } = supabase.storage.from(SAMPLE_IMAGES_BUCKET).getPublicUrl(path);
  // Same path can be re-uploaded with different content; the public URL
  // string itself wouldn't change, so append a cache-busting query param
  // to the value actually stored — otherwise browsers/CDNs that already
  // cached the old image at that URL would keep showing it.
  const imageUrl = `${pub.publicUrl}?t=${Date.now()}`;

  const { data: updated, error } = await supabase.rpc('set_sample_image', {
    p_sample_id: sample.id,
    p_image_url: imageUrl,
  });
  if (error) throw error;

  return mapSample({ ...sample, ...updated });
}
