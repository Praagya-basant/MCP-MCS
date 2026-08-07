import { useMemo, useState } from 'react';
import { PageHeader } from '@/core/components/PageHeader';
import { Card } from '@/core/components/Card';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/core/components/Table';
import { TableSkeleton } from '@/core/components/Skeleton';
import { EmptyState } from '@/core/components/EmptyState';
import { SearchInput } from '@/core/components/SearchInput';
import { Select } from '@/core/components/Input';
import { Pagination } from '@/core/components/Pagination';
import { useAsyncData } from '@/core/hooks/useAsyncData';
import { useTableControls } from '@/core/hooks/useTableControls';
import { supabase } from '@/core/lib/supabaseClient';
import { PAGE_SIZE } from '@/core/utils/constants';
import { IconHistory } from '@/core/components/icons';
import { formatDateTime } from '@/core/utils/formatters';

async function listAuditLog() {
  const { data, error } = await supabase
    .from('audit_log')
    .select('*, actor:profiles(id, full_name, email)')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return data;
}

/** Every action logged via core/lib/auditLog.js's logAuditEvent() — admin-only (audit_log_select_admin RLS), filterable by actor and action. */
export default function AuditLog() {
  const { data: rows, loading } = useAsyncData(listAuditLog, []);
  const [actionFilter, setActionFilter] = useState('all');

  const flatRows = useMemo(() => (rows || []).map((r) => ({ ...r, actor_name: r.actor?.full_name || 'Unknown' })), [rows]);

  const actions = useMemo(() => Array.from(new Set(flatRows.map((r) => r.action))).sort(), [flatRows]);

  const filteredByAction = useMemo(
    () => (actionFilter === 'all' ? flatRows : flatRows.filter((r) => r.action === actionFilter)),
    [flatRows, actionFilter]
  );

  const { search, setSearch, page, setPage, totalPages, totalCount, pageRows } = useTableControls(filteredByAction, {
    searchFields: ['actor_name', 'action'],
  });

  return (
    <div>
      <PageHeader title="Audit Log" description="Every logged admin action, most recent first." />

      <Card>
        <div className="px-4 py-3 border-b border-border flex flex-wrap items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by actor or action..." className="max-w-xs" />
          <Select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="w-auto min-w-[160px]">
            <option value="all">All actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        </div>

        {loading ? (
          <TableSkeleton rows={8} cols={4} />
        ) : flatRows.length === 0 ? (
          <EmptyState icon={<IconHistory className="w-12 h-12 text-ink-muted" />} title="No activity yet" description="Logged admin actions will appear here." />
        ) : pageRows.length === 0 ? (
          <EmptyState title="No matches" description="Try adjusting your search or filters." />
        ) : (
          <>
            <Table>
              <Thead>
                <Tr>
                  <Th>Actor</Th>
                  <Th>Action</Th>
                  <Th>Details</Th>
                  <Th className="text-right">Date</Th>
                </Tr>
              </Thead>
              <Tbody>
                {pageRows.map((r) => (
                  <Tr key={r.id}>
                    <Td className="font-medium">{r.actor_name}</Td>
                    <Td className="text-ink-secondary font-mono text-[13px]">{r.action}</Td>
                    <Td className="text-ink-secondary text-[13px] truncate max-w-xs">
                      {r.details && Object.keys(r.details).length > 0 ? JSON.stringify(r.details) : '—'}
                    </Td>
                    <Td className="text-right text-ink-secondary text-[13px] whitespace-nowrap">{formatDateTime(r.created_at)}</Td>
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
