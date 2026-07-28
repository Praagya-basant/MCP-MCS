import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { PageHeader } from '@/shared/components/PageHeader';
import { StatCard } from '@/shared/components/StatCard';
import { StatCardSkeleton, TableSkeleton, Skeleton } from '@/shared/components/Skeleton';
import { Card, CardHeader, CardBody } from '@/shared/components/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/shared/components/Table';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { listSamples } from '@/modules/mcs/api/samplesApi';
import { listMovements } from '@/modules/mcs/api/movementsApi';
import { listBuyersWithDetails } from '@/modules/mcs/api/buyersApi';
import { listUsers } from '@/modules/mcs/api/usersApi';
import { IconBox, IconBuilding, IconUsers, IconMove } from '@/shared/components/icons';
import { SAMPLE_STATUS, ROLES } from '@/shared/utils/constants';
import { formatDateTime } from '@/shared/utils/formatters';

const IN_HALL_COLOR = '#16A34A';
const ISSUED_COLOR = '#D97706';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { data, loading } = useAsyncData(async () => {
    const [samples, movements, buyers, users] = await Promise.all([
      listSamples(),
      listMovements(),
      listBuyersWithDetails(),
      listUsers(),
    ]);
    return { samples, movements, buyers, users };
  }, []);

  const stats = useMemo(() => {
    if (!data) return null;
    return {
      totalSamples: data.samples.length,
      totalBuyers: data.buyers.length,
      totalManagers: data.users.filter((u) => u.role === ROLES.HALL_MANAGER).length,
      currentlyIssued: data.samples.filter((s) => s.status === SAMPLE_STATUS.CHECKED_OUT).length,
    };
  }, [data]);

  const buyerChartData = useMemo(
    () =>
      (data?.buyers || [])
        .map((b) => ({ name: b.name, count: b.sampleCount }))
        .sort((a, b) => b.count - a.count),
    [data]
  );

  const statusChartData = useMemo(() => {
    if (!data) return [];
    const inHall = data.samples.filter((s) => s.status === SAMPLE_STATUS.IN_HALL).length;
    const issued = data.samples.filter((s) => s.status === SAMPLE_STATUS.CHECKED_OUT).length;
    return [
      { name: 'In Hall', value: inHall, color: IN_HALL_COLOR },
      { name: 'Issued', value: issued, color: ISSUED_COLOR },
    ];
  }, [data]);

  const topMovements = useMemo(() => (data ? data.movements.slice(0, 8) : []), [data]);

  return (
    <div>
      <PageHeader title="Dashboard" description="Platform-wide overview across every hall and buyer." />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {loading || !stats ? (
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
              value={stats.totalSamples}
              icon={<IconBox className="w-4 h-4" />}
              onClick={() => navigate('/admin/samples')}
            />
            <StatCard
              label="Total Buyers"
              value={stats.totalBuyers}
              icon={<IconBuilding className="w-4 h-4" />}
              onClick={() => navigate('/admin/buyers')}
            />
            <StatCard
              label="Total Managers"
              value={stats.totalManagers}
              icon={<IconUsers className="w-4 h-4" />}
              onClick={() => navigate('/admin/users')}
            />
            <StatCard
              label="Currently Issued"
              value={stats.currentlyIssued}
              icon={<IconMove className="w-4 h-4" />}
              onClick={() => navigate('/admin/samples', { state: { statusFilter: SAMPLE_STATUS.CHECKED_OUT } })}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
        <Card className="lg:col-span-3">
          <CardHeader>
            <h2 className="text-body-lg font-semibold text-ink select-none">Buyer-wise Sample Count</h2>
          </CardHeader>
          <CardBody>
            {loading ? (
              <Skeleton className="h-72 w-full" />
            ) : buyerChartData.length === 0 ? (
              <EmptyState title="No buyers yet" description="Add a buyer to see sample counts here." />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={buyerChartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#E8E8E5" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: '#6B6B6B' }}
                    axisLine={{ stroke: '#E8E8E5' }}
                    tickLine={false}
                    interval={0}
                    angle={buyerChartData.length > 6 ? -30 : 0}
                    textAnchor={buyerChartData.length > 6 ? 'end' : 'middle'}
                    height={buyerChartData.length > 6 ? 50 : 30}
                  />
                  <YAxis tick={{ fontSize: 12, fill: '#6B6B6B' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: '#F3F3F1' }}
                    contentStyle={{ border: '1px solid #E8E8E5', borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="count" name="Samples" fill="#1A1A1A" radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <h2 className="text-body-lg font-semibold text-ink select-none">Status Breakdown</h2>
          </CardHeader>
          <CardBody>
            {loading || !stats ? (
              <Skeleton className="h-72 w-full" />
            ) : stats.totalSamples === 0 ? (
              <EmptyState title="No samples yet" description="Status breakdown will appear here." />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {statusChartData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ border: '1px solid #E8E8E5', borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-center gap-6 mt-2">
                  {statusChartData.map((entry) => (
                    <div key={entry.name} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                      <span className="text-caption text-ink-secondary select-none">
                        {entry.name} ({entry.value})
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <h2 className="text-body-lg font-semibold text-ink select-none">Top Movements</h2>
        </CardHeader>
        {loading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : topMovements.length === 0 ? (
          <EmptyState title="No movements yet" description="Recently issued samples will appear here." />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>BT Code</Th>
                <Th>Product Name</Th>
                <Th>Buyer</Th>
                <Th>Issued To</Th>
                <Th>Reason</Th>
                <Th className="text-right">Date</Th>
              </Tr>
            </Thead>
            <Tbody>
              {topMovements.map((m) => (
                <Tr key={m.id}>
                  <Td className="font-medium font-mono">{m.sample?.bt_code}</Td>
                  <Td>{m.sample?.product_name}</Td>
                  <Td className="text-ink-secondary">{m.sample?.buyer?.name}</Td>
                  <Td className="text-ink-secondary">{m.destination}</Td>
                  <Td className="text-ink-secondary">{m.reason === 'Other' ? m.reason_other || 'Other' : m.reason}</Td>
                  <Td className="text-right text-ink-secondary text-[13px] whitespace-nowrap">{formatDateTime(m.picked_at)}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Card>

      <div>
        <h2 className="text-body-lg font-semibold text-ink select-none mb-3">Buyer-wise Breakdown</h2>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : (data?.buyers || []).length === 0 ? (
          <EmptyState title="No buyers yet" description="Add a buyer to see their breakdown here." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.buyers.map((b) => (
              <Card key={b.id} className="px-5 py-4">
                <p className="text-body font-medium text-ink truncate mb-3">{b.name}</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-heading font-semibold text-ink">{b.sampleCount}</p>
                    <p className="text-caption text-ink-muted select-none">Total</p>
                  </div>
                  <div>
                    <p className="text-heading font-semibold text-status-in-hall-text">
                      {b.sampleCount - b.issuedCount}
                    </p>
                    <p className="text-caption text-ink-muted select-none">In Hall</p>
                  </div>
                  <div>
                    <p className="text-heading font-semibold text-status-checked-out-text">{b.issuedCount}</p>
                    <p className="text-caption text-ink-muted select-none">Issued</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
