import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PageHeader } from '@/core/components/PageHeader';
import { Card } from '@/core/components/Card';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/core/components/Table';
import { TableSkeleton } from '@/core/components/Skeleton';
import { EmptyState } from '@/core/components/EmptyState';
import { SearchInput } from '@/core/components/SearchInput';
import { Pagination } from '@/core/components/Pagination';
import { PillTabs } from '@/core/components/PillTabs';
import { Select } from '@/core/components/Input';
import { Button } from '@/core/components/Button';
import { PanelStatusBadge, ValidityBadge, Badge } from '@/core/components/Badge';
import { useAsyncData } from '@/core/hooks/useAsyncData';
import { useTableControls } from '@/core/hooks/useTableControls';
import { listPanels } from '@/modules/mcp/api/panelsApi';
import { listPanelMovements } from '@/modules/mcp/api/panelMovementsApi';
import { listBuyers } from '@/core/lib/buyersApi';
import { listHalls } from '@/core/lib/hallsApi';
import { PAGE_SIZE, PANEL_STATUS } from '@/core/utils/constants';
import { IconLayers, IconCamera, IconDownload } from '@/core/components/icons';
import { formatDate, getPanelDisplayStatus } from '@/core/utils/formatters';
import { exportToExcel } from '@/core/lib/excelExport';
import { useToast } from '@/core/context/ToastContext';
import { PanelThumbnail } from '@/modules/mcp/components/PanelThumbnail';
import { PanelDetailDrawer } from '@/modules/mcp/components/PanelDetailDrawer';
import { PanelImageModal } from '@/modules/mcp/components/PanelImageModal';
import { useOpenPanelFromLocation } from '@/modules/mcp/hooks/useOpenPanelFromLocation';

export default function AdminPanels() {
  const location = useLocation();
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const { data: panels, loading, reload } = useAsyncData(listPanels, []);
  const { data: movements, reload: reloadMovements } = useAsyncData(listPanelMovements, []);
  const { data: buyers } = useAsyncData(listBuyers, []);
  const { data: halls } = useAsyncData(listHalls, []);
  const [selected, setSelected] = useState(null);
  const [imagePanel, setImagePanel] = useState(null);
  useOpenPanelFromLocation(panels, setSelected);

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

  const { search, setSearch, filters, setFilter, page, setPage, totalPages, totalCount, pageRows, filteredRows } =
    useTableControls(rows, {
      searchFields: ['panel_code', 'panel_name'],
      initialFilters: location.state?.statusFilter ? { status: location.state.statusFilter } : undefined,
    });

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

  function handleImageSaved() {
    reload();
  }

  async function handleExport() {
    setExporting(true);
    try {
      await exportToExcel(
        [
          {
            sheetName: 'Panels',
            rows: filteredRows.map((p) => ({
              'Panel Code': p.panel_code,
              'Panel Name': p.panel_name,
              Buyer: p.is_shared ? 'Shared' : p.buyer?.name || '',
              Hall: p.hall?.name || '',
              Status: p.status === 'checked_out' || p.status === 'issued' ? 'Issued' : p.status === 'retired' ? 'Retired' : 'In Hall',
              'Added On': formatDate(p.created_at),
            })),
          },
        ],
        `basant-ssm-panels-${Date.now()}.xlsx`,
        { title: 'BASANT SSM — Panels' }
      );
      toast.success('Export downloaded');
    } catch (err) {
      toast.error(err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Panels"
        description="Every signed panel across every hall."
        actions={
          <Button variant="secondary" onClick={handleExport} loading={exporting}>
            <IconDownload className="w-4 h-4" />
            Export
          </Button>
        }
      />

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
        ) : (panels || []).length === 0 ? (
          <EmptyState
            icon={<IconLayers className="w-12 h-12 text-ink-muted" />}
            title="No panels yet"
            description="Panels added by hall managers will appear here."
          />
        ) : pageRows.length === 0 ? (
          <EmptyState title="No matches" description="Try adjusting your search or filters." />
        ) : (
          <>
            <Table>
              <Thead>
                <Tr>
                  <Th className="w-[64px]"></Th>
                  <Th>Panel Code</Th>
                  <Th>Name</Th>
                  <Th>Buyer</Th>
                  <Th>Hall</Th>
                  <Th>Status</Th>
                  <Th>Added</Th>
                  <Th></Th>
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
                        <PanelStatusBadge status={p.displayStatus} />
                        <ValidityBadge expiryDate={p.expiry_date} />
                      </div>
                    </Td>
                    <Td className="text-ink-secondary">{formatDate(p.created_at)}</Td>
                    <Td className="text-right whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="Upload panel image"
                        onClick={(e) => {
                          e.stopPropagation();
                          setImagePanel(p);
                        }}
                      >
                        <IconCamera className="w-4 h-4" />
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>

            <Pagination page={page} totalPages={totalPages} totalCount={totalCount} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </Card>

      <PanelDetailDrawer open={!!selected} panel={selected} onClose={() => setSelected(null)} onChanged={handleChanged} />

      <PanelImageModal
        open={!!imagePanel}
        panel={imagePanel}
        onClose={() => setImagePanel(null)}
        onSaved={handleImageSaved}
      />
    </div>
  );
}
