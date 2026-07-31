import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/shared/components/PageHeader';
import { Card } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { TableSkeleton } from '@/shared/components/Skeleton';
import { EmptyState } from '@/shared/components/EmptyState';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { useAuth } from '@/shared/context/AuthContext';
import { listNotifications, markNotificationRead, markAllNotificationsRead, getNotificationRoute } from '@/shared/lib/notificationsApi';
import { formatDateTime } from '@/shared/utils/formatters';
import { IconBell } from '@/shared/components/icons';
import { cn } from '@/shared/utils/cn';

const TYPE_LABELS = {
  checkout: 'Sample Issued',
  forward: 'Sample Forwarded',
  return: 'Sample Returned',
  recall: 'Recall Requests',
  validity_alert: 'Validity Expiring',
  validity_requested: 'Validity Extension Requested',
  validity_extended: 'Validity Updated',
  shift_requested: 'Hall Shift Requested',
  shift_approved: 'Hall Shift Approved',
  shift_rejected: 'Hall Shift Rejected',
  panel_checkout: 'Panel Issued',
  panel_forward: 'Panel Forwarded',
  panel_return: 'Panel Returned',
  panel_retired: 'Panel Retired',
  panel_validity_requested: 'Panel Validity Extension Requested',
  panel_validity_extended: 'Panel Validity Updated',
};

/**
 * Full-page equivalent of NotificationBell's dropdown — every
 * notification (not just the most recent 20), grouped by type. Admin
 * only, per the spec's "Admin panel updates" step; hall/merchant don't
 * get this page, just the bell.
 */
export default function AdminNotifications() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { data: items, loading, setData } = useAsyncData(() => listNotifications({ limit: 200 }), []);

  const groups = useMemo(() => {
    const byType = new Map();
    (items || []).forEach((n) => {
      if (!byType.has(n.type)) byType.set(n.type, []);
      byType.get(n.type).push(n);
    });
    return Array.from(byType.entries()).map(([type, rows]) => ({ type, rows }));
  }, [items]);

  const unreadCount = useMemo(() => (items || []).filter((n) => !n.is_read).length, [items]);

  async function handleMarkAllRead() {
    setData((prev) => (prev || []).map((n) => ({ ...n, is_read: true })));
    try {
      await markAllNotificationsRead();
    } catch {
      // best-effort — a failed bulk mark-read just leaves some rows unread, not worth a toast for this
    }
  }

  function handleClickNotification(n) {
    if (!n.is_read) {
      setData((prev) => (prev || []).map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      markNotificationRead(n.id).catch(() => {});
    }
    const route = getNotificationRoute(role, n.item_type, n.item_id);
    if (route) navigate(route.to, { state: route.state });
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Every system notification, grouped by type."
        actions={
          unreadCount > 0 && (
            <Button variant="secondary" onClick={handleMarkAllRead}>
              Mark all read
            </Button>
          )
        }
      />

      {loading ? (
        <Card>
          <TableSkeleton rows={8} cols={1} />
        </Card>
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState icon={<IconBell className="w-12 h-12 text-ink-muted" />} title="No notifications yet" description="System notifications will appear here." />
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <Card key={group.type}>
              <div className="px-4 py-3 border-b border-border">
                <p className="text-body font-medium text-ink">{TYPE_LABELS[group.type] || group.type}</p>
              </div>
              <ul>
                {group.rows.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleClickNotification(n)}
                      className="interactive w-full text-left px-4 py-3 border-b border-border last:border-b-0 hover:bg-surface-subtle flex gap-3"
                    >
                      <span
                        className={cn(
                          'mt-1.5 w-1.5 h-1.5 rounded-full shrink-0',
                          n.is_read ? 'bg-transparent' : 'bg-status-checked-out-text'
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className={cn('text-body', n.is_read ? 'text-ink' : 'text-ink font-medium')}>{n.title}</p>
                        <p className="mt-0.5 text-caption text-ink-secondary">{n.message}</p>
                      </div>
                      <span className="text-caption text-ink-muted shrink-0 whitespace-nowrap">{formatDateTime(n.created_at)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
