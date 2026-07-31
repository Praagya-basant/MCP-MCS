import { useMemo, useState } from 'react';
import { PageHeader } from '@/shared/components/PageHeader';
import { Card } from '@/shared/components/Card';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/shared/components/Table';
import { CardList, CardListItem } from '@/shared/components/CardList';
import { TableSkeleton } from '@/shared/components/Skeleton';
import { EmptyState } from '@/shared/components/EmptyState';
import { SearchInput } from '@/shared/components/SearchInput';
import { PillTabs } from '@/shared/components/PillTabs';
import { PanelStatusBadge, ValidityBadge, Badge } from '@/shared/components/Badge';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { listPanels } from '@/modules/mcp/api/panelsApi';
import { PANEL_STATUS } from '@/shared/utils/constants';
import { IconLayers } from '@/shared/components/icons';
import { PanelThumbnail } from '@/modules/mcp/components/PanelThumbnail';
import { PanelDetailDrawer } from '@/modules/mcp/components/PanelDetailDrawer';

export default function MerchantPanels() {
  const { data: panels, loading } = useAsyncData(listPanels, []);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  const rows = useMemo(() => panels || [], [panels]);

  const statusTabs = useMemo(
    () => [
      { value: 'all', label: 'All', count: rows.length },
      { value: PANEL_STATUS.IN_HALL, label: 'In Hall', count: rows.filter((p) => p.status === PANEL_STATUS.IN_HALL).length },
      { value: PANEL_STATUS.ISSUED, label: 'Issued', count: rows.filter((p) => p.status === PANEL_STATUS.ISSUED).length },
    ],
    [rows]
  );

  const filteredRows = useMemo(() => {
    let result = rows;
    if (status !== 'all') result = result.filter((p) => p.status === status);
    const q = search.trim().toLowerCase();
    if (q) result = result.filter((p) => p.panel_code?.toLowerCase().includes(q) || p.panel_name?.toLowerCase().includes(q));
    return result;
  }, [rows, status, search]);

  const groups = useMemo(() => {
    const byHall = new Map();
    filteredRows.forEach((p) => {
      const key = p.hall_id || 'unknown';
      if (!byHall.has(key)) byHall.set(key, { hall: p.hall, rows: [] });
      byHall.get(key).rows.push(p);
    });
    return Array.from(byHall.values()).sort((a, b) => (a.hall?.hall_number ?? 999) - (b.hall?.hall_number ?? 999));
  }, [filteredRows]);

  return (
    <div>
      <PageHeader title="Panels" description="Every panel available to you across BASANT halls." />

      <Card>
        <div className="px-4 py-3 border-b border-border flex flex-wrap items-center gap-3">
          <PillTabs options={statusTabs} value={status} onChange={setStatus} />
          <SearchInput value={search} onChange={setSearch} placeholder="Search panel code or name..." className="max-w-xs ml-auto" />
        </div>

        {loading ? (
          <TableSkeleton rows={8} cols={4} />
        ) : rows.length === 0 ? (
          <EmptyState icon={<IconLayers className="w-12 h-12 text-ink-muted" />} title="No panels yet" description="Panels signed in by hall managers will appear here." />
        ) : filteredRows.length === 0 ? (
          <EmptyState title="No matches" description="Try adjusting your search or filters." />
        ) : (
          groups.map((group) => (
            <div key={group.hall?.id || 'unknown'} className="border-b border-border last:border-b-0">
              <div className="px-4 py-2.5 bg-surface-subtle">
                <p className="text-caption font-medium text-ink-secondary">
                  {group.hall?.name || 'Unassigned'} — {group.rows.length} panel{group.rows.length === 1 ? '' : 's'}
                </p>
              </div>
              <Table className="hidden md:table">
                <Thead>
                  <Tr>
                    <Th className="w-[64px]"></Th>
                    <Th>Panel Code</Th>
                    <Th>Name</Th>
                    <Th>Status</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {group.rows.map((p) => (
                    <Tr key={p.id} onClick={() => setSelected(p)}>
                      <Td>
                        <PanelThumbnail panel={p} />
                      </Td>
                      <Td className="font-medium font-mono">{p.panel_code}</Td>
                      <Td>
                        {p.panel_name}
                        {p.is_shared && <Badge className="ml-1.5">Shared</Badge>}
                      </Td>
                      <Td>
                        <div className="flex flex-wrap items-center gap-1">
                          <PanelStatusBadge status={p.status} />
                          <ValidityBadge expiryDate={p.expiry_date} />
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>

              <div className="md:hidden p-3">
                <CardList>
                  {group.rows.map((p) => (
                    <CardListItem
                      key={p.id}
                      onClick={() => setSelected(p)}
                      leading={<PanelThumbnail panel={p} />}
                      title={<span className="font-mono">{p.panel_code}</span>}
                      subtitle={p.panel_name}
                      trailing={
                        <div className="flex flex-col items-end gap-1">
                          <PanelStatusBadge status={p.status} />
                          <ValidityBadge expiryDate={p.expiry_date} />
                        </div>
                      }
                    />
                  ))}
                </CardList>
              </div>
            </div>
          ))
        )}
      </Card>

      <PanelDetailDrawer open={!!selected} panel={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
