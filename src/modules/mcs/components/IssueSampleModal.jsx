import { useState } from 'react';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { Input, Select, Textarea, FormField } from '@/shared/components/Input';
import { issueSample } from '@/modules/mcs/api/movementsApi';
import { useToast } from '@/shared/context/ToastContext';
import { useAuth } from '@/shared/context/AuthContext';
import { DESTINATION_OPTIONS, REASON_OPTIONS } from '@/shared/utils/constants';
import { cn } from '@/shared/utils/cn';

const EMPTY = { pickedByName: '', destination: '', reason: '', reasonOther: '', notes: '' };

export function IssueSampleModal({ open, onClose, sample, onSuccess }) {
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

    if (!form.pickedByName.trim() || !form.destination || !form.reason) {
      setError('Fill in all required fields.');
      return;
    }
    if (form.reason === 'Other' && !form.reasonOther.trim()) {
      setError('Describe the reason.');
      return;
    }

    setSubmitting(true);
    try {
      // Fire the DB write and return immediately — the caller updates
      // status/toast/drawer right away; issueSample() itself fires the
      // notification emails in the background without blocking this call.
      await issueSample({
        sample,
        pickedByName: form.pickedByName.trim(),
        destination: form.destination,
        reason: form.reason,
        reasonOther: form.reasonOther.trim(),
        notes: form.notes.trim(),
        loggedByName: profile?.full_name,
      });
      toast.success('Sample issued successfully');
      onSuccess?.();
      setSubmitting(false);
      handleClose();
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  if (!sample) return null;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Issue Sample"
      maxWidth="max-w-[520px]"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            Issue Sample
          </Button>
        </>
      }
    >
      <div className="mb-6 -mt-1">
        <p className="text-caption text-ink-secondary">
          <span className="font-mono text-ink font-medium">{sample.bt_code}</span> · {sample.product_name}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
        <FormField label="Issued To" htmlFor="picker-name" required>
          <Input
            id="picker-name"
            placeholder="Picker name"
            value={form.pickedByName}
            onChange={(e) => set('pickedByName', e.target.value)}
            autoFocus
          />
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

        <FormField label="Reason" required>
          <div className="flex flex-wrap gap-2">
            {REASON_OPTIONS.map((r) => {
              const active = form.reason === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => set('reason', r)}
                  className={cn(
                    'interactive h-8 px-3 rounded-control text-caption font-medium border',
                    active
                      ? 'bg-ink text-white border-ink scale-105'
                      : 'bg-white text-ink-secondary border-border hover:bg-surface-subtle hover:text-ink scale-100'
                  )}
                >
                  {r}
                </button>
              );
            })}
          </div>
        </FormField>

        {form.reason === 'Other' && (
          <FormField label="Describe Reason" htmlFor="reason-other" required>
            <Input id="reason-other" value={form.reasonOther} onChange={(e) => set('reasonOther', e.target.value)} />
          </FormField>
        )}

        <FormField label="Notes" htmlFor="notes" hint="Optional">
          <Textarea
            id="notes"
            placeholder="Any additional notes..."
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={3}
          />
        </FormField>

        {error && <p className="text-caption text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}
