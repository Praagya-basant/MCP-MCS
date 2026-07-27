import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/shared/components/PageHeader';
import { StatCard } from '@/shared/components/StatCard';
import { StatCardSkeleton, TableSkeleton } from '@/shared/components/Skeleton';
import { Card, CardHeader, CardBody } from '@/shared/components/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/shared/components/Table';
import { StatusBadge } from '@/shared/components/Badge';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { listSamples } from '@/modules/mcs/api/samplesApi';
import { listMovements } from '@/modules/mcs/api/movementsApi';
import { listBuyers } from '@/modules/mcs/api/buyersApi';
import { listHalls } from '@/modules/mcs/api/hallsApi';
import { listRecalls } from '@/modules/mcs/api/recallsApi';
import { isToday } from '@/shared/utils/formatters';
import { IconBox, IconBuilding, IconLayers, IconMove, IconBell } from '@/shared/components/icons';
import { SAMPLE_STATUS } from '@/shared/utils/constants';
import { ActivityFeed } from '@/modules/mcs/components/ActivityFeed';
import { buildActivityFeed } from '@/modules/mcs/utils/activity';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { data, loading } = useAsyncData(async () => {
    const [samples, movements, buyers, halls, recalls] = await Promise.all([
      listSamples(),
      listMovements(),
      listBuyers(),
      listHalls(),
      listRecalls(),
    ]);
    return { samples, movements, buyers, halls, recalls };
  }, []);

  const stats = useMemo(() => {
    if (!data) return null;
    const checkedOutToday = data.movements.filter((m) => m.status === 'out' && isToday(m.picked_at)).length;
    return {
      totalSamples: data.samples.length,
      checkedOutToday,
      totalBuyers: data.buyers.length,
      activeHalls: data.halls.length,
      currentlyIssued: data.samples.filter((s) => s.status === SAMPLE_STATUS.CHECKED_OUT).length,
    };
  }, [data]);

  const samplesOut = useMemo(
    () => (data ? data.samples.filter((s) => s.status === 'checked_out') : []),
    [data]
  );

  const activity = useMemo(
    () => (data ? buildActivityFeed({ movements: data.movements, recalls: data.recalls }).slice(0, 8) : []),
    [data]
  );

  return (
    <div>
      <PageHeader title="Dashboard" description="Platform-wide overview across every hall and buyer." />

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
            <StatCard label="Total Samples" value={stats.totalSamples} icon={<IconBox className="w-4 h-4" />} />
            <StatCard
              label="Currently Issued"
              value={stats.currentlyIssued}
              icon={<IconMove className="w-4 h-4" />}
              onClick={() => navigate('/admin/samples', { state: { statusFilter: SAMPLE_STATUS.CHECKED_OUT } })}
            />
            <StatCard label="Total Buyers" value={stats.totalBuyers} icon={<IconBuilding className="w-4 h-4" />} />
            <StatCard label="Active Halls" value={stats.activeHalls} icon={<IconLayers className="w-4 h-4" />} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3">
          <CardHeader>
            <h2 className="text-body-lg font-semibold text-ink">Samples Currently Issued</h2>
          </CardHeader>
          {loading ? (
            <TableSkeleton rows={5} cols={4} />
          ) : samplesOut.length === 0 ? (
            <EmptyState title="Nothing issued" description="Every sample is currently in its hall." />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>BT Code</Th>
                  <Th>Product</Th>
                  <Th>Hall</Th>
                  <Th>Status</Th>
                </Tr>
              </Thead>
              <Tbody>
                {samplesOut.slice(0, 8).map((s) => (
                  <Tr key={s.id}>
                    <Td className="font-medium font-mono">{s.bt_code}</Td>
                    <Td>{s.product_name}</Td>
                    <Td>{s.hall?.name}</Td>
                    <Td>
                      <StatusBadge status={s.status} />
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <h2 className="text-body-lg font-semibold text-ink">Movement Activity</h2>
          </CardHeader>
          <CardBody>
            {loading ? (
              <div className="flex flex-col gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-4 bg-surface-subtle rounded skeleton" />
                ))}
              </div>
            ) : activity.length === 0 ? (
              <EmptyState icon={<IconBell className="w-12 h-12 text-ink-muted" />} title="No activity yet" description="Movements will appear here as they happen." />
            ) : (
              <ActivityFeed items={activity} />
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
