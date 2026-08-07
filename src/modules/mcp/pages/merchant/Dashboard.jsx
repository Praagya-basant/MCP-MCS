import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/core/components/PageHeader';
import { StatCard } from '@/core/components/StatCard';
import { StatCardSkeleton } from '@/core/components/Skeleton';
import { Card, CardHeader, CardBody } from '@/core/components/Card';
import { EmptyState } from '@/core/components/EmptyState';
import { PillTabs } from '@/core/components/PillTabs';
import { useAsyncData } from '@/core/hooks/useAsyncData';
import { listPanels } from '@/modules/mcp/api/panelsApi';
import { listPanelMovements } from '@/modules/mcp/api/panelMovementsApi';
import { IconLayers, IconMove, IconBell } from '@/core/components/icons';
import { PANEL_STATUS } from '@/core/utils/constants';
import { formatRelativeTime } from '@/core/utils/formatters';

/** Mirrors MCS's MerchantDashboard, scoped to panels — no ActivityFeed (panels have no recalls to merge in), just a plain recent-movements list. */
export default function MerchantMcpDashboard() {
  const navigate = useNavigate();
  const { data, loading } = useAsyncData(async () => {
    const [panels, movements] = await Promise.all([listPanels(), listPanelMovements()]);
    return { panels, movements };
  }, []);
  const [buyerFilter, setBuyerFilter] = useState('all');

  const buyers = useMemo(() => {
    const seen = new Map();
    (data?.panels || []).forEach((p) => {
      if (p.buyer && !seen.has(p.buyer.id)) seen.set(p.buyer.id, p.buyer);
    });
    return Array.from(seen.values());
  }, [data]);

  const scoped = useMemo(() => {
    if (!data) return null;
    if (buyerFilter === 'all') return data;
    return {
      panels: data.panels.filter((p) => p.buyer_id === buyerFilter),
      movements: data.movements.filter((m) => m.panel?.buyer_id === buyerFilter),
    };
  }, [data, buyerFilter]);

  const stats = useMemo(() => {
    if (!scoped) return null;
    return {
      total: scoped.panels.length,
      issued: scoped.panels.filter((p) => p.status === PANEL_STATUS.ISSUED).length,
      inHall: scoped.panels.filter((p) => p.status === PANEL_STATUS.IN_HALL).length,
    };
  }, [scoped]);

  const recentMovements = useMemo(() => (scoped ? scoped.movements.slice(0, 8) : []), [scoped]);

  const buyerTabs = useMemo(
    () => [{ value: 'all', label: 'All Buyers' }, ...buyers.map((b) => ({ value: b.id, label: b.name }))],
    [buyers]
  );

  const title = buyers.length === 1 ? `${buyers[0].name} Panels` : 'Panels';

  return (
    <div>
      <PageHeader title={title} description="Your panels across every BASANT hall." />

      {buyers.length > 1 && (
        <div className="mb-6">
          <PillTabs options={buyerTabs} value={buyerFilter} onChange={setBuyerFilter} />
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-8">
        {loading || !stats ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              label="Total Panels"
              value={stats.total}
              icon={<IconLayers className="w-4 h-4" />}
              tone="accent"
              onClick={() => navigate('/merchant/mcp/panels')}
            />
            <StatCard
              label="Issued"
              value={stats.issued}
              icon={<IconMove className="w-4 h-4" />}
              tone="warning"
              onClick={() => navigate('/merchant/mcp/panels', { state: { statusFilter: PANEL_STATUS.ISSUED } })}
            />
            <StatCard
              label="In Hall"
              value={stats.inHall}
              icon={<IconLayers className="w-4 h-4" />}
              tone="success"
              onClick={() => navigate('/merchant/mcp/panels', { state: { statusFilter: PANEL_STATUS.IN_HALL } })}
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
          ) : recentMovements.length === 0 ? (
            <EmptyState icon={<IconBell className="w-12 h-12 text-ink-muted" />} title="No activity yet" description="Movements on your panels will appear here." />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {recentMovements.map((m) => (
                <li key={m.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-body text-ink truncate">
                      <span className="font-mono font-medium">{m.panel?.panel_code}</span>{' '}
                      {m.status === 'returned' ? 'returned' : 'issued to'} {m.status === 'returned' ? '' : m.destination}
                    </p>
                    <p className="text-caption text-ink-secondary truncate">{m.panel?.panel_name}</p>
                  </div>
                  <span className="text-caption text-ink-muted shrink-0">
                    {formatRelativeTime(m.status === 'returned' ? m.returned_at : m.picked_at)}
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
