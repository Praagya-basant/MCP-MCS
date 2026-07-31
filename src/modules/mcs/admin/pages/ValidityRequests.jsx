import { useState } from 'react';
import { PageHeader } from '@/shared/components/PageHeader';
import { Card } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/shared/components/Table';
import { TableSkeleton } from '@/shared/components/Skeleton';
import { EmptyState } from '@/shared/components/EmptyState';
import { PillTabs } from '@/shared/components/PillTabs';
import { Badge } from '@/shared/components/Badge';
import { Modal } from '@/shared/components/Modal';
import { Textarea, FormField } from '@/shared/components/Input';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { useToast } from '@/shared/context/ToastContext';
import { listValidityRequests, reviewValidityRequest } from '@/modules/mcs/api/validityApi';
import { formatDate, formatDateTime } from '@/shared/utils/formatters';
import { IconHistory } from '@/shared/components/icons';

const STATUS_STYLES = {
  pending: 'bg-status-checked-out-bg text-status-checked-out-text',
  approved: 'bg-status-in-hall-bg text-status-in-hall-text',
  rejected: 'bg-status-expired-bg text-status-expired-text',
};

function extensionLabel(request) {
  if (request.requested_expiry_date) return formatDate(request.requested_expiry_date);
  if (request.requested_months) return `${request.requested_months} month(s)`;
  return '—';
}

export default function AdminValidityRequests() {
  const { data: requests, loading, setData } = useAsyncData(listValidityRequests, []);
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
      const result = await reviewValidityRequest({
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
      <PageHeader title="Validity Requests" description="Merchant-requested validity extensions." />

      <Card>
        <div className="px-4 py-3 border-b border-border">
          <PillTabs options={tabs} value={tab} onChange={setTab} />
        </div>

        {loading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<IconHistory className="w-12 h-12 text-ink-muted" />}
            title="No validity requests yet"
            description="Requests raised by merchants from a sample's drawer will appear here."
          />
        ) : filtered.length === 0 ? (
          <EmptyState title="No matches" description="Try a different tab." />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>BT Code</Th>
                <Th>Product</Th>
                <Th>Requested By</Th>
                <Th>Requested Extension</Th>
                <Th>Reason</Th>
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
                  <Td className="text-ink-secondary">{r.requested_by_profile?.full_name}</Td>
                  <Td className="text-ink-secondary">{extensionLabel(r)}</Td>
                  <Td className="text-ink-secondary max-w-[220px] truncate">{r.reason || '—'}</Td>
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
                Requested extension: {extensionLabel(reviewing.request)}
              </p>
            </div>
            <FormField label="Admin Note" htmlFor="admin-note" hint="Optional">
              <Textarea id="admin-note" value={adminNote} onChange={(e) => setAdminNote(e.target.value)} rows={2} />
            </FormField>
          </div>
        )}
      </Modal>
    </div>
  );
}
