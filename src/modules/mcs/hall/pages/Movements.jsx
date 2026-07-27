import { useMemo, useState } from 'react';
import { PageHeader } from '@/shared/components/PageHeader';
import { Card } from '@/shared/components/Card';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/shared/components/Table';
import { TableSkeleton } from '@/shared/components/Skeleton';
import { EmptyState } from '@/shared/components/EmptyState';
import { SearchInput } from '@/shared/components/SearchInput';
import { Pagination } from '@/shared/components/Pagination';
import { Select } from '@/shared/components/Input';
import { DateRangeFilter } from '@/shared/components/DateRangeFilter';
import { Badge } from '@/shared/components/Badge';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { useTableControls } from '@/shared/hooks/useTableControls';
import { listMovements } from '@/modules/mcs/api/movementsApi';
import { PAGE_SIZE, REASON_OPTIONS } from '@/shared/utils/constants';
import { IconMove } from '@/shared/components/icons';
import { formatDateTime } from '@/shared/utils/formatters';

export default function HallMovements() {
  const { data: movements, loading } = useAsyncData(listMovements, []);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

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

  const { search, setSearch, filters, setFilter, page, setPage, totalPages, totalCount, pageRows } =
    useTableControls(dateFiltered, {
      searchFields: ['bt_code', 'product_name', 'picked_by_name'],
      initialSort: { key: 'picked_at', dir: 'desc' },
    });

  return (
    <div>
      <PageHeader title="Movements" description="Movement log for your hall." />

      <Card>
        <div className="px-4 py-3 border-b border-border flex flex-wrap items-center gap-2">
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
        ) : movements.length === 0 ? (
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
                    <Td>{m.picked_by_name}</Td>
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
