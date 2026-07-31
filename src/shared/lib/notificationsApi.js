import { supabase } from '@/shared/lib/supabaseClient';

const NOTIFICATION_SELECT = '*';

/** RLS (`notifications_select_own`) already scopes this to the caller's own rows (or all, for admin). */
export async function listNotifications({ limit = 20 } = {}) {
  const { data, error } = await supabase
    .from('notifications')
    .select(NOTIFICATION_SELECT)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function countUnreadNotifications() {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false);
  if (error) throw error;
  return count || 0;
}

export async function markNotificationRead(id) {
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  if (error) throw error;
}

/**
 * Marks every currently-unread row in one round trip. `notifications_update_own`
 * RLS scopes this to the caller's own rows regardless of the `.neq` filter
 * (which just avoids a no-op update on rows already read).
 */
export async function markAllNotificationsRead() {
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
  if (error) throw error;
}
