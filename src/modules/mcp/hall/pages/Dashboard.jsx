import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/shared/components/PageHeader';
import { StatCard } from '@/shared/components/StatCard';
import { StatCardSkeleton } from '@/shared/components/Skeleton';
import { Card, CardHeader } from '@/shared/components/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/shared/components/Table';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { useAuth } from '@/shared/context/AuthContext';
import { listPanels } from '@/modules/mcp/api/panelsApi';
import { IconLayers, IconMove } from '@/shared/components/icons';
import { PANEL_STATUS } from '@/shared/utils/constants';

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
      <PageHeader
        title={`${profile?.hall?.name || 'Hall'} Panels`}
        description="Panel overview for your hall."
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4 mb-8">
        {loading || !stats ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard label="Total Panels" value={stats.total} icon={<IconLayers className="w-4 h-4" />} tone="accent" />
            <StatCard
              label="Issued"
              value={stats.issued}
              icon={<IconMove className="w-4 h-4" />}
              tone="warning"
              onClick={() => navigate('/hall/mcp/panels', { state: { statusFilter: PANEL_STATUS.ISSUED } })}
            />
            <StatCard label="In Hall" value={stats.inHall} icon={<IconLayers className="w-4 h-4" />} tone="success" />
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
