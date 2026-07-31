import { supabase } from '@/shared/lib/supabaseClient';
import { ROLES } from '@/shared/utils/constants';

const NOTIFICATION_SELECT = '*';

const ITEM_ROUTES = {
  sample: {
    [ROLES.SUPER_ADMIN]: '/admin/samples',
    [ROLES.HALL_MANAGER]: '/hall/samples',
    [ROLES.MERCHANT]: '/merchant/samples',
  },
  panel: {
    [ROLES.SUPER_ADMIN]: '/admin/mcp/panels',
    [ROLES.HALL_MANAGER]: '/hall/mcp/panels',
    [ROLES.MERCHANT]: '/merchant/mcp/panels',
  },
};

/**
 * Where clicking a notification should navigate, keyed by the caller's
 * role and the notification's item_type — shared between NotificationBell
 * (dropdown) and the full /admin/notifications page so the two never
 * drift apart. Returns null for a type/role this app doesn't route
 * anywhere (or a notification with no item_id at all).
 */
export function getNotificationRoute(role, itemType, itemId) {
  if (!itemId) return null;
  const base = ITEM_ROUTES[itemType]?.[role];
  if (!base) return null;
  const stateKey = itemType === 'panel' ? 'openPanelId' : 'openSampleId';
  return { to: base, state: { [stateKey]: itemId } };
}

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
