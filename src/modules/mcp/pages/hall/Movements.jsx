import { useMemo, useState } from 'react';
import { PageHeader } from '@/core/components/PageHeader';
import { Card } from '@/core/components/Card';
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
import { listPanelMovements } from '@/modules/mcp/api/panelMovementsApi';
import { PAGE_SIZE, REASON_OPTIONS } from '@/core/utils/constants';
import { IconMove } from '@/core/components/icons';
import { formatDateTime } from '@/core/utils/formatters';

/** Mirrors MCS's HallMovements — see that file for the field-by-field rationale. */
export default function HallPanelMovements() {
  const { data: movements, loading } = useAsyncData(listPanelMovements, []);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const flatRows = useMemo(
    () =>
      (movements || []).map((m) => ({
        ...m,
        panel_code: m.panel?.panel_code,
        panel_name: m.panel?.panel_name,
        buyer_name: m.panel?.buyer?.name,
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
      searchFields: ['panel_code', 'panel_name', 'picked_by_name'],
      initialSort: { key: 'picked_at', dir: 'desc' },
    });

  return (
    <div>
      <PageHeader title="Panel Movements" description="Panel movement log for your hall." />

      <Card>
        <div className="px-4 py-3 border-b border-border flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Search panel code or picker..." className="max-w-xs" />
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
          <EmptyState icon={<IconMove className="w-12 h-12 text-ink-muted" />} title="No movements yet" description="Panel movements for your hall will be logged here." />
        ) : pageRows.length === 0 ? (
          <EmptyState title="No matches" description="Try adjusting your search or filters." />
        ) : (
          <>
            <Table>
              <Thead>
                <Tr>
                  <Th>Panel Code</Th>
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
                    <Td className="font-medium font-mono">{m.panel_code}</Td>
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
