import { supabase } from '@/core/lib/supabaseClient';

export async function listComments(sampleId) {
  const { data, error } = await supabase
    .from('sample_comments')
    .select('*, author:profiles(id, full_name)')
    .eq('sample_id', sampleId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function addComment({ sampleId, authorId, comment }) {
  const { data, error } = await supabase
    .from('sample_comments')
    .insert({ sample_id: sampleId, author_id: authorId, comment })
    .select('*, author:profiles(id, full_name)')
    .single();
  if (error) throw error;
  return data;
}
