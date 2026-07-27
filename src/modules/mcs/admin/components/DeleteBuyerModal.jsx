import { useState } from 'react';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { Input, FormField } from '@/shared/components/Input';
import { deleteBuyer } from '@/modules/mcs/api/buyersApi';
import { useToast } from '@/shared/context/ToastContext';

/**
 * Deliberately harder to trigger than the standard ConfirmDialog, same
 * reasoning as ClearMovementHistoryDialog: this permanently deletes the
 * buyer, every one of their samples, and all movement/recall/comment
 * history, so typing the buyer's own name is a second explicit gate.
 * Blocked entirely (no confirm field) if any sample is currently issued —
 * checked ahead of time via buyer.issuedCount rather than only surfacing
 * the RPC's own rejection after the fact.
 */
export function DeleteBuyerModal({ open, buyer, onClose, onDeleted }) {
  const toast = useToast();
  const [confirmText, setConfirmText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function handleClose() {
    setConfirmText('');
    setError('');
    onClose();
  }

  async function handleConfirm() {
    setError('');
    setSubmitting(true);
    try {
      await deleteBuyer(buyer.id);
      toast.success('Buyer deleted');
      onDeleted?.(buyer.id);
      handleClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!buyer) return null;

  const blocked = (buyer.issuedCount || 0) > 0;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Delete Buyer"
      footer={
        blocked ? (
          <Button onClick={handleClose}>Close</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirm} loading={submitting} disabled={confirmText !== buyer.name}>
              Delete Buyer
            </Button>
          </>
        )
      }
    >
      {blocked ? (
        <p className="text-body text-ink-secondary">
          <span className="font-medium text-ink">{buyer.name}</span> has {buyer.issuedCount} sample
          {buyer.issuedCount === 1 ? '' : 's'} currently issued and can't be deleted. Return{' '}
          {buyer.issuedCount === 1 ? 'it' : 'them'} first, then try again.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-body text-ink-secondary">
            This permanently deletes <span className="font-medium text-ink">{buyer.name}</span>, all{' '}
            {buyer.sampleCount} of their sample{buyer.sampleCount === 1 ? '' : 's'}, and all associated movement
            history. This cannot be undone.
          </p>

          <FormField label={`Type "${buyer.name}" to confirm`} htmlFor="confirm-delete-buyer" error={error}>
            <Input
              id="confirm-delete-buyer"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={buyer.name}
              autoFocus
            />
          </FormField>
        </div>
      )}
    </Modal>
  );
}
