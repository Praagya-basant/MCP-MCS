import { useState } from 'react';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { Input, FormField } from '@/shared/components/Input';
import { clearMovementHistory } from '@/modules/mcs/api/movementsApi';
import { useToast } from '@/shared/context/ToastContext';

const CONFIRM_WORD = 'DELETE';

/**
 * Deliberately harder to trigger than the standard ConfirmDialog — this
 * permanently deletes every movement row (and resets any issued samples
 * back to "In Hall" in the process). Typing the confirm word is a second,
 * explicit gate beyond just clicking a button, appropriate for something
 * this destructive and irreversible.
 */
export function ClearMovementHistoryDialog({ open, onClose, onCleared }) {
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
      await clearMovementHistory();
      toast.success('Movement history cleared');
      onCleared?.();
      handleClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Clear Movement History"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirm}
            loading={submitting}
            disabled={confirmText !== CONFIRM_WORD}
          >
            Delete All Movements
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-body text-ink-secondary">
          This permanently deletes every movement record across every hall and buyer.
          Any sample currently issued will be reset to <span className="font-medium text-ink">In Hall</span>.
          This cannot be undone.
        </p>

        <FormField label={`Type ${CONFIRM_WORD} to confirm`} htmlFor="confirm-clear" error={error}>
          <Input
            id="confirm-clear"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRM_WORD}
            autoFocus
          />
        </FormField>
      </div>
    </Modal>
  );
}
