import { useMemo, useState } from 'react';
import { PageHeader } from '@/shared/components/PageHeader';
import { Card } from '@/shared/components/Card';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/shared/components/Table';
import { TableSkeleton } from '@/shared/components/Skeleton';
import { EmptyState } from '@/shared/components/EmptyState';
import { SearchInput } from '@/shared/components/SearchInput';
import { Pagination } from '@/shared/components/Pagination';
import { Select, Input } from '@/shared/components/Input';
import { Badge } from '@/shared/components/Badge';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { useTableControls } from '@/shared/hooks/useTableControls';
import { listMovements } from '@/modules/mcs/api/movementsApi';
import { listBuyers } from '@/modules/mcs/api/buyersApi';
import { listHalls } from '@/modules/mcs/api/hallsApi';
import { PAGE_SIZE, REASON_OPTIONS } from '@/shared/utils/constants';
import { IconMove, IconTrash } from '@/shared/components/icons';
import { formatDateTime } from '@/shared/utils/formatters';
import { Button } from '@/shared/components/Button';
import { ClearMovementHistoryDialog } from '@/modules/mcs/admin/components/ClearMovementHistoryDialog';

export default function AdminMovements() {
  const { data: movements, loading, reload } = useAsyncData(listMovements, []);
  const { data: buyers } = useAsyncData(listBuyers, []);
  const { data: halls } = useAsyncData(listHalls, []);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [clearOpen, setClearOpen] = useState(false);

  const flatRows = useMemo(
    () =>
      (movements || []).map((m) => ({
        ...m,
        bt_code: m.sample?.bt_code,
        product_name: m.sample?.product_name,
        buyer_id: m.sample?.buyer_id,
        buyer_name: m.sample?.buyer?.name,
        hall_id: m.sample?.hall_id,
        hall_number: m.sample?.hall?.hall_number,
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
      <PageHeader title="Movements" description="Full checkout and return log across every hall." />

      <Card>
        <div className="px-4 py-3 border-b border-border flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Search BT code or picker..." className="max-w-xs" />
          <Select value={filters.hall_id || 'all'} onChange={(e) => setFilter('hall_id', e.target.value)} className="w-auto min-w-[140px]">
            <option value="all">All halls</option>
            {(halls || []).map((h) => (
              <option key={h.id} value={h.id}>
                Hall {h.hall_number}
              </option>
            ))}
          </Select>
          <Select value={filters.buyer_id || 'all'} onChange={(e) => setFilter('buyer_id', e.target.value)} className="w-auto min-w-[160px]">
            <option value="all">All buyers</option>
            {(buyers || []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <Select value={filters.reason || 'all'} onChange={(e) => setFilter('reason', e.target.value)} className="w-auto min-w-[140px]">
            <option value="all">All reasons</option>
            {REASON_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="w-auto"
          />
          <span className="text-ink-muted text-caption">to</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="w-auto"
          />
        </div>

        {loading ? (
          <TableSkeleton rows={8} cols={7} />
        ) : movements.length === 0 ? (
          <EmptyState icon={<IconMove className="w-12 h-12 text-ink-muted" />} title="No movements yet" description="Checkouts and returns will be logged here." />
        ) : pageRows.length === 0 ? (
          <EmptyState title="No matches" description="Try adjusting your search or filters." />
        ) : (
          <>
            <Table>
              <Thead>
                <Tr>
                  <Th>BT Code</Th>
                  <Th>Buyer</Th>
                  <Th>Hall</Th>
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
                    <Td className="text-ink-secondary">Hall {m.hall_number}</Td>
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

      <div className="mt-8 bg-white border border-red-200 rounded-card shadow-card px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-red-500 shrink-0">
            <IconTrash className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-body-lg font-semibold text-ink">Clear Test Data</h2>
            <p className="mt-0.5 text-body text-ink-secondary max-w-md">
              Permanently deletes every movement record across every hall and buyer. Use this to
              wipe test checkouts/returns before going live — it cannot be undone.
            </p>
          </div>
        </div>
        <Button variant="danger" onClick={() => setClearOpen(true)} disabled={loading || movements?.length === 0}>
          Clear Test Data
        </Button>
      </div>

      <ClearMovementHistoryDialog open={clearOpen} onClose={() => setClearOpen(false)} onCleared={reload} />
    </div>
  );
}
