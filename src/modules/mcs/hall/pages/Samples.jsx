import { useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PageHeader } from '@/shared/components/PageHeader';
import { Card } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
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
import { IconBox, IconPlus } from '@/shared/components/icons';
import { formatRelativeTime } from '@/shared/utils/formatters';
import { SampleThumbnail } from '@/modules/mcs/components/SampleThumbnail';
import { SampleDetailDrawer } from '@/modules/mcs/components/SampleDetailDrawer';

export default function HallSamples() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: samples, loading, reload } = useAsyncData(listSamples, []);
  const { data: movements, reload: reloadMovements } = useAsyncData(listMovements, []);
  const [selected, setSelected] = useState(null);

  const lastMovementMap = useMemo(() => {
    const map = {};
    (movements || []).forEach((m) => {
      const ts = m.status === 'out' ? m.picked_at : m.returned_at;
      if (!map[m.sample_id] || new Date(ts) > new Date(map[m.sample_id])) {
        map[m.sample_id] = ts;
      }
    });
    return map;
  }, [movements]);

  const rows = useMemo(
    () => (samples || []).map((s) => ({ ...s, buyer_name: s.buyer?.name, lastMovement: lastMovementMap[s.id] })),
    [samples, lastMovementMap]
  );

  const { search, setSearch, filters, setFilter, page, setPage, totalPages, totalCount, pageRows } =
    useTableControls(rows, {
      searchFields: ['bt_code', 'product_name', 'buyer_name'],
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
      <PageHeader
        title="Samples"
        description="Samples signed into your hall."
        actions={
          <Button onClick={() => navigate('/hall/add-sample')}>
            <IconPlus className="w-4 h-4" />
            Add Sample
          </Button>
        }
      />

      <Card>
        <div className="px-4 py-3 border-b border-border flex flex-wrap items-center gap-3">
          <PillTabs options={statusTabs} value={filters.status || 'all'} onChange={(v) => setFilter('status', v)} />
          <SearchInput value={search} onChange={setSearch} placeholder="Search BT code, name, buyer..." className="max-w-xs ml-auto" />
        </div>

        {loading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : samples.length === 0 ? (
          <EmptyState
            icon={<IconBox className="w-12 h-12 text-ink-muted" />}
            title="No samples yet"
            description="Add your first sample to start tracking it."
            actionLabel="Add Sample"
            onAction={() => navigate('/hall/add-sample')}
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
                  <Th>Status</Th>
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
                    <Td className="text-ink-secondary">{s.buyer_name}</Td>
                    <Td>
                      <StatusBadge status={s.status} />
                    </Td>
                    <Td className="text-ink-secondary">
                      {s.lastMovement ? formatRelativeTime(s.lastMovement) : '—'}
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
    </div>
  );
}
