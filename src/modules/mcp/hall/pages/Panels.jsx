import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/shared/components/PageHeader';
import { Card } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/shared/components/Table';
import { CardList, CardListItem } from '@/shared/components/CardList';
import { TableSkeleton } from '@/shared/components/Skeleton';
import { EmptyState } from '@/shared/components/EmptyState';
import { SearchInput } from '@/shared/components/SearchInput';
import { Pagination } from '@/shared/components/Pagination';
import { PillTabs } from '@/shared/components/PillTabs';
import { PanelStatusBadge, ValidityBadge, Badge } from '@/shared/components/Badge';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { useTableControls } from '@/shared/hooks/useTableControls';
import { listPanels } from '@/modules/mcp/api/panelsApi';
import { listPanelMovements } from '@/modules/mcp/api/panelMovementsApi';
import { PAGE_SIZE, PANEL_STATUS } from '@/shared/utils/constants';
import { IconLayers, IconPlus } from '@/shared/components/icons';
import { formatDate, getPanelDisplayStatus } from '@/shared/utils/formatters';
import { PanelThumbnail } from '@/modules/mcp/components/PanelThumbnail';
import { PanelDetailDrawer } from '@/modules/mcp/components/PanelDetailDrawer';

export default function HallPanels() {
  const navigate = useNavigate();
  const { data: panels, loading, reload } = useAsyncData(listPanels, []);
  const { data: movements, reload: reloadMovements } = useAsyncData(listPanelMovements, []);
  const [selected, setSelected] = useState(null);

  const openHopMap = useMemo(() => {
    const map = {};
    (movements || []).forEach((m) => {
      if (m.status === 'out') map[m.panel_id] = m.hop_number;
    });
    return map;
  }, [movements]);

  const rows = useMemo(
    () => (panels || []).map((p) => ({ ...p, displayStatus: getPanelDisplayStatus(p.status, openHopMap[p.id]) })),
    [panels, openHopMap]
  );

  const { search, setSearch, filters, setFilter, page, setPage, totalPages, totalCount, pageRows } =
    useTableControls(rows, { searchFields: ['panel_code', 'panel_name'] });

  const statusTabs = useMemo(
    () => [
      { value: 'all', label: 'All', count: rows.length },
      {
        value: PANEL_STATUS.IN_HALL,
        label: 'In Hall',
        count: rows.filter((p) => p.status === PANEL_STATUS.IN_HALL).length,
      },
      {
        value: PANEL_STATUS.ISSUED,
        label: 'Issued',
        count: rows.filter((p) => p.status === PANEL_STATUS.ISSUED).length,
      },
      {
        value: PANEL_STATUS.RETIRED,
        label: 'Retired',
        count: rows.filter((p) => p.status === PANEL_STATUS.RETIRED).length,
      },
    ],
    [rows]
  );

  function handleChanged() {
    reload();
    reloadMovements();
  }

  return (
    <div>
      <PageHeader
        title="Panels"
        description="Panels signed into your hall."
        actions={
          <Button onClick={() => navigate('/hall/mcp/add-panel')}>
            <IconPlus className="w-4 h-4" />
            Add Panel
          </Button>
        }
      />

      <Card>
        <div className="px-4 py-3 border-b border-border flex flex-wrap items-center gap-3">
          <PillTabs options={statusTabs} value={filters.status || 'all'} onChange={(v) => setFilter('status', v)} />
          <SearchInput value={search} onChange={setSearch} placeholder="Search panel code or name..." className="max-w-xs ml-auto" />
        </div>

        {loading ? (
          <TableSkeleton rows={8} cols={5} />
        ) : panels.length === 0 ? (
          <EmptyState
            icon={<IconLayers className="w-12 h-12 text-ink-muted" />}
            title="No panels yet"
            description="Add your first panel to start tracking it."
            actionLabel="Add Panel"
            onAction={() => navigate('/hall/mcp/add-panel')}
          />
        ) : pageRows.length === 0 ? (
          <EmptyState title="No matches" description="Try adjusting your search or filters." />
        ) : (
          <>
            <Table className="hidden md:table">
              <Thead>
                <Tr>
                  <Th className="w-[64px]"></Th>
                  <Th>Panel Code</Th>
                  <Th>Name</Th>
                  <Th>Buyer</Th>
                  <Th>Status</Th>
                </Tr>
              </Thead>
              <Tbody>
                {pageRows.map((p) => (
                  <Tr key={p.id} onClick={() => setSelected(p)}>
                    <Td>
                      <PanelThumbnail panel={p} />
                    </Td>
                    <Td className="font-medium font-mono">{p.panel_code}</Td>
                    <Td>
                      {p.panel_name}
                      {p.is_shared && <Badge className="ml-1.5">Shared</Badge>}
                    </Td>
                    <Td className="text-ink-secondary">{p.buyer?.name}</Td>
                    <Td>
                      <div className="flex flex-wrap items-center gap-1">
                        <PanelStatusBadge status={p.displayStatus} />
                        <ValidityBadge expiryDate={p.expiry_date} />
                      </div>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>

            <div className="md:hidden p-3">
              <CardList>
                {pageRows.map((p) => (
                  <CardListItem
                    key={p.id}
                    onClick={() => setSelected(p)}
                    leading={<PanelThumbnail panel={p} />}
                    title={<span className="font-mono">{p.panel_code}</span>}
                    subtitle={p.panel_name}
                    trailing={
                      <div className="flex flex-col items-end gap-1">
                        <PanelStatusBadge status={p.displayStatus} />
                        <ValidityBadge expiryDate={p.expiry_date} />
                      </div>
                    }
                    meta={
                      <>
                        <span>{p.buyer?.name}</span>
                        <span>{formatDate(p.created_at)}</span>
                      </>
                    }
                  />
                ))}
              </CardList>
            </div>

            <Pagination page={page} totalPages={totalPages} totalCount={totalCount} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </Card>

      <PanelDetailDrawer open={!!selected} panel={selected} onClose={() => setSelected(null)} onChanged={handleChanged} />
    </div>
  );
}
