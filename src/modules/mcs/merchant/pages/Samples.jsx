import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PageHeader } from '@/shared/components/PageHeader';
import { Card } from '@/shared/components/Card';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/shared/components/Table';
import { CardList, CardListItem } from '@/shared/components/CardList';
import { TableSkeleton } from '@/shared/components/Skeleton';
import { EmptyState } from '@/shared/components/EmptyState';
import { SearchInput } from '@/shared/components/SearchInput';
import { PillTabs } from '@/shared/components/PillTabs';
import { StatusBadge, ValidityBadge } from '@/shared/components/Badge';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { listSamples } from '@/modules/mcs/api/samplesApi';
import { listMovements } from '@/modules/mcs/api/movementsApi';
import { SAMPLE_STATUS } from '@/shared/utils/constants';
import { IconBox } from '@/shared/components/icons';
import { formatRelativeTime, getSampleDisplayStatus } from '@/shared/utils/formatters';
import { SampleThumbnail } from '@/modules/mcs/components/SampleThumbnail';
import { SampleDetailDrawer } from '@/modules/mcs/components/SampleDetailDrawer';
import { useOpenSampleFromLocation } from '@/modules/mcs/hooks/useOpenSampleFromLocation';

export default function MerchantSamples() {
  const location = useLocation();
  const { data: samples, loading, reload } = useAsyncData(listSamples, []);
  const { data: movements, reload: reloadMovements } = useAsyncData(listMovements, []);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(location.state?.statusFilter || 'all');
  useOpenSampleFromLocation(samples, setSelected);

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

  const openHopMap = useMemo(() => {
    const map = {};
    (movements || []).forEach((m) => {
      if (m.status === 'out') map[m.sample_id] = m.hop_number;
    });
    return map;
  }, [movements]);

  const rows = useMemo(
    () =>
      (samples || []).map((s) => ({
        ...s,
        location: s.status === 'checked_out' ? openDestinationMap[s.id] || 'Unknown' : s.hall?.name,
        lastMovement: lastMovementMap[s.id],
        displayStatus: getSampleDisplayStatus(s.status, openHopMap[s.id]),
      })),
    [samples, openDestinationMap, lastMovementMap, openHopMap]
  );

  const statusTabs = useMemo(
    () => [
      { value: 'all', label: 'All', count: rows.length },
      { value: SAMPLE_STATUS.IN_HALL, label: 'In Hall', count: rows.filter((r) => r.status === SAMPLE_STATUS.IN_HALL).length },
      { value: SAMPLE_STATUS.CHECKED_OUT, label: 'Issued', count: rows.filter((r) => r.status === SAMPLE_STATUS.CHECKED_OUT).length },
    ],
    [rows]
  );

  const filteredRows = useMemo(() => {
    let result = rows;
    if (status !== 'all') result = result.filter((r) => r.status === status);
    const q = search.trim().toLowerCase();
    if (q) result = result.filter((r) => r.bt_code?.toLowerCase().includes(q) || r.product_name?.toLowerCase().includes(q));
    return result;
  }, [rows, status, search]);

  const groups = useMemo(() => {
    const byHall = new Map();
    filteredRows.forEach((r) => {
      const key = r.hall_id || 'unknown';
      if (!byHall.has(key)) byHall.set(key, { hall: r.hall, rows: [] });
      byHall.get(key).rows.push(r);
    });
    return Array.from(byHall.values()).sort((a, b) => (a.hall?.hall_number ?? 999) - (b.hall?.hall_number ?? 999));
  }, [filteredRows]);

  function handleChanged() {
    reload();
    reloadMovements();
  }

  return (
    <div>
      <PageHeader title="Samples" description="Every sample you have signed into BASANT halls." />

      <Card>
        <div className="px-4 py-3 border-b border-border flex flex-wrap items-center gap-3">
          <PillTabs options={statusTabs} value={status} onChange={setStatus} />
          <SearchInput value={search} onChange={setSearch} placeholder="Search BT code or name..." className="max-w-xs ml-auto" />
        </div>

        {loading ? (
          <TableSkeleton rows={8} cols={5} />
        ) : samples.length === 0 ? (
          <EmptyState icon={<IconBox className="w-12 h-12 text-ink-muted" />} title="No samples yet" description="Samples signed in by hall managers will appear here." />
        ) : filteredRows.length === 0 ? (
          <EmptyState title="No matches" description="Try adjusting your search or filters." />
        ) : (
          groups.map((group) => (
            <div key={group.hall?.id || 'unknown'} className="border-b border-border last:border-b-0">
              <div className="px-4 py-2.5 bg-surface-subtle">
                <p className="text-caption font-medium text-ink-secondary">
                  {group.hall?.name || 'Unassigned'} — {group.rows.length} sample{group.rows.length === 1 ? '' : 's'}
                </p>
              </div>
              <Table className="hidden md:table">
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
                  {group.rows.map((s) => (
                    <Tr key={s.id} onClick={() => setSelected(s)}>
                      <Td>
                        <SampleThumbnail sample={s} />
                      </Td>
                      <Td className="font-medium font-mono">{s.bt_code}</Td>
                      <Td>{s.product_name}</Td>
                      <Td>
                        <div className="flex flex-wrap items-center gap-1">
                          <StatusBadge status={s.displayStatus} />
                          <ValidityBadge expiryDate={s.expiry_date} />
                        </div>
                      </Td>
                      <Td className="text-ink-secondary">{s.location}</Td>
                      <Td className="text-ink-secondary">{s.lastMovement ? formatRelativeTime(s.lastMovement) : '—'}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>

              <div className="md:hidden p-3">
                <CardList>
                  {group.rows.map((s) => (
                    <CardListItem
                      key={s.id}
                      onClick={() => setSelected(s)}
                      leading={<SampleThumbnail sample={s} size="md" />}
                      title={<span className="font-mono">{s.bt_code}</span>}
                      subtitle={s.product_name}
                      trailing={
                        <div className="flex flex-col items-end gap-1">
                          <StatusBadge status={s.displayStatus} />
                          <ValidityBadge expiryDate={s.expiry_date} />
                        </div>
                      }
                      meta={
                        <>
                          <span>{s.location}</span>
                          <span>{s.lastMovement ? formatRelativeTime(s.lastMovement) : 'No movement yet'}</span>
                        </>
                      }
                    />
                  ))}
                </CardList>
              </div>
            </div>
          ))
        )}
      </Card>

      <SampleDetailDrawer open={!!selected} sample={selected} onClose={() => setSelected(null)} onChanged={handleChanged} />
    </div>
  );
}
