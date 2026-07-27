import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PageHeader } from '@/shared/components/PageHeader';
import { Card } from '@/shared/components/Card';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/shared/components/Table';
import { TableSkeleton } from '@/shared/components/Skeleton';
import { EmptyState } from '@/shared/components/EmptyState';
import { SearchInput } from '@/shared/components/SearchInput';
import { Pagination } from '@/shared/components/Pagination';
import { PillTabs } from '@/shared/components/PillTabs';
import { Select } from '@/shared/components/Input';
import { StatusBadge } from '@/shared/components/Badge';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { useTableControls } from '@/shared/hooks/useTableControls';
import { listSamples } from '@/modules/mcs/api/samplesApi';
import { listBuyers } from '@/modules/mcs/api/buyersApi';
import { listHalls } from '@/modules/mcs/api/hallsApi';
import { PAGE_SIZE, SAMPLE_STATUS } from '@/shared/utils/constants';
import { IconBox } from '@/shared/components/icons';
import { formatDate } from '@/shared/utils/formatters';
import { SampleThumbnail } from '@/modules/mcs/components/SampleThumbnail';
import { SampleDetailDrawer } from '@/modules/mcs/components/SampleDetailDrawer';
import { useOpenSampleFromLocation } from '@/modules/mcs/hooks/useOpenSampleFromLocation';

export default function AdminSamples() {
  const location = useLocation();
  const { data: samples, loading, reload } = useAsyncData(listSamples, []);
  const { data: buyers } = useAsyncData(listBuyers, []);
  const { data: halls } = useAsyncData(listHalls, []);
  const [selected, setSelected] = useState(null);
  useOpenSampleFromLocation(samples, setSelected);

  const { search, setSearch, filters, setFilter, page, setPage, totalPages, totalCount, pageRows } =
    useTableControls(samples || [], {
      searchFields: ['bt_code', 'product_name'],
      initialFilters: location.state?.statusFilter ? { status: location.state.statusFilter } : undefined,
    });

  const statusTabs = useMemo(
    () => [
      { value: 'all', label: 'All', count: (samples || []).length },
      {
        value: SAMPLE_STATUS.IN_HALL,
        label: 'In Hall',
        count: (samples || []).filter((r) => r.status === SAMPLE_STATUS.IN_HALL).length,
      },
      {
        value: SAMPLE_STATUS.CHECKED_OUT,
        label: 'Issued',
        count: (samples || []).filter((r) => r.status === SAMPLE_STATUS.CHECKED_OUT).length,
      },
    ],
    [samples]
  );

  function handleChanged() {
    reload();
  }

  return (
    <div>
      <PageHeader title="Samples" description="Every signed sample across every hall." />

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
                  <Tr key={s.id} onClick={() => setSelected(s)}>
                    <Td>
                      <SampleThumbnail sample={s} />
                    </Td>
                    <Td className="font-medium font-mono">{s.bt_code}</Td>
                    <Td>{s.product_name}</Td>
                    <Td className="text-ink-secondary">{s.buyer?.name}</Td>
                    <Td className="text-ink-secondary">{s.hall?.name}</Td>
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

      <SampleDetailDrawer open={!!selected} sample={selected} onClose={() => setSelected(null)} onChanged={handleChanged} />
    </div>
  );
}
