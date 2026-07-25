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
import { StatusBadge } from '@/shared/components/Badge';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { useTableControls } from '@/shared/hooks/useTableControls';
import { listSamples } from '@/modules/mcs/api/samplesApi';
import { listMovements } from '@/modules/mcs/api/movementsApi';
import { PAGE_SIZE, SAMPLE_STATUS } from '@/shared/utils/constants';
import { IconBox } from '@/shared/components/icons';
import { formatRelativeTime } from '@/shared/utils/formatters';
import { SampleThumbnail } from '@/modules/mcs/components/SampleThumbnail';
import { SampleDetailDrawer } from '@/modules/mcs/components/SampleDetailDrawer';

export default function MerchantSamples() {
  const location = useLocation();
  const { data: samples, loading, reload } = useAsyncData(listSamples, []);
  const { data: movements, reload: reloadMovements } = useAsyncData(listMovements, []);
  const [selected, setSelected] = useState(null);

  const openDestinationMap = useMemo(() => {
    const map = {};
    (movements || []).forEach((m) => {
      if (m.status === 'out') map[m.sample_id] = m.destination;
    });
    return map;
  }, [movements]);

  const lastMovementMap = useMemo(() => {
    const map = {};
    (movements || []).forEach((m) => {
      const ts = m.status === 'out' ? m.picked_at : m.returned_at;
      if (!map[m.sample_id] || new Date(ts) > new Date(map[m.sample_id])) map[m.sample_id] = ts;
    });
    return map;
  }, [movements]);

  const rows = useMemo(
    () =>
      (samples || []).map((s) => ({
        ...s,
        location: s.status === 'checked_out' ? openDestinationMap[s.id] || 'Unknown' : `Hall ${s.hall?.hall_number}`,
        lastMovement: lastMovementMap[s.id],
      })),
    [samples, openDestinationMap, lastMovementMap]
  );

  const { search, setSearch, filters, setFilter, page, setPage, totalPages, totalCount, pageRows } =
    useTableControls(rows, {
      searchFields: ['bt_code', 'product_name'],
      initialFilters: location.state?.statusFilter ? { status: location.state.statusFilter } : undefined,
    });

  const statusTabs = useMemo(
    () => [
      { value: 'all', label: 'All', count: rows.length },
      { value: SAMPLE_STATUS.IN_HALL, label: 'In Hall', count: rows.filter((r) => r.status === SAMPLE_STATUS.IN_HALL).length },
      { value: SAMPLE_STATUS.CHECKED_OUT, label: 'Issued', count: rows.filter((r) => r.status === SAMPLE_STATUS.CHECKED_OUT).length },
    ],
    [rows]
  );

  function handleChanged() {
    reload();
    reloadMovements();
  }

  return (
    <div>
      <PageHeader title="Samples" description="Every sample you have signed into BASANT halls." />

      <Card>
        <div className="px-4 py-3 border-b border-border flex flex-wrap items-center gap-3">
          <PillTabs options={statusTabs} value={filters.status || 'all'} onChange={(v) => setFilter('status', v)} />
          <SearchInput value={search} onChange={setSearch} placeholder="Search BT code or name..." className="max-w-xs ml-auto" />
        </div>

        {loading ? (
          <TableSkeleton rows={8} cols={5} />
        ) : samples.length === 0 ? (
          <EmptyState icon={<IconBox className="w-12 h-12 text-ink-muted" />} title="No samples yet" description="Samples signed in by hall managers will appear here." />
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
                  <Th>Status</Th>
                  <Th>Location</Th>
                  <Th>Last Movement</Th>
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
                    <Td>
                      <StatusBadge status={s.status} />
                    </Td>
                    <Td className="text-ink-secondary">{s.location}</Td>
                    <Td className="text-ink-secondary">{s.lastMovement ? formatRelativeTime(s.lastMovement) : '—'}</Td>
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
