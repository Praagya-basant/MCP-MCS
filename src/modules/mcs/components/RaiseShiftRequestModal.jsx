import { useState } from 'react';
import { Modal } from '@/core/components/Modal';
import { Button } from '@/core/components/Button';
import { Select, Textarea, FormField } from '@/core/components/Input';
import { createShiftRequest } from '@/core/lib/shiftRequestsApi';
import { listHalls } from '@/core/lib/hallsApi';
import { useAsyncData } from '@/core/hooks/useAsyncData';
import { useAuth } from '@/core/auth/AuthContext';
import { useToast } from '@/core/context/ToastContext';
import { ROLE_LABELS } from '@/core/utils/constants';

/**
 * Raised by the current hall's manager or the sample's own merchant to
 * request moving the sample to a different home hall — only shown while
 * the sample is `in_hall` (see SampleDetailDrawer); a checked-out sample
 * moves via Forward instead. Admin approves/rejects from
 * /admin/shift-requests.
 */
export function RaiseShiftRequestModal({ open, onClose, sample, onCreated }) {
  const { profile, role } = useAuth();
  const toast = useToast();
  const { data: halls } = useAsyncData(listHalls, []);
  const [toHallId, setToHallId] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const hallOptions = (halls || []).filter((h) => h.id !== sample?.hall_id);

  function handleClose() {
    setToHallId('');
    setNote('');
    setError('');
    onClose();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!toHallId) {
      setError('Select a destination hall.');
      return;
    }

    setSubmitting(true);
    try {
      const request = await createShiftRequest({
        sample,
        toHallId,
        note: note.trim(),
        requestedById: profile.id,
        requestedByName: profile.full_name,
        requestedByRole: ROLE_LABELS[role] || role,
      });
      toast.success('Hall shift request sent');
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
      title="Request Hall Shift"
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
          <p className="text-caption text-ink-secondary">Currently in: {sample.hall?.name}</p>
        </div>

        <FormField label="Destination Hall" htmlFor="shift-to-hall" required>
          <Select id="shift-to-hall" value={toHallId} onChange={(e) => setToHallId(e.target.value)} autoFocus>
            <option value="">Select hall</option>
            {hallOptions.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Note" htmlFor="shift-note" hint="Optional">
          <Textarea id="shift-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
        </FormField>

        {error && <p className="text-caption text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}
