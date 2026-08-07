import { supabase } from '@/core/lib/supabaseClient';
import { sendNotification } from '@/core/notifications/notify';

const FEEDBACK_SELECT = '*, sender:profiles(id, full_name, role)';

/** Admin-only — RLS (`feedback_select_admin`) restricts this to super_admin. */
export async function listFeedback() {
  const { data, error } = await supabase
    .from('feedback')
    .select(FEEDBACK_SELECT)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function countUnreadFeedback() {
  const { count, error } = await supabase
    .from('feedback')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false);
  if (error) throw error;
  return count || 0;
}

export async function markFeedbackRead(id) {
  const { data, error } = await supabase
    .from('feedback')
    .update({ is_read: true })
    .eq('id', id)
    .select(FEEDBACK_SELECT)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Manager/merchant "Send Feedback". Email is intentionally NOT awaited —
 * same fire-and-forget treatment as checkout/return/recall in
 * movementsApi/recallsApi — it must never delay the UI response to a
 * successful DB write, and sendNotification() already swallows its own
 * errors.
 */
export async function submitFeedback({ senderId, senderName, senderRole, subject, message }) {
  const { data, error } = await supabase
    .from('feedback')
    .insert({ sender_id: senderId, subject, message })
    .select(FEEDBACK_SELECT)
    .single();
  if (error) throw error;

  sendNotification('feedback', { subject, message, senderName, senderRole });

  return data;
}
