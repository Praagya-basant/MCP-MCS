import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { IconBox, IconMove, IconLayers, IconAlert, IconBell } from '@/shared/components/icons';
import { SAMPLE_STATUS } from '@/shared/utils/constants';
import { ActivityFeed } from '@/modules/mcs/components/ActivityFeed';
import { buildActivityFeed } from '@/modules/mcs/utils/activity';

export default function MerchantDashboard() {
  const navigate = useNavigate();
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

  const activity = useMemo(
    () => (data ? buildActivityFeed({ movements: data.movements, recalls: data.recalls }).slice(0, 8) : []),
    [data]
  );

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
            <StatCard
              label="Total Samples"
              value={stats.total}
              icon={<IconBox className="w-4 h-4" />}
              onClick={() => navigate('/merchant/samples')}
            />
            <StatCard
              label="Issued"
              value={stats.checkedOut}
              icon={<IconMove className="w-4 h-4" />}
              onClick={() => navigate('/merchant/samples', { state: { statusFilter: SAMPLE_STATUS.CHECKED_OUT } })}
            />
            <StatCard
              label="In Hall"
              value={stats.inHall}
              icon={<IconLayers className="w-4 h-4" />}
              onClick={() => navigate('/merchant/samples', { state: { statusFilter: SAMPLE_STATUS.IN_HALL } })}
            />
            <StatCard
              label="Active Recalls"
              value={stats.activeRecalls}
              icon={<IconAlert className="w-4 h-4" />}
              onClick={() => navigate('/merchant/recalls')}
            />
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
          ) : activity.length === 0 ? (
            <EmptyState icon={<IconBell className="w-12 h-12 text-ink-muted" />} title="No activity yet" description="Movements on your samples will appear here." />
          ) : (
            <ActivityFeed items={activity} />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
