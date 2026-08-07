import { supabase, SAMPLE_IMAGES_BUCKET } from '@/core/lib/supabaseClient';

/** Singleton row (id=true) — see app_settings in schema.sql. Readable by any authenticated user, writable by admin only. */
export async function getAppSettings() {
  const { data, error } = await supabase.from('app_settings').select('*').eq('id', true).single();
  if (error) throw error;
  return data;
}

export async function updateAppSettings(patch) {
  const { data, error } = await supabase
    .from('app_settings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', true)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Uploads to the same public bucket samples/panels already use, under a fixed `branding/` path so re-uploads overwrite instead of orphaning the old file. */
export async function uploadAppLogo(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const path = `branding/logo.${ext}`;
  const { error } = await supabase.storage.from(SAMPLE_IMAGES_BUCKET).upload(path, file, { cacheControl: '3600', upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(SAMPLE_IMAGES_BUCKET).getPublicUrl(path);
  const logoUrl = `${data.publicUrl}?t=${Date.now()}`;
  return updateAppSettings({ logo_url: logoUrl });
}

/**
 * Fires the configured Vercel deploy hook. Deploy hooks are plain POST
 * webhook URLs (no bearer token needed, unlike a full Vercel API
 * integration) — the client calling it directly is the standard way
 * they're meant to be used. Throws if none is configured.
 */
export async function triggerRedeploy(deployHookUrl) {
  if (!deployHookUrl) throw new Error('No deploy hook URL configured.');
  const res = await fetch(deployHookUrl, { method: 'POST' });
  if (!res.ok) throw new Error(`Deploy hook responded with ${res.status}`);
}
