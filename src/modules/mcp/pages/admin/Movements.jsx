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
import { Drawer } from '@/core/components/Drawer';
import { PanelThumbnail } from '@/modules/mcp/components/PanelThumbnail';
import { useAsyncData } from '@/core/hooks/useAsyncData';
import { useTableControls } from '@/core/hooks/useTableControls';
import { listPanelMovements } from '@/modules/mcp/api/panelMovementsApi';
import { listBuyers } from '@/core/lib/buyersApi';
import { listHalls } from '@/core/lib/hallsApi';
import { PAGE_SIZE, REASON_OPTIONS } from '@/core/utils/constants';
import { IconMove } from '@/core/components/icons';
import { formatDateTime } from '@/core/utils/formatters';

function pickedByLabel(m) {
  return m.picked_by_name || m.logged_by_profile?.full_name || '—';
}

function reasonLabel(m) {
  return m.reason === 'Other' ? m.reason_other || 'Other' : m.reason;
}

function MovementStatusBadge({ status }) {
  return status === 'returned' ? (
    <Badge className="bg-status-in-hall-bg text-status-in-hall-text">Returned</Badge>
  ) : (
    <Badge className="bg-status-checked-out-bg text-status-checked-out-text">Issued</Badge>
  );
}

/** Mirrors MCS's AdminMovements — see that file for the field-by-field rationale. */
export default function AdminPanelMovements() {
  const { data: movements, loading, error } = useAsyncData(listPanelMovements, []);
  const { data: buyers } = useAsyncData(listBuyers, []);
  const { data: halls } = useAsyncData(listHalls, []);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState(null);

  const flatRows = useMemo(
    () =>
      (movements || []).map((m) => ({
        ...m,
        panel_code: m.panel?.panel_code,
        panel_name: m.panel?.panel_name,
        buyer_id: m.panel?.buyer_id,
        buyer_name: m.panel?.buyer?.name,
        hall_id: m.panel?.hall_id,
        hall_name: m.panel?.hall?.name,
        picked_by_label: pickedByLabel(m),
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
      searchFields: ['panel_code', 'panel_name', 'picked_by_label'],
      initialSort: { key: 'picked_at', dir: 'desc' },
    });

  return (
    <div>
      <PageHeader title="Panel Movements" description="Full panel movement log across every hall." />

      <Card>
        <div className="px-4 py-3 border-b border-border flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Search panel code or picker..." className="max-w-xs" />
          <Select value={filters.hall_id || 'all'} onChange={(e) => setFilter('hall_id', e.target.value)} className="w-auto min-w-[140px]">
            <option value="all">All halls</option>
            {(halls || []).map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
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
          <TableSkeleton rows={8} cols={8} />
        ) : error ? (
          <EmptyState icon={<IconMove className="w-12 h-12 text-ink-muted" />} title="Couldn't load movements" description={error.message} />
        ) : (movements || []).length === 0 ? (
          <EmptyState icon={<IconMove className="w-12 h-12 text-ink-muted" />} title="No movements yet" description="Panel movements will be logged here." />
        ) : pageRows.length === 0 ? (
          <EmptyState title="No matches" description="Try adjusting your search or filters." />
        ) : (
          <>
            <Table>
              <Thead>
                <Tr>
                  <Th>Panel Code</Th>
                  <Th>Buyer</Th>
                  <Th>Hall</Th>
                  <Th>Picked By</Th>
                  <Th>Reason</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Picked At</Th>
                  <Th className="text-right">Returned At</Th>
                </Tr>
              </Thead>
              <Tbody>
                {pageRows.map((m) => (
                  <Tr key={m.id} onClick={() => setSelected(m)}>
                    <Td className="font-medium font-mono">{m.panel_code}</Td>
                    <Td className="text-ink-secondary">{m.buyer_name}</Td>
                    <Td className="text-ink-secondary">{m.hall_name}</Td>
                    <Td>{m.picked_by_label}</Td>
                    <Td>
                      <Badge>{reasonLabel(m)}</Badge>
                    </Td>
                    <Td>
                      <MovementStatusBadge status={m.status} />
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

      <Drawer open={!!selected} onClose={() => setSelected(null)} title="Movement Details">
        {selected && (
          <div className="flex flex-col h-full min-h-0">
            <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5 flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <PanelThumbnail panel={selected.panel} />
                <div className="min-w-0">
                  <p className="text-body font-medium font-mono text-ink truncate">{selected.panel_code}</p>
                  <p className="text-caption text-ink-secondary truncate">{selected.panel_name}</p>
                </div>
                <div className="ml-auto shrink-0">
                  <MovementStatusBadge status={selected.status} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <p className="text-caption text-ink-muted">Buyer</p>
                  <p className="text-body text-ink">{selected.buyer_name || '—'}</p>
                </div>
                <div>
                  <p className="text-caption text-ink-muted">Hall</p>
                  <p className="text-body text-ink">{selected.hall_name || '—'}</p>
                </div>
                <div>
                  <p className="text-caption text-ink-muted">Picked By</p>
                  <p className="text-body text-ink">{selected.picked_by_label}</p>
                </div>
                <div>
                  <p className="text-caption text-ink-muted">Logged By</p>
                  <p className="text-body text-ink">{selected.logged_by_profile?.full_name || '—'}</p>
                </div>
                <div>
                  <p className="text-caption text-ink-muted">Destination</p>
                  <p className="text-body text-ink">{selected.destination || '—'}</p>
                </div>
                <div>
                  <p className="text-caption text-ink-muted">Reason</p>
                  <p className="text-body text-ink">{reasonLabel(selected)}</p>
                </div>
                <div>
                  <p className="text-caption text-ink-muted">Picked At</p>
                  <p className="text-body text-ink">{formatDateTime(selected.picked_at)}</p>
                </div>
                <div>
                  <p className="text-caption text-ink-muted">Returned At</p>
                  <p className="text-body text-ink">{selected.status === 'returned' ? formatDateTime(selected.returned_at) : '—'}</p>
                </div>
              </div>

              {selected.notes && (
                <div>
                  <p className="text-caption text-ink-muted mb-1">Notes</p>
                  <p className="text-body text-ink whitespace-pre-wrap">{selected.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
