import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/shared/utils/cn';
import { useAuth } from '@/shared/context/AuthContext';
import { IconBell } from '@/shared/components/icons';
import {
  listNotifications,
  countUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getNotificationRoute,
} from '@/shared/lib/notificationsApi';
import { getNotificationMeta } from '@/shared/lib/notificationMeta';
import { formatRelativeTime, groupByDay } from '@/shared/utils/formatters';
import { ROLES } from '@/shared/utils/constants';

// No realtime subscription (this codebase doesn't use Supabase Realtime
// anywhere yet — every other list uses explicit refetch-after-action, see
// useAsyncData). A light poll keeps the unread badge from feeling static
// without introducing a new architectural pattern for one component.
const POLL_INTERVAL_MS = 45000;

const TONE_ICON_BG = {
  neutral: 'bg-surface-subtle text-ink-secondary',
  success: 'bg-status-in-hall-bg text-status-in-hall-text',
  warning: 'bg-status-checked-out-bg text-status-checked-out-text',
  info: 'bg-status-in-transit-bg text-status-in-transit-text',
  error: 'bg-status-expired-bg text-status-expired-text',
};

function NotificationRow({ n, onOpen, onSwipeRead }) {
  const { icon: Icon, tone } = getNotificationMeta(n.type);
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: 0.5, right: 0 }}
      onDragEnd={(e, info) => {
        if (info.offset.x < -80 && !n.is_read) onSwipeRead(n);
      }}
      className={cn('relative border-b border-border last:border-b-0', !n.is_read && 'bg-accent/[0.04]')}
    >
      {!n.is_read && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent" />}
      <button
        type="button"
        onClick={() => onOpen(n)}
        className="interactive w-full text-left pl-4 pr-3 py-3 hover:bg-surface-subtle flex gap-2.5"
      >
        <span className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0', TONE_ICON_BG[tone] || TONE_ICON_BG.neutral)}>
          <Icon className="w-4 h-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-caption font-medium text-ink truncate">{n.title}</p>
          <p className="mt-0.5 text-caption text-ink-secondary line-clamp-2">{n.message}</p>
        </div>
        <span className="text-[11px] text-ink-muted shrink-0 whitespace-nowrap">{formatRelativeTime(n.created_at)}</span>
      </button>
    </motion.li>
  );
}

/**
 * Bell + unread badge + panel, used in both Topbar variants (desktop row
 * and the mobile top bar). The notification list itself is only fetched
 * the first time the panel opens, not on mount, so every logged-in
 * session isn't paying for it up front. Mobile renders the panel as a
 * full-screen overlay (fixed inset-0); desktop as a 380px dropdown.
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

  function markRead(n) {
    if (n.is_read) return;
    setItems((prev) => (prev || []).map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    setUnreadCount((c) => Math.max(0, c - 1));
    markNotificationRead(n.id).catch(() => {});
  }

  function handleClickNotification(n) {
    markRead(n);
    setOpen(false);
    const route = getNotificationRoute(role, n.item_type, n.item_id);
    if (route) navigate(route.to, { state: route.state });
  }

  const groups = groupByDay(items || [], (n) => n.created_at);

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
            'fixed inset-0 md:absolute md:inset-auto md:right-0 md:mt-1.5 md:w-[380px] max-w-full md:max-w-[90vw]',
            'bg-card md:border md:border-border md:rounded-lg shadow-dropdown origin-top-right transition-all duration-150 ease-out flex flex-col md:max-h-[70vh] z-20',
            visible ? 'opacity-100 scale-100' : 'opacity-0 md:scale-95'
          )}
        >
          <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
            <span className="text-body font-medium text-ink">Notifications</span>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="interactive text-caption text-ink-secondary hover:text-ink"
                >
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="interactive md:hidden text-ink-muted hover:text-ink"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>
          </div>
          <div className="overflow-y-auto scrollbar-thin flex-1">
            {loading ? (
              <div className="px-4 py-6 text-center text-caption text-ink-muted">Loading...</div>
            ) : groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
                <span className="w-12 h-12 rounded-full bg-surface-subtle flex items-center justify-center text-ink-muted">
                  <IconBell className="w-6 h-6" />
                </span>
                <p className="text-body font-medium text-ink">All caught up</p>
                <p className="text-caption text-ink-muted">You have no notifications right now.</p>
              </div>
            ) : (
              groups.map(([label, rows]) => (
                <div key={label}>
                  <p className="px-4 pt-3 pb-1 text-[10px] font-medium uppercase tracking-widest text-ink-muted select-none">
                    {label}
                  </p>
                  <ul>
                    <AnimatePresence initial={false}>
                      {rows.map((n) => (
                        <NotificationRow key={n.id} n={n} onOpen={handleClickNotification} onSwipeRead={markRead} />
                      ))}
                    </AnimatePresence>
                  </ul>
                </div>
              ))
            )}
          </div>
          {role === ROLES.SUPER_ADMIN && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate('/admin/notifications');
              }}
              className="interactive shrink-0 px-4 py-2.5 border-t border-border text-center text-caption font-medium text-ink-secondary hover:text-ink hover:bg-surface-subtle"
            >
              View all notifications
            </button>
          )}
        </div>
      )}
    </div>
  );
}
