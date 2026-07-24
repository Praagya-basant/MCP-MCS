import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/shared/components/PageHeader';
import { Card } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
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
import { listMovements } from '@/modules/mcs/api/movementsApi';
import { PAGE_SIZE, SAMPLE_STATUS, SAMPLE_STATUS_LABELS } from '@/shared/utils/constants';
import { IconBox, IconPlus } from '@/shared/components/icons';
import { formatRelativeTime } from '@/shared/utils/formatters';
import { CheckoutModal } from '@/modules/mcs/hall/components/CheckoutModal';
import { ReturnModal } from '@/modules/mcs/hall/components/ReturnModal';

export default function HallSamples() {
  const navigate = useNavigate();
  const { data: samples, loading, reload } = useAsyncData(listSamples, []);
  const { data: movements, reload: reloadMovements } = useAsyncData(listMovements, []);
  const [checkoutSample, setCheckoutSample] = useState(null);
  const [returnSample, setReturnSample] = useState(null);

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
    useTableControls(rows, { searchFields: ['bt_code', 'product_name', 'buyer_name'] });

  function handleActionSuccess() {
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
        <div className="px-4 py-3 border-b border-border flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Search BT code, name, buyer..." className="max-w-xs" />
          <Select value={filters.status || 'all'} onChange={(e) => setFilter('status', e.target.value)} className="w-auto min-w-[140px]">
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
                  <Th>BT Code</Th>
                  <Th>Product</Th>
                  <Th>Buyer</Th>
                  <Th>Status</Th>
                  <Th>Last Movement</Th>
                  <Th>Action</Th>
                </Tr>
              </Thead>
              <Tbody>
                {pageRows.map((s) => (
                  <Tr key={s.id}>
                    <Td className="font-medium">{s.bt_code}</Td>
                    <Td>{s.product_name}</Td>
                    <Td className="text-ink-secondary">{s.buyer_name}</Td>
                    <Td>
                      <StatusBadge status={s.status} />
                    </Td>
                    <Td className="text-ink-secondary">
                      {s.lastMovement ? formatRelativeTime(s.lastMovement) : '—'}
                    </Td>
                    <Td>
                      {s.status === SAMPLE_STATUS.IN_HALL ? (
                        <Button size="sm" variant="secondary" onClick={() => setCheckoutSample(s)}>
                          Check Out
                        </Button>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => setReturnSample(s)}>
                          Return
                        </Button>
                      )}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
            <Pagination page={page} totalPages={totalPages} totalCount={totalCount} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </Card>

      <CheckoutModal
        open={!!checkoutSample}
        sample={checkoutSample}
        onClose={() => setCheckoutSample(null)}
        onSuccess={handleActionSuccess}
      />
      <ReturnModal
        open={!!returnSample}
        sample={returnSample}
        onClose={() => setReturnSample(null)}
        onSuccess={handleActionSuccess}
      />
    </div>
  );
}
