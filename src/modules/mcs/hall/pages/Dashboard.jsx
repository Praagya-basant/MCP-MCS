import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/shared/components/PageHeader';
import { StatCard } from '@/shared/components/StatCard';
import { StatCardSkeleton } from '@/shared/components/Skeleton';
import { Card, CardHeader, CardBody } from '@/shared/components/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/shared/components/Table';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { useAuth } from '@/shared/context/AuthContext';
import { listSamples } from '@/modules/mcs/api/samplesApi';
import { listMovements } from '@/modules/mcs/api/movementsApi';
import { listRecalls } from '@/modules/mcs/api/recallsApi';
import { isToday } from '@/shared/utils/formatters';
import { IconBox, IconMove, IconLayers, IconBell } from '@/shared/components/icons';
import { SAMPLE_STATUS } from '@/shared/utils/constants';
import { ActivityFeed } from '@/modules/mcs/components/ActivityFeed';
import { buildActivityFeed } from '@/modules/mcs/utils/activity';

export default function HallDashboard() {
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
      out: data.samples.filter((s) => s.status === 'checked_out').length,
      returnedToday: data.movements.filter((m) => m.status === 'returned' && isToday(m.returned_at)).length,
    };
  }, [data]);

  const checkedOut = useMemo(() => (data ? data.samples.filter((s) => s.status === 'checked_out') : []), [data]);

  const activity = useMemo(
    () => (data ? buildActivityFeed({ movements: data.movements, recalls: data.recalls }).slice(0, 8) : []),
    [data]
  );

  return (
    <div>
      <PageHeader
        title={`${profile?.hall?.name || 'Hall'} Dashboard`}
        description="Samples and movements for your hall."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {loading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard label="Total Samples" value={stats.total} icon={<IconBox className="w-4 h-4" />} />
            <StatCard
              label="Currently Issued"
              value={stats.out}
              icon={<IconMove className="w-4 h-4" />}
              onClick={() => navigate('/hall/samples', { state: { statusFilter: SAMPLE_STATUS.CHECKED_OUT } })}
            />
            <StatCard label="Returned Today" value={stats.returnedToday} icon={<IconLayers className="w-4 h-4" />} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3">
          <CardHeader>
            <h2 className="text-body-lg font-semibold text-ink">Currently Issued</h2>
          </CardHeader>
          {loading ? null : checkedOut.length === 0 ? (
            <EmptyState title="Nothing issued" description="Every sample is currently in the hall." />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>BT Code</Th>
                  <Th>Product</Th>
                  <Th>Buyer</Th>
                </Tr>
              </Thead>
              <Tbody>
                {checkedOut.slice(0, 8).map((s) => (
                  <Tr key={s.id}>
                    <Td className="font-medium font-mono">{s.bt_code}</Td>
                    <Td>{s.product_name}</Td>
                    <Td className="text-ink-secondary">{s.buyer?.name}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <h2 className="text-body-lg font-semibold text-ink">Recent Activity</h2>
          </CardHeader>
          <CardBody>
            {loading ? null : activity.length === 0 ? (
              <EmptyState icon={<IconBell className="w-12 h-12 text-ink-muted" />} title="No activity yet" description="Issues and returns will appear here." />
            ) : (
              <ActivityFeed items={activity} />
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
