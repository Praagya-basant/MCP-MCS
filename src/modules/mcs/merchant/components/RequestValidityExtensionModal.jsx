import { useState } from 'react';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { Input, Textarea, FormField } from '@/shared/components/Input';
import { createValidityRequest } from '@/modules/mcs/api/validityApi';
import { useAuth } from '@/shared/context/AuthContext';
import { useToast } from '@/shared/context/ToastContext';
import { formatDate } from '@/shared/utils/formatters';

export function RequestValidityExtensionModal({ open, onClose, sample, onCreated }) {
  const { profile } = useAuth();
  const toast = useToast();
  const [months, setMonths] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleClose() {
    setMonths('');
    setReason('');
    setError('');
    onClose();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!months || Number(months) <= 0) {
      setError('Enter how many months to extend by.');
      return;
    }

    setSubmitting(true);
    try {
      const request = await createValidityRequest({
        sample,
        requestedById: profile.id,
        requestedByName: profile.full_name,
        requestedMonths: Number(months),
        reason: reason.trim(),
      });
      toast.success('Validity extension request sent');
      onCreated?.(request);
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
      title="Request Validity Extension"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            Send Request
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="rounded-control bg-surface-subtle px-3 py-2.5">
          <p className="text-body font-medium text-ink font-mono">{sample.bt_code}</p>
          <p className="text-caption text-ink-secondary">
            Current expiry: {sample.expiry_date ? formatDate(sample.expiry_date) : 'Not set'}
          </p>
        </div>

        <FormField label="Extend By (months)" htmlFor="request-months" required>
          <Input id="request-months" type="number" min="1" value={months} onChange={(e) => setMonths(e.target.value)} autoFocus />
        </FormField>

        <FormField label="Reason" htmlFor="request-reason" hint="Optional">
          <Textarea id="request-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
        </FormField>

        {error && <p className="text-caption text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}
