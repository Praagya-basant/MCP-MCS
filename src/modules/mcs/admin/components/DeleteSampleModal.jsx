import { useState } from 'react';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { deleteSample } from '@/modules/mcs/api/samplesApi';
import { useToast } from '@/shared/context/ToastContext';

/**
 * Blocked entirely (no confirm action offered) while the sample is
 * checked out — deleting it would orphan an open movement with no
 * sample to return, so the RPC also rejects this server-side, but the UI
 * catches it earlier with a clearer explanation.
 */
export function DeleteSampleModal({ open, sample, onClose, onDeleted }) {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function handleClose() {
    setError('');
    onClose();
  }

  async function handleConfirm() {
    setError('');
    setSubmitting(true);
    try {
      await deleteSample(sample.id);
      toast.success('Sample deleted');
      onDeleted?.(sample.id);
      handleClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!sample) return null;

  const blocked = sample.status === 'checked_out';

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Delete Sample"
      footer={
        blocked ? (
          <Button onClick={handleClose}>Close</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirm} loading={submitting}>
              Delete Sample
            </Button>
          </>
        )
      }
    >
      {blocked ? (
        <p className="text-body text-ink-secondary">
          <span className="font-mono text-ink font-medium">{sample.bt_code}</span> is currently issued and can't be
          deleted. Return it first, then try again.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-body text-ink-secondary">
            Permanently delete <span className="font-mono text-ink font-medium">{sample.bt_code}</span> (
            {sample.product_name})? This also deletes its full movement history. This can't be undone.
          </p>
          {error && <p className="text-caption text-red-600">{error}</p>}
        </div>
      )}
    </Modal>
  );
}
