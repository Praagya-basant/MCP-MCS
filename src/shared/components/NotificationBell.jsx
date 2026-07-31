import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/shared/utils/cn';
import { useAuth } from '@/shared/context/AuthContext';
import { IconBell } from '@/shared/components/icons';
import {
  listNotifications,
  countUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/shared/lib/notificationsApi';
import { formatRelativeTime } from '@/shared/utils/formatters';
import { ROLES } from '@/shared/utils/constants';

const SAMPLES_ROUTE = {
  [ROLES.SUPER_ADMIN]: '/admin/samples',
  [ROLES.HALL_MANAGER]: '/hall/samples',
  [ROLES.MERCHANT]: '/merchant/samples',
};

const PANELS_ROUTE = {
  [ROLES.SUPER_ADMIN]: '/admin/mcp/panels',
  [ROLES.HALL_MANAGER]: '/hall/mcp/panels',
  [ROLES.MERCHANT]: '/merchant/mcp/panels',
};

// No realtime subscription (this codebase doesn't use Supabase Realtime
// anywhere yet — every other list uses explicit refetch-after-action, see
// useAsyncData). A light poll keeps the unread badge from feeling static
// without introducing a new architectural pattern for one component.
const POLL_INTERVAL_MS = 45000;

/**
 * Bell + unread badge + dropdown panel, used in both Topbar variants
 * (desktop row and the mobile top bar). The notification list itself is
 * only fetched the first time the dropdown opens, not on mount, so every
 * logged-in session isn't paying for it up front.
 */
export function NotificationBell({ className }) {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  const refreshCount = useCallback(() => {
    countUnreadNotifications()
      .then(setUnreadCount)
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshCount();
    const interval = setInterval(refreshCount, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refreshCount]);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Mounted-vs-visible so the panel animates closed instead of vanishing
  // instantly — same pattern as Topbar's account dropdown / Modal / Drawer.
  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setVisible(true));
      if (items === null) {
        setLoading(true);
        listNotifications()
          .then(setItems)
          .finally(() => setLoading(false));
      }
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
    const timer = setTimeout(() => setMounted(false), 150);
    return () => clearTimeout(timer);
  }, [open, items]);

  async function handleMarkAllRead() {
    setUnreadCount(0);
    setItems((prev) => (prev || []).map((n) => ({ ...n, is_read: true })));
    try {
      await markAllNotificationsRead();
    } catch {
      refreshCount();
    }
  }

  function handleClickNotification(n) {
    if (!n.is_read) {
      setItems((prev) => (prev || []).map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
      markNotificationRead(n.id).catch(() => {});
    }
    setOpen(false);
    if (n.item_type === 'sample' && n.item_id) {
      navigate(SAMPLES_ROUTE[role] || '/', { state: { openSampleId: n.item_id } });
    } else if (n.item_type === 'panel' && n.item_id) {
      navigate(PANELS_ROUTE[role] || '/', { state: { openPanelId: n.item_id } });
    }
  }

  return (
    <div className={cn('relative', className)} ref={ref}>
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
        className="interactive relative w-9 h-9 flex items-center justify-center rounded-control text-ink-secondary hover:bg-surface-subtle hover:text-ink"
      >
        <IconBell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-status-checked-out-text text-white text-[10px] font-medium flex items-center justify-center select-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {mounted && (
        <div
          className={cn(
            'absolute right-0 mt-1.5 w-80 max-w-[90vw] bg-white border border-border rounded-lg shadow-lg origin-top-right transition-all duration-150 ease-out flex flex-col max-h-[70vh] z-20',
            visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          )}
        >
          <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
            <span className="text-body font-medium text-ink">Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="interactive text-caption text-ink-secondary hover:text-ink"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="overflow-y-auto scrollbar-thin">
            {loading ? (
              <div className="px-4 py-6 text-center text-caption text-ink-muted">Loading...</div>
            ) : !items || items.length === 0 ? (
              <div className="px-4 py-6 text-center text-caption text-ink-muted">No notifications yet.</div>
            ) : (
              <ul>
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleClickNotification(n)}
                      className="interactive w-full text-left px-4 py-3 border-b border-border last:border-b-0 hover:bg-surface-subtle flex gap-2.5"
                    >
                      <span
                        className={cn(
                          'mt-1.5 w-1.5 h-1.5 rounded-full shrink-0',
                          n.is_read ? 'bg-transparent' : 'bg-status-checked-out-text'
                        )}
                      />
                      <div className="min-w-0">
                        <p className="text-caption font-medium text-ink truncate">{n.title}</p>
                        <p className="mt-0.5 text-caption text-ink-secondary line-clamp-2">{n.message}</p>
                        <p className="mt-1 text-[11px] text-ink-muted">{formatRelativeTime(n.created_at)}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
