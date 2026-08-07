import { useState } from 'react';
import { Modal } from '@/core/components/Modal';
import { Button } from '@/core/components/Button';
import { Textarea, FormField } from '@/core/components/Input';
import { retirePanel } from '@/modules/mcp/api/panelsApi';
import { useToast } from '@/core/context/ToastContext';

/** Admin-only, only shown while a panel is in_hall (retire_panel RPC blocks retiring an issued panel). */
export function RetirePanelModal({ open, onClose, panel, onSuccess }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleClose() {
    setReason('');
    setError('');
    onClose();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!reason.trim()) {
      setError('A reason is required.');
      return;
    }

    setSubmitting(true);
    try {
      const retired = await retirePanel({ panel, reason: reason.trim() });
      toast.success(`${panel.panel_code} retired`);
      onSuccess?.(retired);
      handleClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!panel) return null;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Retire Panel"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleSubmit} loading={submitting}>
            Retire Panel
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="rounded-control bg-surface-subtle px-3 py-2.5">
          <p className="text-body font-medium text-ink font-mono">{panel.panel_code}</p>
          <p className="text-caption text-ink-secondary">{panel.panel_name}</p>
        </div>

        <p className="text-caption text-ink-secondary">
          Retiring archives this panel — it stops appearing as available to issue, but its full movement history
          stays intact.
        </p>

        <FormField label="Reason" htmlFor="retire-reason" required>
          <Textarea id="retire-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} autoFocus />
        </FormField>

        {error && <p className="text-caption text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}
