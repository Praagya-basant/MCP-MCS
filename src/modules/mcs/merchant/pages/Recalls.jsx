import { useState } from 'react';
import { PageHeader } from '@/shared/components/PageHeader';
import { Card } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/shared/components/Table';
import { TableSkeleton } from '@/shared/components/Skeleton';
import { EmptyState } from '@/shared/components/EmptyState';
import { RecallStatusBadge } from '@/shared/components/Badge';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { listRecalls } from '@/modules/mcs/api/recallsApi';
import { listSamples } from '@/modules/mcs/api/samplesApi';
import { IconAlert, IconPlus } from '@/shared/components/icons';
import { formatDateTime } from '@/shared/utils/formatters';
import { RaiseRecallModal } from '@/modules/mcs/merchant/components/RaiseRecallModal';

export default function Recalls() {
  const { data: recalls, loading, setData } = useAsyncData(listRecalls, []);
  const { data: samples } = useAsyncData(listSamples, []);
  const [modalOpen, setModalOpen] = useState(false);

  function handleCreated(recall) {
    setData((prev) => [recall, ...(prev || [])]);
  }

  return (
    <div>
      <PageHeader
        title="Recall Requests"
        description="Ask a hall manager to return a checked-out sample."
        actions={
          <Button onClick={() => setModalOpen(true)}>
            <IconPlus className="w-4 h-4" />
            Raise Recall
          </Button>
        }
      />

      <Card>
        {loading ? (
          <TableSkeleton rows={5} cols={4} />
        ) : recalls.length === 0 ? (
          <EmptyState
            icon={<IconAlert className="w-12 h-12 text-ink-muted" />}
            title="No recall requests"
            description="Raise a recall to ask a hall manager to return a sample early."
            actionLabel="Raise Recall"
            onAction={() => setModalOpen(true)}
          />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>BT Code</Th>
                <Th>Reason</Th>
                <Th>Status</Th>
                <Th>Requested</Th>
              </Tr>
            </Thead>
            <Tbody>
              {recalls.map((r) => (
                <Tr key={r.id}>
                  <Td className="font-medium">{r.sample?.bt_code}</Td>
                  <Td className="text-ink-secondary">{r.reason || '—'}</Td>
                  <Td>
                    <RecallStatusBadge status={r.status} />
                  </Td>
                  <Td className="text-ink-secondary">{formatDateTime(r.created_at)}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Card>

      <RaiseRecallModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        samples={(samples || []).filter((s) => s.status === 'checked_out')}
        onCreated={handleCreated}
      />
    </div>
  );
}
