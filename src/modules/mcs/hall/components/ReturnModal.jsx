import { useEffect, useState } from 'react';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { Skeleton } from '@/shared/components/Skeleton';
import { getOpenMovementForSample, returnSample } from '@/modules/mcs/api/movementsApi';
import { useToast } from '@/shared/context/ToastContext';
import { formatDateTime } from '@/shared/utils/formatters';

export function ReturnModal({ open, onClose, sample, onSuccess }) {
  const toast = useToast();
  const [movement, setMovement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !sample) return;
    setLoading(true);
    setError('');
    getOpenMovementForSample(sample.id)
      .then(setMovement)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [open, sample]);

  function handleClose() {
    setMovement(null);
    setError('');
    onClose();
  }

  async function handleConfirm() {
    setSubmitting(true);
    setError('');
    try {
      await returnSample({ movement, sample });
      toast.success(`${sample.bt_code} marked as returned`);
      onSuccess?.();
      handleClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!sample) return null;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Confirm Return"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} loading={submitting} disabled={loading || !movement}>
            Confirm Return
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-control bg-surface-subtle px-3 py-2.5">
          <p className="text-body font-medium text-ink">{sample.bt_code}</p>
          <p className="text-caption text-ink-secondary">{sample.product_name} · {sample.buyer?.name}</p>
        </div>

        {loading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : movement ? (
          <dl className="grid grid-cols-2 gap-y-2 text-body">
            <dt className="text-ink-secondary">Picked by</dt>
            <dd className="text-ink">{movement.picked_by_name}</dd>
            <dt className="text-ink-secondary">Destination</dt>
            <dd className="text-ink">{movement.destination}</dd>
            <dt className="text-ink-secondary">Checked out</dt>
            <dd className="text-ink">{formatDateTime(movement.picked_at)}</dd>
            <dt className="text-ink-secondary">Return time</dt>
            <dd className="text-ink">Now (auto-timestamped)</dd>
          </dl>
        ) : (
          <p className="text-body text-ink-secondary">No active checkout found for this sample.</p>
        )}

        {error && <p className="text-caption text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
