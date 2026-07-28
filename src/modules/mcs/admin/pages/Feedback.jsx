import { useState } from 'react';
import { PageHeader } from '@/shared/components/PageHeader';
import { Card } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/shared/components/Table';
import { TableSkeleton } from '@/shared/components/Skeleton';
import { EmptyState } from '@/shared/components/EmptyState';
import { SearchInput } from '@/shared/components/SearchInput';
import { Pagination } from '@/shared/components/Pagination';
import { Badge, RoleBadge } from '@/shared/components/Badge';
import { Drawer } from '@/shared/components/Drawer';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { useTableControls } from '@/shared/hooks/useTableControls';
import { listFeedback, markFeedbackRead } from '@/shared/lib/feedbackApi';
import { useFeedback } from '@/shared/context/FeedbackContext';
import { PAGE_SIZE, ROLE_LABELS } from '@/shared/utils/constants';
import { IconMessage } from '@/shared/components/icons';
import { formatDateTime } from '@/shared/utils/formatters';

function previewOf(message) {
  if (!message) return '';
  return message.length > 80 ? `${message.slice(0, 80)}…` : message;
}

export default function AdminFeedback() {
  const { data: feedback, loading, error, setData } = useAsyncData(listFeedback, []);
  const { refresh: refreshUnreadBadge } = useFeedback() || {};
  const [selected, setSelected] = useState(null);
  const [marking, setMarking] = useState(false);

  const rows = feedback || [];

  const { search, setSearch, page, setPage, totalPages, totalCount, pageRows } = useTableControls(rows, {
    searchFields: ['subject', 'message'],
  });

  function patchLocal(updated) {
    setData((prev) => (prev || []).map((f) => (f.id === updated.id ? updated : f)));
    setSelected((prev) => (prev && prev.id === updated.id ? updated : prev));
  }

  async function handleMarkRead(item) {
    setMarking(true);
    try {
      const updated = await markFeedbackRead(item.id);
      patchLocal(updated);
      refreshUnreadBadge?.();
    } finally {
      setMarking(false);
    }
  }

  return (
    <div>
      <PageHeader title="Feedback" description="Messages sent in by managers and merchants." />

      <Card>
        <div className="px-4 py-3 border-b border-border">
          <SearchInput value={search} onChange={setSearch} placeholder="Search subject or message..." className="max-w-xs" />
        </div>

        {loading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : error ? (
          <EmptyState
            icon={<IconMessage className="w-12 h-12 text-ink-muted" />}
            title="Couldn't load feedback"
            description={error.message}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<IconMessage className="w-12 h-12 text-ink-muted" />}
            title="No feedback yet"
            description="Messages sent from the sidebar's Send Feedback button will appear here."
          />
        ) : pageRows.length === 0 ? (
          <EmptyState title="No matches" description="Try a different search term." />
        ) : (
          <>
            <Table>
              <Thead>
                <Tr>
                  <Th>From</Th>
                  <Th>Role</Th>
                  <Th>Subject</Th>
                  <Th>Message</Th>
                  <Th>Date</Th>
                  <Th>Status</Th>
                </Tr>
              </Thead>
              <Tbody>
                {pageRows.map((f) => (
                  <Tr key={f.id} onClick={() => setSelected(f)}>
                    <Td className="font-medium">{f.sender?.full_name || 'Unknown'}</Td>
                    <Td>
                      <RoleBadge role={f.sender?.role} label={ROLE_LABELS[f.sender?.role] || f.sender?.role} />
                    </Td>
                    <Td className={f.is_read ? 'text-ink-secondary' : 'font-medium'}>{f.subject}</Td>
                    <Td className="text-ink-secondary max-w-[280px] truncate">{previewOf(f.message)}</Td>
                    <Td className="text-ink-secondary whitespace-nowrap">{formatDateTime(f.created_at)}</Td>
                    <Td>
                      {f.is_read ? (
                        <Badge>Read</Badge>
                      ) : (
                        <Badge className="bg-status-checked-out-bg text-status-checked-out-text">Unread</Badge>
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

      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected?.subject}>
        {selected && (
          <div className="flex flex-col h-full min-h-0">
            <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-body font-medium text-ink">{selected.sender?.full_name || 'Unknown'}</p>
                  <p className="mt-0.5 text-caption text-ink-secondary">{formatDateTime(selected.created_at)}</p>
                </div>
                <RoleBadge role={selected.sender?.role} label={ROLE_LABELS[selected.sender?.role] || selected.sender?.role} />
              </div>

              <p className="text-body text-ink whitespace-pre-wrap">{selected.message}</p>
            </div>

            <div className="px-6 py-4 border-t border-border shrink-0 flex items-center justify-between gap-2">
              {selected.is_read ? (
                <Badge>Read</Badge>
              ) : (
                <Badge className="bg-status-checked-out-bg text-status-checked-out-text">Unread</Badge>
              )}
              {!selected.is_read && (
                <Button size="sm" onClick={() => handleMarkRead(selected)} loading={marking}>
                  Mark as Read
                </Button>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
