import { useState } from 'react';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { Input, Select, Textarea, FormField } from '@/shared/components/Input';
import { checkoutSample } from '@/modules/mcs/api/movementsApi';
import { useToast } from '@/shared/context/ToastContext';
import { useAuth } from '@/shared/context/AuthContext';
import { DESTINATION_OPTIONS, REASON_OPTIONS } from '@/shared/utils/constants';

const EMPTY = { pickedByName: '', pickedByEmail: '', destination: '', reason: '', reasonOther: '', notes: '' };

export function CheckoutModal({ open, onClose, sample, onSuccess }) {
  const toast = useToast();
  const { profile } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleClose() {
    setForm(EMPTY);
    setError('');
    onClose();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.pickedByName.trim() || !form.pickedByEmail.trim() || !form.destination || !form.reason) {
      setError('Fill in all required fields.');
      return;
    }
    if (form.reason === 'Other' && !form.reasonOther.trim()) {
      setError('Describe the reason.');
      return;
    }

    setSubmitting(true);
    try {
      await checkoutSample({
        sample,
        pickedByName: form.pickedByName.trim(),
        pickedByEmail: form.pickedByEmail.trim(),
        destination: form.destination,
        reason: form.reason,
        reasonOther: form.reasonOther.trim(),
        notes: form.notes.trim(),
        loggedByName: profile?.full_name,
      });
      toast.success(`${sample.bt_code} checked out`);
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
      title="Log Checkout"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            Confirm Checkout
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="rounded-control bg-surface-subtle px-3 py-2.5">
          <p className="text-body font-medium text-ink">{sample.bt_code}</p>
          <p className="text-caption text-ink-secondary">{sample.product_name} · {sample.buyer?.name}</p>
        </div>

        <FormField label="Picker Name" htmlFor="picker-name" required>
          <Input id="picker-name" value={form.pickedByName} onChange={(e) => set('pickedByName', e.target.value)} autoFocus />
        </FormField>

        <FormField label="Picker Email" htmlFor="picker-email" required>
          <Input id="picker-email" type="email" value={form.pickedByEmail} onChange={(e) => set('pickedByEmail', e.target.value)} />
        </FormField>

        <FormField label="Destination" htmlFor="destination" required>
          <Select id="destination" value={form.destination} onChange={(e) => set('destination', e.target.value)}>
            <option value="">Select destination</option>
            {DESTINATION_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Reason" htmlFor="reason" required>
          <Select id="reason" value={form.reason} onChange={(e) => set('reason', e.target.value)}>
            <option value="">Select reason</option>
            {REASON_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </FormField>

        {form.reason === 'Other' && (
          <FormField label="Describe Reason" htmlFor="reason-other" required>
            <Input id="reason-other" value={form.reasonOther} onChange={(e) => set('reasonOther', e.target.value)} />
          </FormField>
        )}

        <FormField label="Notes" htmlFor="notes" hint="Optional">
          <Textarea id="notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} />
        </FormField>

        {error && <p className="text-caption text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}
