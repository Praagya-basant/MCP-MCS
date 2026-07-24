import { PageHeader } from '@/shared/components/PageHeader';
import { Card } from '@/shared/components/Card';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/shared/components/Table';
import { TableSkeleton } from '@/shared/components/Skeleton';
import { EmptyState } from '@/shared/components/EmptyState';
import { SearchInput } from '@/shared/components/SearchInput';
import { Pagination } from '@/shared/components/Pagination';
import { Select } from '@/shared/components/Input';
import { StatusBadge } from '@/shared/components/Badge';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { useTableControls } from '@/shared/hooks/useTableControls';
import { listSamples } from '@/modules/mcs/api/samplesApi';
import { listBuyers } from '@/modules/mcs/api/buyersApi';
import { listHalls } from '@/modules/mcs/api/hallsApi';
import { PAGE_SIZE, SAMPLE_STATUS, SAMPLE_STATUS_LABELS } from '@/shared/utils/constants';
import { IconBox } from '@/shared/components/icons';
import { formatDate } from '@/shared/utils/formatters';

export default function AdminSamples() {
  const { data: samples, loading } = useAsyncData(listSamples, []);
  const { data: buyers } = useAsyncData(listBuyers, []);
  const { data: halls } = useAsyncData(listHalls, []);

  const { search, setSearch, filters, setFilter, page, setPage, totalPages, totalCount, pageRows } =
    useTableControls(samples || [], { searchFields: ['bt_code', 'product_name'] });

  return (
    <div>
      <PageHeader title="Samples" description="Every signed sample across every hall." />

      <Card>
        <div className="px-4 py-3 border-b border-border flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Search BT code or name..." className="max-w-xs" />
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
                Hall {h.hall_number}
              </option>
            ))}
          </Select>
          <Select
            value={filters.status || 'all'}
            onChange={(e) => setFilter('status', e.target.value)}
            className="w-auto min-w-[140px]"
          >
            <option value="all">All statuses</option>
            {Object.values(SAMPLE_STATUS).map((s) => (
              <option key={s} value={s}>
                {SAMPLE_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>

        {loading ? (
          <TableSkeleton rows={8} cols={6} />
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
                  <Th>BT Code</Th>
                  <Th>Product</Th>
                  <Th>Buyer</Th>
                  <Th>Hall</Th>
                  <Th>Status</Th>
                  <Th>Added</Th>
                </Tr>
              </Thead>
              <Tbody>
                {pageRows.map((s) => (
                  <Tr key={s.id}>
                    <Td className="font-medium">{s.bt_code}</Td>
                    <Td>{s.product_name}</Td>
                    <Td className="text-ink-secondary">{s.buyer?.name}</Td>
                    <Td className="text-ink-secondary">Hall {s.hall?.hall_number}</Td>
                    <Td>
                      <StatusBadge status={s.status} />
                    </Td>
                    <Td className="text-ink-secondary">{formatDate(s.created_at)}</Td>
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
