import { useMemo, useState } from 'react';
import { PageHeader } from '@/core/components/PageHeader';
import { Card } from '@/core/components/Card';
import { Button } from '@/core/components/Button';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/core/components/Table';
import { TableSkeleton } from '@/core/components/Skeleton';
import { EmptyState } from '@/core/components/EmptyState';
import { SearchInput } from '@/core/components/SearchInput';
import { Pagination } from '@/core/components/Pagination';
import { Select } from '@/core/components/Input';
import { DateRangeFilter } from '@/core/components/DateRangeFilter';
import { Badge } from '@/core/components/Badge';
import { useAsyncData } from '@/core/hooks/useAsyncData';
import { useTableControls } from '@/core/hooks/useTableControls';
import { useAuth } from '@/core/auth/AuthContext';
import { useToast } from '@/core/context/ToastContext';
import { listMovements } from '@/modules/mcs/api/movementsApi';
import { exportToExcel } from '@/core/lib/excelExport';
import { PAGE_SIZE, REASON_OPTIONS } from '@/core/utils/constants';
import { IconMove, IconDownload } from '@/core/components/icons';
import { PickerAvatar } from '@/core/components/PickerAvatar';
import { formatDateTime } from '@/core/utils/formatters';

function movementsToRows(rows) {
  return rows.map((m) => ({
    'BT Code': m.bt_code,
    'Product Name': m.product_name,
    Buyer: m.buyer_name,
    'Picked By': m.picked_by_name,
    Reason: m.reason === 'Other' ? m.reason_other || 'Other' : m.reason,
    Status: m.status === 'returned' ? 'Returned' : 'Issued',
    'Picked At': formatDateTime(m.picked_at),
    'Returned At': m.status === 'returned' ? formatDateTime(m.returned_at) : '',
  }));
}

export default function HallMovements() {
  const { profile } = useAuth();
  const toast = useToast();
  const { data: movements, loading } = useAsyncData(listMovements, []);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [exporting, setExporting] = useState(false);

  const flatRows = useMemo(
    () =>
      (movements || []).map((m) => ({
        ...m,
        bt_code: m.sample?.bt_code,
        product_name: m.sample?.product_name,
        buyer_name: m.sample?.buyer?.name,
      })),
    [movements]
  );

  const dateFiltered = useMemo(
    () =>
      flatRows.filter((r) => {
        if (dateFrom && new Date(r.picked_at) < new Date(dateFrom)) return false;
        if (dateTo && new Date(r.picked_at) > new Date(`${dateTo}T23:59:59`)) return false;
        return true;
      }),
    [flatRows, dateFrom, dateTo]
  );

  const { search, setSearch, filters, setFilter, page, setPage, totalPages, totalCount, pageRows, filteredRows } =
    useTableControls(dateFiltered, {
      searchFields: ['bt_code', 'product_name', 'picked_by_name'],
      initialSort: { key: 'picked_at', dir: 'desc' },
    });

  async function handleExport() {
    setExporting(true);
    try {
      await exportToExcel(
        [{ sheetName: 'Movements', rows: movementsToRows(filteredRows) }],
        `basant-ssm-${profile?.hall?.name?.replace(/[^a-z0-9]+/gi, '_') || 'hall'}-movements.xlsx`,
        { title: 'BASANT SSM — Hall Movements', subtitle: profile?.hall?.name || '' }
      );
      toast.success('Export downloaded');
    } catch {
      toast.error('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Movements"
        description="Movement log for your hall."
        actions={
          <Button variant="secondary" onClick={handleExport} loading={exporting} disabled={loading || !movements?.length}>
            <IconDownload className="w-4 h-4" />
            Export
          </Button>
        }
      />

      <Card>
        <div className="sticky top-16 z-[1] bg-card px-4 py-3 border-b border-border flex flex-wrap items-center gap-2 rounded-t-card shadow-sm">
          <SearchInput value={search} onChange={setSearch} placeholder="Search BT code or picker..." className="max-w-xs" />
          <Select value={filters.reason || 'all'} onChange={(e) => setFilter('reason', e.target.value)} className="w-auto min-w-[140px]">
            <option value="all">All reasons</option>
            {REASON_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
          <DateRangeFilter
            from={dateFrom}
            to={dateTo}
            onFromChange={(v) => {
              setDateFrom(v);
              setPage(1);
            }}
            onToChange={(v) => {
              setDateTo(v);
              setPage(1);
            }}
          />
        </div>

        {loading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : (movements || []).length === 0 ? (
          <EmptyState icon={<IconMove className="w-12 h-12 text-ink-muted" />} title="No movements yet" description="Movements for your hall will be logged here." />
        ) : pageRows.length === 0 ? (
          <EmptyState title="No matches" description="Try adjusting your search or filters." />
        ) : (
          <>
            <Table>
              <Thead>
                <Tr>
                  <Th>BT Code</Th>
                  <Th>Buyer</Th>
                  <Th>Picked By</Th>
                  <Th>Reason</Th>
                  <Th className="text-right">Picked At</Th>
                  <Th className="text-right">Returned At</Th>
                </Tr>
              </Thead>
              <Tbody>
                {pageRows.map((m) => (
                  <Tr key={m.id}>
                    <Td className="font-medium">{m.bt_code}</Td>
                    <Td className="text-ink-secondary">{m.buyer_name}</Td>
                    <Td>
                      <PickerAvatar name={m.picked_by_name} />
                    </Td>
                    <Td>
                      <Badge>{m.reason === 'Other' ? m.reason_other || 'Other' : m.reason}</Badge>
                    </Td>
                    <Td className="text-right text-ink-secondary text-[13px] whitespace-nowrap">{formatDateTime(m.picked_at)}</Td>
                    <Td className="text-right text-ink-secondary text-[13px] whitespace-nowrap">{m.status === 'returned' ? formatDateTime(m.returned_at) : '—'}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
            <Pagination page={page} totalPages={totalPages} totalCount={totalCount} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
