import { useState } from 'react';
import { Modal } from '@/core/components/Modal';
import { Button } from '@/core/components/Button';
import { Input, Textarea, FormField } from '@/core/components/Input';
import { updateValidity } from '@/core/lib/validityApi';
import { useToast } from '@/core/context/ToastContext';
import { formatDate } from '@/core/utils/formatters';
import { cn } from '@/core/utils/cn';

const MODES = [
  { id: 'months', label: 'Extend by months' },
  { id: 'date', label: 'Set new date' },
];

function addMonthsToDate(dateStr, months) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setMonth(d.getMonth() + Number(months));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Admin-only "Manage Validity" — extending, setting a manual date, and
 * pre-expiring are all the same underlying operation (a new expiry_date),
 * this just frames the input two ways for convenience. Shared between
 * MCS (samples) and MCP (panels): `item` just needs `.code`/`.name`/
 * `.expiry_date` (see normalizeItem() in shared/lib/validityApi.js) and
 * `itemType` is 'sample' or 'panel'.
 */
export function ManageValidityModal({ open, onClose, item, itemType, onSuccess }) {
  const toast = useToast();
  const [mode, setMode] = useState('months');
  const [months, setMonths] = useState('');
  const [newDate, setNewDate] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleClose() {
    setMode('months');
    setMonths('');
    setNewDate('');
    setReason('');
    setError('');
    onClose();
  }

  const computedDate =
    mode === 'months' && months ? addMonthsToDate(item?.expiry_date || new Date().toISOString().slice(0, 10), months) : newDate;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!computedDate) {
      setError(mode === 'months' ? 'Enter a number of months.' : 'Pick a date.');
      return;
    }
    if (!reason.trim()) {
      setError('A reason is required.');
      return;
    }

    setSubmitting(true);
    try {
      await updateValidity({ item, itemType, newExpiryDate: computedDate, reason: reason.trim() });
      toast.success(`Validity updated for ${item.code}`);
      onSuccess?.(computedDate);
      handleClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!item) return null;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Manage Validity"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            Save
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="rounded-control bg-surface-subtle px-3 py-2.5">
          <p className="text-body font-medium text-ink font-mono">{item.code}</p>
          <p className="text-caption text-ink-secondary">
            Current expiry: {item.expiry_date ? formatDate(item.expiry_date) : 'Not set'}
          </p>
        </div>

        <FormField label="Mode">
          <div className="flex flex-wrap gap-2">
            {MODES.map((m) => {
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className={cn(
                    'interactive h-8 px-3 rounded-control text-caption font-medium border',
                    active
                      ? 'bg-accent text-accent-ink border-accent'
                      : 'bg-card text-ink-secondary border-border hover:bg-surface-subtle hover:text-ink'
                  )}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </FormField>

        {mode === 'months' ? (
          <FormField label="Extend By (months)" htmlFor="extend-months" required>
            <Input id="extend-months" type="number" min="0" value={months} onChange={(e) => setMonths(e.target.value)} autoFocus />
          </FormField>
        ) : (
          <FormField label="New Expiry Date" htmlFor="new-expiry" required hint="Can be in the past to pre-expire the item">
            <Input id="new-expiry" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} autoFocus />
          </FormField>
        )}

        {computedDate && (
          <p className="text-caption text-ink-secondary">
            New expiry date: <span className="font-medium text-ink">{formatDate(computedDate)}</span>
          </p>
        )}

        <FormField label="Reason" htmlFor="validity-reason" required>
          <Textarea id="validity-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
        </FormField>

        {error && <p className="text-caption text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}
