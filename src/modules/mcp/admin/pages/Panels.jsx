import { useMemo, useState } from 'react';
import { PageHeader } from '@/shared/components/PageHeader';
import { Card } from '@/shared/components/Card';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/shared/components/Table';
import { CardList, CardListItem } from '@/shared/components/CardList';
import { TableSkeleton } from '@/shared/components/Skeleton';
import { EmptyState } from '@/shared/components/EmptyState';
import { SearchInput } from '@/shared/components/SearchInput';
import { Pagination } from '@/shared/components/Pagination';
import { PillTabs } from '@/shared/components/PillTabs';
import { Select } from '@/shared/components/Input';
import { PanelStatusBadge, ValidityBadge, Badge } from '@/shared/components/Badge';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { useTableControls } from '@/shared/hooks/useTableControls';
import { listPanels } from '@/modules/mcp/api/panelsApi';
import { listBuyers } from '@/modules/mcs/api/buyersApi';
import { listHalls } from '@/modules/mcs/api/hallsApi';
import { PAGE_SIZE, PANEL_STATUS } from '@/shared/utils/constants';
import { IconLayers } from '@/shared/components/icons';
import { formatDate } from '@/shared/utils/formatters';
import { PanelThumbnail } from '@/modules/mcp/components/PanelThumbnail';
import { PanelDetailDrawer } from '@/modules/mcp/components/PanelDetailDrawer';

export default function AdminPanels() {
  const { data: panels, loading } = useAsyncData(listPanels, []);
  const { data: buyers } = useAsyncData(listBuyers, []);
  const { data: halls } = useAsyncData(listHalls, []);
  const [selected, setSelected] = useState(null);

  const { search, setSearch, filters, setFilter, page, setPage, totalPages, totalCount, pageRows } =
    useTableControls(panels || [], { searchFields: ['panel_code', 'panel_name'] });

  const statusTabs = useMemo(
    () => [
      { value: 'all', label: 'All', count: (panels || []).length },
      {
        value: PANEL_STATUS.IN_HALL,
        label: 'In Hall',
        count: (panels || []).filter((p) => p.status === PANEL_STATUS.IN_HALL).length,
      },
      {
        value: PANEL_STATUS.ISSUED,
        label: 'Issued',
        count: (panels || []).filter((p) => p.status === PANEL_STATUS.ISSUED).length,
      },
      {
        value: PANEL_STATUS.RETIRED,
        label: 'Retired',
        count: (panels || []).filter((p) => p.status === PANEL_STATUS.RETIRED).length,
      },
    ],
    [panels]
  );

  return (
    <div>
      <PageHeader title="Panels" description="Every signed panel across every hall." />

      <Card>
        <div className="px-4 py-3 border-b border-border flex flex-wrap items-center gap-3">
          <PillTabs options={statusTabs} value={filters.status || 'all'} onChange={(v) => setFilter('status', v)} />
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <Select
              value={filters.buyer_id || 'all'}
              onChange={(e) => setFilter('buyer_id', e.target.value)}
              className="w-auto min-w-[160px]"
            >
              <option value="all">All buyers</option>
              {(buyers || []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
            <Select
              value={filters.hall_id || 'all'}
              onChange={(e) => setFilter('hall_id', e.target.value)}
              className="w-auto min-w-[140px]"
            >
              <option value="all">All halls</option>
              {(halls || []).map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </Select>
            <SearchInput value={search} onChange={setSearch} placeholder="Search panel code or name..." className="max-w-xs" />
          </div>
        </div>

        {loading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : panels.length === 0 ? (
          <EmptyState
            icon={<IconLayers className="w-12 h-12 text-ink-muted" />}
            title="No panels yet"
            description="Panels added by hall managers will appear here."
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
                  <Th>Hall</Th>
                  <Th>Status</Th>
                  <Th>Added</Th>
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
                    <Td className="text-ink-secondary">{p.hall?.name}</Td>
                    <Td>
                      <div className="flex flex-wrap items-center gap-1">
                        <PanelStatusBadge status={p.status} />
                        <ValidityBadge expiryDate={p.expiry_date} />
                      </div>
                    </Td>
                    <Td className="text-ink-secondary">{formatDate(p.created_at)}</Td>
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
                        <PanelStatusBadge status={p.status} />
                        <ValidityBadge expiryDate={p.expiry_date} />
                      </div>
                    }
                    meta={
                      <>
                        <span>{p.buyer?.name}</span>
                        <span>{p.hall?.name}</span>
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

      <PanelDetailDrawer open={!!selected} panel={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
