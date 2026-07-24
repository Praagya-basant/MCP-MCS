import { useMemo } from 'react';
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
import { formatRelativeTime, formatDateTime, isToday } from '@/shared/utils/formatters';
import { IconBox, IconBuilding, IconLayers, IconMove } from '@/shared/components/icons';

export default function AdminDashboard() {
  const { data, loading } = useAsyncData(async () => {
    const [samples, movements, buyers, halls] = await Promise.all([
      listSamples(),
      listMovements(),
      listBuyers(),
      listHalls(),
    ]);
    return { samples, movements, buyers, halls };
  }, []);

  const stats = useMemo(() => {
    if (!data) return null;
    const checkedOutToday = data.movements.filter((m) => m.status === 'out' && isToday(m.picked_at)).length;
    return {
      totalSamples: data.samples.length,
      checkedOutToday,
      totalBuyers: data.buyers.length,
      activeHalls: data.halls.length,
    };
  }, [data]);

  const samplesOut = useMemo(
    () => (data ? data.samples.filter((s) => s.status === 'checked_out') : []),
    [data]
  );

  const recentMovements = useMemo(() => (data ? data.movements.slice(0, 8) : []), [data]);

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
            <StatCard label="Checked Out Today" value={stats.checkedOutToday} icon={<IconMove className="w-4 h-4" />} />
            <StatCard label="Total Buyers" value={stats.totalBuyers} icon={<IconBuilding className="w-4 h-4" />} />
            <StatCard label="Active Halls" value={stats.activeHalls} icon={<IconLayers className="w-4 h-4" />} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3">
          <CardHeader>
            <h2 className="text-body-lg font-semibold text-ink">Samples Currently Out</h2>
          </CardHeader>
          {loading ? (
            <TableSkeleton rows={5} cols={4} />
          ) : samplesOut.length === 0 ? (
            <EmptyState title="Nothing checked out" description="Every sample is currently in its hall." />
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
                    <Td className="font-medium">{s.bt_code}</Td>
                    <Td>{s.product_name}</Td>
                    <Td>Hall {s.hall?.hall_number}</Td>
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
            ) : recentMovements.length === 0 ? (
              <EmptyState title="No activity yet" description="Movements will appear here as they happen." />
            ) : (
              <ul className="flex flex-col gap-4">
                {recentMovements.map((m) => (
                  <li key={m.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-body text-ink truncate">
                        <span className="font-medium">{m.sample?.bt_code}</span>{' '}
                        {m.status === 'out' ? 'checked out by' : 'returned by'} {m.picked_by_name}
                      </p>
                      <p className="text-caption text-ink-secondary">
                        Hall {m.sample?.hall?.hall_number} · {m.sample?.buyer?.name}
                      </p>
                    </div>
                    <span
                      className="text-caption text-ink-muted shrink-0"
                      title={formatDateTime(m.status === 'out' ? m.picked_at : m.returned_at)}
                    >
                      {formatRelativeTime(m.status === 'out' ? m.picked_at : m.returned_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
