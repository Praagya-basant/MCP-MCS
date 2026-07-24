import { useMemo } from 'react';
import { PageHeader } from '@/shared/components/PageHeader';
import { StatCard } from '@/shared/components/StatCard';
import { StatCardSkeleton } from '@/shared/components/Skeleton';
import { Card, CardHeader, CardBody } from '@/shared/components/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { useAuth } from '@/shared/context/AuthContext';
import { listSamples } from '@/modules/mcs/api/samplesApi';
import { listMovements } from '@/modules/mcs/api/movementsApi';
import { listRecalls } from '@/modules/mcs/api/recallsApi';
import { formatRelativeTime } from '@/shared/utils/formatters';
import { IconBox, IconMove, IconLayers, IconAlert } from '@/shared/components/icons';

export default function MerchantDashboard() {
  const { profile } = useAuth();
  const { data, loading } = useAsyncData(async () => {
    const [samples, movements, recalls] = await Promise.all([listSamples(), listMovements(), listRecalls()]);
    return { samples, movements, recalls };
  }, []);

  const stats = useMemo(() => {
    if (!data) return null;
    return {
      total: data.samples.length,
      checkedOut: data.samples.filter((s) => s.status === 'checked_out').length,
      inHall: data.samples.filter((s) => s.status === 'in_hall').length,
      activeRecalls: data.recalls.filter((r) => r.status !== 'resolved').length,
    };
  }, [data]);

  const recent = useMemo(() => (data ? data.movements.slice(0, 8) : []), [data]);

  return (
    <div>
      <PageHeader title={profile?.buyer?.name || 'Dashboard'} description="Your samples across every BASANT hall." />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {loading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard label="Total Samples" value={stats.total} icon={<IconBox className="w-4 h-4" />} />
            <StatCard label="Checked Out" value={stats.checkedOut} icon={<IconMove className="w-4 h-4" />} />
            <StatCard label="In Hall" value={stats.inHall} icon={<IconLayers className="w-4 h-4" />} />
            <StatCard label="Active Recalls" value={stats.activeRecalls} icon={<IconAlert className="w-4 h-4" />} />
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-body-lg font-semibold text-ink">Recent Movement</h2>
        </CardHeader>
        <CardBody>
          {loading ? (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-4 bg-surface-subtle rounded skeleton" />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <EmptyState title="No activity yet" description="Movements on your samples will appear here." />
          ) : (
            <ul className="flex flex-col gap-4">
              {recent.map((m) => (
                <li key={m.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-body text-ink truncate">
                      <span className="font-medium">{m.sample?.bt_code}</span>{' '}
                      {m.status === 'out' ? 'checked out by' : 'returned by'} {m.picked_by_name}
                    </p>
                    <p className="text-caption text-ink-secondary">Hall {m.sample?.hall?.hall_number}</p>
                  </div>
                  <span className="text-caption text-ink-muted shrink-0">
                    {formatRelativeTime(m.status === 'out' ? m.picked_at : m.returned_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
