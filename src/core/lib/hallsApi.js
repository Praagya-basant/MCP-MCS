import { supabase } from '@/core/lib/supabaseClient';

export async function listHalls() {
  const { data, error } = await supabase.from('halls').select('*').order('hall_number');
  if (error) throw error;
  return data;
}

/**
 * Halls joined with their assigned manager + sample count, for the
 * Admin /admin/halls table.
 */
/**
 * Admin "Add Hall" — the UI only asks for a name, but `hall_number` is
 * `not null unique`, so it's auto-assigned as the next free number
 * rather than surfaced as a field. `halls_write_admin` RLS already
 * grants admins full CRUD on `halls`, so no new RPC is needed.
 */
export async function createHall({ name }) {
  const { data: existing, error: fetchErr } = await supabase.from('halls').select('hall_number');
  if (fetchErr) throw fetchErr;
  const nextNumber = existing.reduce((max, h) => Math.max(max, h.hall_number || 0), 0) + 1;

  const { data, error } = await supabase.from('halls').insert({ name, hall_number: nextNumber }).select().single();
  if (error) throw error;
  return data;
}

export async function renameHall({ id, name }) {
  const { data, error } = await supabase.from('halls').update({ name }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function listHallsWithDetails() {
  const [{ data: halls, error: hallsErr }, { data: managers, error: managersErr }, { data: samples, error: samplesErr }] =
    await Promise.all([
      supabase.from('halls').select('*').order('hall_number'),
      supabase.from('profiles').select('id, full_name, email, hall_id').eq('role', 'hall_manager'),
      supabase.from('samples').select('hall_id'),
    ]);

  if (hallsErr) throw hallsErr;
  if (managersErr) throw managersErr;
  if (samplesErr) throw samplesErr;

  return halls.map((hall) => ({
    ...hall,
    managers: managers.filter((m) => m.hall_id === hall.id),
    sampleCount: samples.filter((s) => s.hall_id === hall.id).length,
  }));
}
