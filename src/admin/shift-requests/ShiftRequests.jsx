import { useState } from 'react';
import { PageHeader } from '@/core/components/PageHeader';
import { Card } from '@/core/components/Card';
import { Button } from '@/core/components/Button';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/core/components/Table';
import { TableSkeleton } from '@/core/components/Skeleton';
import { EmptyState } from '@/core/components/EmptyState';
import { PillTabs } from '@/core/components/PillTabs';
import { Badge } from '@/core/components/Badge';
import { Modal } from '@/core/components/Modal';
import { Textarea, FormField } from '@/core/components/Input';
import { useAsyncData } from '@/core/hooks/useAsyncData';
import { useToast } from '@/core/context/ToastContext';
import { listShiftRequests, reviewShiftRequest } from '@/core/lib/shiftRequestsApi';
import { formatDateTime } from '@/core/utils/formatters';
import { IconLayers } from '@/core/components/icons';

const STATUS_STYLES = {
  pending: 'bg-status-checked-out-bg text-status-checked-out-text',
  approved: 'bg-status-in-hall-bg text-status-in-hall-text',
  rejected: 'bg-status-expired-bg text-status-expired-text',
};

export default function AdminShiftRequests() {
  const { data: requests, loading, setData } = useAsyncData(listShiftRequests, []);
  const toast = useToast();
  const [tab, setTab] = useState('pending');
  const [reviewing, setReviewing] = useState(null); // { request, approve }
  const [adminNote, setAdminNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const rows = requests || [];
  const filtered = tab === 'all' ? rows : rows.filter((r) => r.status === tab);

  const tabs = [
    { value: 'pending', label: 'Pending', count: rows.filter((r) => r.status === 'pending').length },
    { value: 'approved', label: 'Approved', count: rows.filter((r) => r.status === 'approved').length },
    { value: 'rejected', label: 'Rejected', count: rows.filter((r) => r.status === 'rejected').length },
    { value: 'all', label: 'All', count: rows.length },
  ];

  function openReview(request, approve) {
    setReviewing({ request, approve });
    setAdminNote('');
  }

  async function handleConfirmReview() {
    if (!reviewing) return;
    setSubmitting(true);
    try {
      const result = await reviewShiftRequest({
        request: reviewing.request,
        approve: reviewing.approve,
        adminNote: adminNote.trim(),
      });
      setData((prev) => (prev || []).map((r) => (r.id === result.id ? { ...result, sample: reviewing.request.sample } : r)));
      toast.success(reviewing.approve ? 'Request approved' : 'Request rejected');
      setReviewing(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader title="Shift Requests" description="Manager/merchant-requested hall reassignments." />

      <Card>
        <div className="px-4 py-3 border-b border-border">
          <PillTabs options={tabs} value={tab} onChange={setTab} />
        </div>

        {loading ? (
          <TableSkeleton rows={6} cols={7} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<IconLayers className="w-12 h-12 text-ink-muted" />}
            title="No shift requests yet"
            description="Requests raised by hall managers or merchants from a sample's drawer will appear here."
          />
        ) : filtered.length === 0 ? (
          <EmptyState title="No matches" description="Try a different tab." />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>BT Code</Th>
                <Th>Product</Th>
                <Th>From</Th>
                <Th>To</Th>
                <Th>Requested By</Th>
                <Th>Date</Th>
                <Th>Status</Th>
                <Th></Th>
              </Tr>
            </Thead>
            <Tbody>
              {filtered.map((r) => (
                <Tr key={r.id}>
                  <Td className="font-medium font-mono">{r.sample?.bt_code || '—'}</Td>
                  <Td>{r.sample?.product_name || '—'}</Td>
                  <Td className="text-ink-secondary">{r.from_hall?.name}</Td>
                  <Td className="text-ink-secondary">{r.to_hall?.name}</Td>
                  <Td className="text-ink-secondary">{r.requested_by_profile?.full_name}</Td>
                  <Td className="text-ink-secondary whitespace-nowrap">{formatDateTime(r.created_at)}</Td>
                  <Td>
                    <Badge className={STATUS_STYLES[r.status]}>{r.status[0].toUpperCase() + r.status.slice(1)}</Badge>
                  </Td>
                  <Td className="text-right whitespace-nowrap">
                    {r.status === 'pending' && (
                      <>
                        <Button size="sm" variant="success" onClick={() => openReview(r, true)}>
                          Approve
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openReview(r, false)}>
                          Reject
                        </Button>
                      </>
                    )}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Card>

      <Modal
        open={!!reviewing}
        onClose={() => setReviewing(null)}
        title={reviewing?.approve ? 'Approve Request' : 'Reject Request'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setReviewing(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant={reviewing?.approve ? 'success' : 'danger'}
              onClick={handleConfirmReview}
              loading={submitting}
            >
              {reviewing?.approve ? 'Approve' : 'Reject'}
            </Button>
          </>
        }
      >
        {reviewing && (
          <div className="flex flex-col gap-4">
            <div className="rounded-control bg-surface-subtle px-3 py-2.5">
              <p className="text-body font-medium text-ink font-mono">{reviewing.request.sample?.bt_code}</p>
              <p className="text-caption text-ink-secondary">
                {reviewing.request.from_hall?.name} → {reviewing.request.to_hall?.name}
              </p>
              {reviewing.request.note && (
                <p className="mt-1 text-caption text-ink-secondary">Note: {reviewing.request.note}</p>
              )}
            </div>
            <FormField label="Admin Note" htmlFor="shift-admin-note" hint="Optional">
              <Textarea id="shift-admin-note" value={adminNote} onChange={(e) => setAdminNote(e.target.value)} rows={2} />
            </FormField>
          </div>
        )}
      </Modal>
    </div>
  );
}
