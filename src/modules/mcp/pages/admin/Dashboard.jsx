import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { PageHeader } from '@/core/components/PageHeader';
import { StatCard } from '@/core/components/StatCard';
import { StatCardSkeleton, TableSkeleton, Skeleton } from '@/core/components/Skeleton';
import { Card, CardHeader, CardBody } from '@/core/components/Card';
import { EmptyState } from '@/core/components/EmptyState';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/core/components/Table';
import { useAsyncData } from '@/core/hooks/useAsyncData';
import { useAuth } from '@/core/auth/AuthContext';
import { listPanels } from '@/modules/mcp/api/panelsApi';
import { listPanelMovements } from '@/modules/mcp/api/panelMovementsApi';
import { IconLayers, IconBox, IconMove } from '@/core/components/icons';
import { PANEL_STATUS } from '@/core/utils/constants';
import { safeFetch } from '@/core/utils/safeFetch';
import { formatDateTime, getGreeting } from '@/core/utils/formatters';

const IN_HALL_COLOR = 'rgb(var(--color-success))';
const ISSUED_COLOR = 'rgb(var(--color-warning))';
const RETIRED_COLOR = 'rgb(var(--color-ink-muted))';
const CHART_GRID = 'rgb(var(--color-border))';
const CHART_LABEL = 'rgb(var(--color-ink-secondary))';
const ACCENT_COLOR = 'rgb(var(--color-accent))';

/**
 * Mirrors AdminDashboard's structure (stat cards, buyer-wise bar chart,
 * status pie, top movements table) scoped to panels — no drill-down
 * drawer or buyers/merchants breakdown, since those are platform-wide
 * concepts the MCS dashboard already covers.
 */
export default function AdminMcpDashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const firstName = profile?.full_name?.split(' ')[0];
  const { data, loading } = useAsyncData(async () => {
    const [panels, movements] = await Promise.all([safeFetch(listPanels(), []), safeFetch(listPanelMovements(), [])]);
    return { panels, movements };
  }, []);

  const stats = useMemo(() => {
    if (!data) return null;
    return {
      total: data.panels.length,
      inHall: data.panels.filter((p) => p.status === PANEL_STATUS.IN_HALL).length,
      issued: data.panels.filter((p) => p.status === PANEL_STATUS.ISSUED).length,
      retired: data.panels.filter((p) => p.status === PANEL_STATUS.RETIRED).length,
    };
  }, [data]);

  const buyerChartData = useMemo(() => {
    if (!data) return [];
    const counts = new Map();
    data.panels.forEach((p) => {
      const name = p.buyer?.name || 'Unassigned';
      counts.set(name, (counts.get(name) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  const statusChartData = useMemo(() => {
    if (!stats) return [];
    return [
      { name: 'In Hall', value: stats.inHall, color: IN_HALL_COLOR },
      { name: 'Issued', value: stats.issued, color: ISSUED_COLOR },
      { name: 'Retired', value: stats.retired, color: RETIRED_COLOR },
    ].filter((d) => d.value > 0);
  }, [stats]);

  const topMovements = useMemo(() => (data ? data.movements.slice(0, 8) : []), [data]);

  return (
    <div>
      <p className="text-body text-ink-secondary mb-1 select-none">
        {getGreeting()}{firstName ? `, ${firstName}` : ''}
      </p>
      <PageHeader title="MCP Dashboard" description="Panel overview across every hall and buyer." />

      <div className="grid grid-cols-4 gap-4 mb-8">
        {loading || !stats ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard label="Total Panels" value={stats.total} icon={<IconLayers className="w-4 h-4" />} tone="accent" onClick={() => navigate('/admin/mcp/panels')} />
            <StatCard label="In Hall" value={stats.inHall} icon={<IconBox className="w-4 h-4" />} tone="success" onClick={() => navigate('/admin/mcp/panels', { state: { statusFilter: PANEL_STATUS.IN_HALL } })} />
            <StatCard label="Issued" value={stats.issued} icon={<IconMove className="w-4 h-4" />} tone="warning" onClick={() => navigate('/admin/mcp/panels', { state: { statusFilter: PANEL_STATUS.ISSUED } })} />
            <StatCard label="Retired" value={stats.retired} icon={<IconLayers className="w-4 h-4" />} tone="neutral" onClick={() => navigate('/admin/mcp/panels', { state: { statusFilter: PANEL_STATUS.RETIRED } })} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
        <Card className="lg:col-span-3">
          <CardHeader>
            <h2 className="text-body-lg font-semibold text-ink select-none">Buyer-wise Panel Count</h2>
          </CardHeader>
          <CardBody>
            {loading ? (
              <Skeleton className="h-72 w-full" />
            ) : buyerChartData.length === 0 ? (
              <EmptyState title="No panels yet" description="Panel counts by buyer will appear here." />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={buyerChartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={CHART_GRID} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: CHART_LABEL }}
                    axisLine={{ stroke: CHART_GRID }}
                    tickLine={false}
                    interval={0}
                    angle={buyerChartData.length > 6 ? -30 : 0}
                    textAnchor={buyerChartData.length > 6 ? 'end' : 'middle'}
                    height={buyerChartData.length > 6 ? 50 : 30}
                  />
                  <YAxis tick={{ fontSize: 12, fill: CHART_LABEL }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: 'rgb(var(--color-surface-subtle))' }}
                    contentStyle={{ background: 'rgb(var(--color-card))', border: `1px solid ${CHART_GRID}`, borderRadius: 8, fontSize: 12, color: 'rgb(var(--color-ink))' }}
                  />
                  <Bar dataKey="count" name="Panels" fill={ACCENT_COLOR} radius={[4, 4, 0, 0]} maxBarSize={36} />
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
            ) : stats.total === 0 ? (
              <EmptyState title="No panels yet" description="Status breakdown will appear here." />
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
                    <Tooltip
                      contentStyle={{ background: 'rgb(var(--color-card))', border: `1px solid ${CHART_GRID}`, borderRadius: 8, fontSize: 12, color: 'rgb(var(--color-ink))' }}
                    />
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

      <Card>
        <CardHeader>
          <h2 className="text-body-lg font-semibold text-ink select-none">Top Movements</h2>
        </CardHeader>
        {loading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : topMovements.length === 0 ? (
          <EmptyState title="No movements yet" description="Recently issued panels will appear here." />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Panel Code</Th>
                <Th>Panel Name</Th>
                <Th>Buyer</Th>
                <Th>Issued To</Th>
                <Th>Reason</Th>
                <Th className="text-right">Date</Th>
              </Tr>
            </Thead>
            <Tbody>
              {topMovements.map((m) => (
                <Tr key={m.id}>
                  <Td className="font-medium font-mono">{m.panel?.panel_code}</Td>
                  <Td>{m.panel?.panel_name}</Td>
                  <Td className="text-ink-secondary">{m.panel?.buyer?.name}</Td>
                  <Td className="text-ink-secondary">{m.destination}</Td>
                  <Td className="text-ink-secondary">{m.reason === 'Other' ? m.reason_other || 'Other' : m.reason}</Td>
                  <Td className="text-right text-ink-secondary text-[13px] whitespace-nowrap">{formatDateTime(m.picked_at)}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
