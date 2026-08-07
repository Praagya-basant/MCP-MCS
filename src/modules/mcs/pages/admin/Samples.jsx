import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PageHeader } from '@/core/components/PageHeader';
import { Card } from '@/core/components/Card';
import { Button } from '@/core/components/Button';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/core/components/Table';
import { TableSkeleton } from '@/core/components/Skeleton';
import { EmptyState } from '@/core/components/EmptyState';
import { SearchInput } from '@/core/components/SearchInput';
import { Pagination } from '@/core/components/Pagination';
import { PillTabs } from '@/core/components/PillTabs';
import { Select } from '@/core/components/Input';
import { StatusBadge, ValidityBadge } from '@/core/components/Badge';
import { useAsyncData } from '@/core/hooks/useAsyncData';
import { useTableControls } from '@/core/hooks/useTableControls';
import { listSamples } from '@/modules/mcs/api/samplesApi';
import { listMovements } from '@/modules/mcs/api/movementsApi';
import { listBuyers } from '@/core/lib/buyersApi';
import { listHalls } from '@/core/lib/hallsApi';
import { PAGE_SIZE, SAMPLE_STATUS } from '@/core/utils/constants';
import { IconBox, IconCamera, IconLayers, IconUpload, IconTrash, IconDownload } from '@/core/components/icons';
import { formatDate, getSampleDisplayStatus } from '@/core/utils/formatters';
import { exportToExcel } from '@/core/lib/excelExport';
import { useToast } from '@/core/context/ToastContext';
import { SampleThumbnail } from '@/modules/mcs/components/SampleThumbnail';
import { SampleDetailDrawer } from '@/modules/mcs/components/SampleDetailDrawer';
import { SampleImageModal } from '@/modules/mcs/components/SampleImageModal';
import { BulkImageUploadModal } from '@/modules/mcs/pages/admin/components/BulkImageUploadModal';
import { EditSampleHallModal } from '@/modules/mcs/pages/admin/components/EditSampleHallModal';
import { DeleteSampleModal } from '@/modules/mcs/pages/admin/components/DeleteSampleModal';
import { useOpenSampleFromLocation } from '@/modules/mcs/hooks/useOpenSampleFromLocation';

export default function AdminSamples() {
  const location = useLocation();
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const { data: samples, loading, reload, setData } = useAsyncData(listSamples, []);
  const { data: movements, reload: reloadMovements } = useAsyncData(listMovements, []);
  const { data: buyers } = useAsyncData(listBuyers, []);
  const { data: halls } = useAsyncData(listHalls, []);
  const [selected, setSelected] = useState(null);
  const [imageSample, setImageSample] = useState(null);
  const [hallSample, setHallSample] = useState(null);
  const [sampleToDelete, setSampleToDelete] = useState(null);
  const [bulkImageOpen, setBulkImageOpen] = useState(false);
  useOpenSampleFromLocation(samples, setSelected);

  const openHopMap = useMemo(() => {
    const map = {};
    (movements || []).forEach((m) => {
      if (m.status === 'out') map[m.sample_id] = m.hop_number;
    });
    return map;
  }, [movements]);

  const rows = useMemo(
    () => (samples || []).map((s) => ({ ...s, displayStatus: getSampleDisplayStatus(s.status, openHopMap[s.id]) })),
    [samples, openHopMap]
  );

  function handleImageSaved(updated) {
    setData((prev) => (prev || []).map((s) => (s.id === updated.id ? updated : s)));
  }

  function handleBulkImagesUploaded(updatedList) {
    setData((prev) => {
      const map = new Map(updatedList.map((s) => [s.id, s]));
      return (prev || []).map((s) => map.get(s.id) || s);
    });
  }

  function handleSampleDeleted(deletedId) {
    setData((prev) => (prev || []).filter((s) => s.id !== deletedId));
  }

  const { search, setSearch, filters, setFilter, sort, toggleSort, page, setPage, totalPages, totalCount, pageRows, filteredRows } =
    useTableControls(rows, {
      searchFields: ['bt_code', 'product_name'],
      initialFilters: location.state?.statusFilter ? { status: location.state.statusFilter } : undefined,
    });

  const statusTabs = useMemo(
    () => [
      { value: 'all', label: 'All', count: rows.length },
      {
        value: SAMPLE_STATUS.IN_HALL,
        label: 'In Hall',
        count: rows.filter((r) => r.status === SAMPLE_STATUS.IN_HALL).length,
      },
      {
        value: SAMPLE_STATUS.CHECKED_OUT,
        label: 'Issued',
        count: rows.filter((r) => r.status === SAMPLE_STATUS.CHECKED_OUT).length,
      },
    ],
    [rows]
  );

  function handleChanged() {
    reload();
    reloadMovements();
  }

  async function handleExport() {
    setExporting(true);
    try {
      await exportToExcel(
        [
          {
            sheetName: 'Samples',
            rows: filteredRows.map((s) => ({
              'BT Code': s.bt_code,
              'Product Name': s.product_name,
              Buyer: s.buyer?.name || '',
              Hall: s.hall?.name || '',
              Status: s.status === 'checked_out' ? 'Issued' : 'In Hall',
              'Added On': formatDate(s.created_at),
            })),
          },
        ],
        `basant-ssm-samples-${Date.now()}.xlsx`,
        { title: 'BASANT SSM — Samples' }
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
        title="Samples"
        description="Every signed sample across every hall."
        actions={
          <>
            <Button variant="secondary" onClick={handleExport} loading={exporting}>
              <IconDownload className="w-4 h-4" />
              Export
            </Button>
            <Button variant="secondary" onClick={() => setBulkImageOpen(true)}>
              <IconUpload className="w-4 h-4" />
              Upload Images
            </Button>
          </>
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
            <SearchInput value={search} onChange={setSearch} placeholder="Search BT code or name..." className="max-w-xs" />
          </div>
        </div>

        {loading ? (
          <TableSkeleton rows={8} cols={7} />
        ) : samples.length === 0 ? (
          <EmptyState
            icon={<IconBox className="w-12 h-12 text-ink-muted" />}
            title="No samples yet"
            description="Samples added by hall managers will appear here."
          />
        ) : pageRows.length === 0 ? (
          <EmptyState title="No matches" description="Try adjusting your search or filters." />
        ) : (
          <>
            <Table>
              <Thead>
                <Tr>
                  <Th className="w-[64px]"></Th>
                  <Th sortable active={sort?.key === 'bt_code'} dir={sort?.dir} onClick={() => toggleSort('bt_code')}>
                    BT Code
                  </Th>
                  <Th sortable active={sort?.key === 'product_name'} dir={sort?.dir} onClick={() => toggleSort('product_name')}>
                    Product
                  </Th>
                  <Th>Buyer</Th>
                  <Th>Hall</Th>
                  <Th>Status</Th>
                  <Th sortable active={sort?.key === 'created_at'} dir={sort?.dir} onClick={() => toggleSort('created_at')}>
                    Added
                  </Th>
                  <Th></Th>
                </Tr>
              </Thead>
              <Tbody>
                {pageRows.map((s) => (
                  <Tr key={s.id} onClick={() => setSelected(s)}>
                    <Td>
                      <SampleThumbnail sample={s} />
                    </Td>
                    <Td className="font-medium font-mono">{s.bt_code}</Td>
                    <Td>{s.product_name}</Td>
                    <Td className="text-ink-secondary">{s.buyer?.name}</Td>
                    <Td className="text-ink-secondary">{s.hall?.name}</Td>
                    <Td>
                      <div className="flex flex-wrap items-center gap-1">
                        <StatusBadge status={s.displayStatus} />
                        <ValidityBadge expiryDate={s.expiry_date} />
                      </div>
                    </Td>
                    <Td className="text-ink-secondary">{formatDate(s.created_at)}</Td>
                    <Td className="text-right whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="Upload sample image"
                        onClick={(e) => {
                          e.stopPropagation();
                          setImageSample(s);
                        }}
                      >
                        <IconCamera className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="Edit sample hall"
                        onClick={(e) => {
                          e.stopPropagation();
                          setHallSample(s);
                        }}
                      >
                        <IconLayers className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="Delete sample"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSampleToDelete(s);
                        }}
                      >
                        <IconTrash className="w-4 h-4" />
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

      <SampleDetailDrawer open={!!selected} sample={selected} onClose={() => setSelected(null)} onChanged={handleChanged} />

      <SampleImageModal
        open={!!imageSample}
        sample={imageSample}
        onClose={() => setImageSample(null)}
        onSaved={handleImageSaved}
      />

      <EditSampleHallModal
        open={!!hallSample}
        sample={hallSample}
        onClose={() => setHallSample(null)}
        onSaved={handleImageSaved}
      />

      <BulkImageUploadModal
        open={bulkImageOpen}
        samples={samples}
        onClose={() => setBulkImageOpen(false)}
        onUploaded={handleBulkImagesUploaded}
      />

      <DeleteSampleModal
        open={!!sampleToDelete}
        sample={sampleToDelete}
        onClose={() => setSampleToDelete(null)}
        onDeleted={handleSampleDeleted}
      />
    </div>
  );
}
