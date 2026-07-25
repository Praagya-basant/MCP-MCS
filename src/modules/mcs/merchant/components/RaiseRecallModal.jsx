import { useState } from 'react';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { Select, Textarea, FormField } from '@/shared/components/Input';
import { createRecall } from '@/modules/mcs/api/recallsApi';
import { useAuth } from '@/shared/context/AuthContext';
import { useToast } from '@/shared/context/ToastContext';

/**
 * Two modes: pass a fixed `sample` (opened from that sample's detail
 * drawer — no picker needed), or a `samples` list to let the merchant
 * choose which of their checked-out samples to recall (the standalone
 * /merchant/recalls page's "Raise Recall" button).
 */
export function RaiseRecallModal({ open, onClose, sample, samples, onCreated }) {
  const { profile } = useAuth();
  const toast = useToast();
  const [sampleId, setSampleId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fixedMode = !!sample;

  function handleClose() {
    setSampleId('');
    setReason('');
    setError('');
    onClose();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const target = fixedMode ? sample : samples.find((s) => s.id === sampleId);
    if (!target) {
      setError('Select a sample to recall.');
      return;
    }
    setSubmitting(true);
    try {
      const recall = await createRecall({
        sample: target,
        reason: reason.trim(),
        requestedById: profile.id,
        merchantName: profile.full_name,
      });
      toast.success('Recall request sent');
      onCreated?.(recall);
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
      title="Raise Recall Request"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            Send Recall Request
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {fixedMode ? (
          <div className="rounded-control bg-surface-subtle px-3 py-2.5">
            <p className="text-body font-medium text-ink font-mono">{sample.bt_code}</p>
            <p className="text-caption text-ink-secondary">{sample.product_name}</p>
          </div>
        ) : (
          <FormField label="Sample" htmlFor="recall-sample" required>
            <Select id="recall-sample" value={sampleId} onChange={(e) => setSampleId(e.target.value)} autoFocus>
              <option value="">Select a sample</option>
              {samples.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.bt_code} — {s.product_name}
                </option>
              ))}
            </Select>
          </FormField>
        )}

        <FormField label="Reason" htmlFor="recall-reason" hint="Optional">
          <Textarea id="recall-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} autoFocus={fixedMode} />
        </FormField>

        {error && <p className="text-caption text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}
