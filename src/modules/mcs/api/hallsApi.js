import { supabase } from '@/shared/lib/supabaseClient';

export async function listHalls() {
  const { data, error } = await supabase.from('halls').select('*').order('hall_number');
  if (error) throw error;
  return data;
}

/**
 * Halls joined with their assigned manager + sample count, for the
 * Admin /admin/halls table.
 */
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
