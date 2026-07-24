import { useMemo } from 'react';
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
import { formatRelativeTime, isToday } from '@/shared/utils/formatters';
import { IconBox, IconMove, IconLayers } from '@/shared/components/icons';

export default function HallDashboard() {
  const { profile } = useAuth();
  const { data, loading } = useAsyncData(async () => {
    const [samples, movements] = await Promise.all([listSamples(), listMovements()]);
    return { samples, movements };
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
  const recent = useMemo(() => (data ? data.movements.slice(0, 8) : []), [data]);

  return (
    <div>
      <PageHeader
        title={`Hall ${profile?.hall?.hall_number ?? ''} Dashboard`}
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
            <StatCard label="Checked Out" value={stats.out} icon={<IconMove className="w-4 h-4" />} />
            <StatCard label="Returned Today" value={stats.returnedToday} icon={<IconLayers className="w-4 h-4" />} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3">
          <CardHeader>
            <h2 className="text-body-lg font-semibold text-ink">Currently Checked Out</h2>
          </CardHeader>
          {loading ? null : checkedOut.length === 0 ? (
            <EmptyState title="Nothing checked out" description="Every sample is currently in the hall." />
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
                    <Td className="font-medium">{s.bt_code}</Td>
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
            {loading ? null : recent.length === 0 ? (
              <EmptyState title="No activity yet" description="Checkouts and returns will appear here." />
            ) : (
              <ul className="flex flex-col gap-4">
                {recent.map((m) => (
                  <li key={m.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-body text-ink truncate">
                        <span className="font-medium">{m.sample?.bt_code}</span>{' '}
                        {m.status === 'out' ? 'checked out by' : 'returned by'} {m.picked_by_name}
                      </p>
                      <p className="text-caption text-ink-secondary">{m.sample?.buyer?.name}</p>
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
    </div>
  );
}
