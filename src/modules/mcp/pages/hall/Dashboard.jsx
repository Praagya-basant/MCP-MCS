import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/core/components/PageHeader';
import { StatCard } from '@/core/components/StatCard';
import { StatCardSkeleton } from '@/core/components/Skeleton';
import { Card, CardHeader } from '@/core/components/Card';
import { EmptyState } from '@/core/components/EmptyState';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/core/components/Table';
import { useAsyncData } from '@/core/hooks/useAsyncData';
import { useAuth } from '@/core/auth/AuthContext';
import { listPanels } from '@/modules/mcp/api/panelsApi';
import { IconLayers, IconMove } from '@/core/components/icons';
import { PANEL_STATUS } from '@/core/utils/constants';
import { getGreeting } from '@/core/utils/formatters';

/** Mirrors MCS's HallDashboard, scoped to panels — no ActivityFeed (panels have no recalls to merge in), just a plain Currently Issued table. */
export default function HallMcpDashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: panels, loading } = useAsyncData(listPanels, []);

  const stats = useMemo(() => {
    if (!panels) return null;
    return {
      total: panels.length,
      issued: panels.filter((p) => p.status === PANEL_STATUS.ISSUED).length,
      inHall: panels.filter((p) => p.status === PANEL_STATUS.IN_HALL).length,
    };
  }, [panels]);

  const issuedPanels = useMemo(() => (panels || []).filter((p) => p.status === PANEL_STATUS.ISSUED), [panels]);

  return (
    <div>
      <p className="text-body text-ink-secondary mb-1 select-none">
        {getGreeting()}{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
      </p>
      <PageHeader
        title={`${profile?.hall?.name || 'Hall'} Panels`}
        description="Panel overview for your hall."
      />

      <div className="grid grid-cols-3 gap-4 mb-8">
        {loading || !stats ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard label="Total Panels" value={stats.total} icon={<IconLayers className="w-4 h-4" />} tone="accent" onClick={() => navigate('/hall/mcp/panels')} />
            <StatCard
              label="Issued"
              value={stats.issued}
              icon={<IconMove className="w-4 h-4" />}
              tone="warning"
              onClick={() => navigate('/hall/mcp/panels', { state: { statusFilter: PANEL_STATUS.ISSUED } })}
            />
            <StatCard
              label="In Hall"
              value={stats.inHall}
              icon={<IconLayers className="w-4 h-4" />}
              tone="success"
              onClick={() => navigate('/hall/mcp/panels', { state: { statusFilter: PANEL_STATUS.IN_HALL } })}
            />
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-body-lg font-semibold text-ink">Currently Issued</h2>
        </CardHeader>
        {loading ? null : issuedPanels.length === 0 ? (
          <EmptyState title="Nothing issued" description="Every panel is currently in the hall." />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Panel Code</Th>
                <Th>Name</Th>
                <Th>Buyer</Th>
              </Tr>
            </Thead>
            <Tbody>
              {issuedPanels.slice(0, 8).map((p) => (
                <Tr key={p.id}>
                  <Td className="font-medium font-mono">{p.panel_code}</Td>
                  <Td>{p.panel_name}</Td>
                  <Td className="text-ink-secondary">{p.buyer?.name}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
