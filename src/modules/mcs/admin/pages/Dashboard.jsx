import { useMemo, useState } from 'react';
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
import { Drawer } from '@/shared/components/Drawer';
import { SearchInput } from '@/shared/components/SearchInput';
import { StatusBadge } from '@/shared/components/Badge';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { listSamples } from '@/modules/mcs/api/samplesApi';
import { listMovements } from '@/modules/mcs/api/movementsApi';
import { listBuyersWithDetails } from '@/modules/mcs/api/buyersApi';
import { listUsers } from '@/modules/mcs/api/usersApi';
import { IconBox, IconBuilding, IconUsers, IconMove, IconLayers } from '@/shared/components/icons';
import { SAMPLE_STATUS, ROLES } from '@/shared/utils/constants';
import { formatDateTime } from '@/shared/utils/formatters';

const IN_HALL_COLOR = '#16A34A';
const ISSUED_COLOR = '#D97706';

const PANEL_META = {
  samples: { title: 'All Samples', href: '/admin/samples' },
  issued: { title: 'Issued Samples', href: '/admin/samples' },
  inHall: { title: 'In Hall Samples', href: '/admin/samples' },
  buyers: { title: 'Buyers', href: '/admin/team', state: { tab: 'buyers' } },
  merchants: { title: 'Merchants', href: '/admin/team', state: { tab: 'users' } },
};

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

  const [activePanel, setActivePanel] = useState(null);
  const [panelSearch, setPanelSearch] = useState('');

  function openPanel(panel) {
    setPanelSearch('');
    setActivePanel(panel);
  }

  const stats = useMemo(() => {
    if (!data) return null;
    return {
      totalSamples: data.samples.length,
      inHall: data.samples.filter((s) => s.status === SAMPLE_STATUS.IN_HALL).length,
      currentlyIssued: data.samples.filter((s) => s.status === SAMPLE_STATUS.CHECKED_OUT).length,
      totalBuyers: data.buyers.length,
      totalMerchants: data.users.filter((u) => u.role === ROLES.MERCHANT).length,
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

  const panelSamples = useMemo(() => {
    if (!data) return [];
    let rows = data.samples;
    if (activePanel === 'issued') rows = rows.filter((s) => s.status === SAMPLE_STATUS.CHECKED_OUT);
    if (activePanel === 'inHall') rows = rows.filter((s) => s.status === SAMPLE_STATUS.IN_HALL);
    const q = panelSearch.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (s) =>
          s.bt_code?.toLowerCase().includes(q) ||
          s.product_name?.toLowerCase().includes(q) ||
          s.buyer?.name?.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [data, activePanel, panelSearch]);

  const merchants = useMemo(() => {
    if (!data) return [];
    return data.users
      .filter((u) => u.role === ROLES.MERCHANT)
      .map((m) => ({
        ...m,
        assignedBuyers: data.buyers.filter((b) => (b.contacts || []).some((c) => c.profile?.id === m.id)).map((b) => b.name),
      }));
  }, [data]);

  const isSamplePanel = activePanel === 'samples' || activePanel === 'issued' || activePanel === 'inHall';
  const meta = activePanel ? PANEL_META[activePanel] : null;

  return (
    <div>
      <PageHeader title="Dashboard" description="Platform-wide overview across every hall and buyer." />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {loading || !stats ? (
          <>
            <StatCardSkeleton />
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
              onClick={() => openPanel('samples')}
            />
            <StatCard
              label="In Hall"
              value={stats.inHall}
              icon={<IconLayers className="w-4 h-4" />}
              onClick={() => openPanel('inHall')}
            />
            <StatCard
              label="Issued"
              value={stats.currentlyIssued}
              icon={<IconMove className="w-4 h-4" />}
              onClick={() => openPanel('issued')}
            />
            <StatCard
              label="Total Buyers"
              value={stats.totalBuyers}
              icon={<IconBuilding className="w-4 h-4" />}
              onClick={() => openPanel('buyers')}
            />
            <StatCard
              label="Total Merchants"
              value={stats.totalMerchants}
              icon={<IconUsers className="w-4 h-4" />}
              onClick={() => openPanel('merchants')}
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

      <Drawer open={!!activePanel} onClose={() => setActivePanel(null)} title={meta?.title}>
        {activePanel && (
          <div className="flex flex-col h-full min-h-0">
            <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5">
              {isSamplePanel && (
                <div className="flex flex-col gap-4">
                  <SearchInput
                    value={panelSearch}
                    onChange={setPanelSearch}
                    placeholder="Search BT code, product, buyer..."
                  />
                  {panelSamples.length === 0 ? (
                    <EmptyState title="No samples" description="Nothing to show here." />
                  ) : (
                    <div className="flex flex-col divide-y divide-border border border-border rounded-control overflow-hidden">
                      {panelSamples.map((s) => (
                        <div key={s.id} className="px-3 py-2.5 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-body font-medium font-mono text-ink truncate">{s.bt_code}</p>
                            <p className="text-caption text-ink-secondary truncate">
                              {s.product_name} &middot; {s.buyer?.name}
                            </p>
                          </div>
                          <StatusBadge status={s.status} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activePanel === 'buyers' &&
                (data.buyers.length === 0 ? (
                  <EmptyState title="No buyers yet" description="Add a buyer to see them here." />
                ) : (
                  <div className="flex flex-col divide-y divide-border border border-border rounded-control overflow-hidden">
                    {data.buyers.map((b) => (
                      <div key={b.id} className="px-3 py-2.5 flex items-center justify-between gap-3">
                        <p className="text-body text-ink truncate">{b.name}</p>
                        <span className="text-caption text-ink-secondary shrink-0">
                          {b.sampleCount} sample{b.sampleCount === 1 ? '' : 's'}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}

              {activePanel === 'merchants' &&
                (merchants.length === 0 ? (
                  <EmptyState title="No merchants yet" description="Create a merchant account to see them here." />
                ) : (
                  <div className="flex flex-col divide-y divide-border border border-border rounded-control overflow-hidden">
                    {merchants.map((m) => (
                      <div key={m.id} className="px-3 py-2.5">
                        <p className="text-body font-medium text-ink truncate">{m.full_name}</p>
                        <p className="text-caption text-ink-secondary truncate">
                          {m.assignedBuyers.length > 0 ? m.assignedBuyers.join(', ') : 'No buyers assigned'}
                        </p>
                      </div>
                    ))}
                  </div>
                ))}
            </div>

            <div className="px-6 py-4 border-t border-border shrink-0">
              <button
                onClick={() => navigate(meta.href, meta.state ? { state: meta.state } : undefined)}
                className="interactive text-body font-medium text-ink hover:text-ink-secondary"
              >
                View Full Page &rarr;
              </button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
