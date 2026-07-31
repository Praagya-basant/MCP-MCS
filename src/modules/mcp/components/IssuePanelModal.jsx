import { useState } from 'react';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { Input, Select, Textarea, FormField } from '@/shared/components/Input';
import { FileUpload } from '@/shared/components/FileUpload';
import { SignaturePad } from '@/shared/components/SignaturePad';
import { PanelThumbnail } from '@/modules/mcp/components/PanelThumbnail';
import { issuePanel } from '@/modules/mcp/api/panelMovementsApi';
import { listHalls } from '@/modules/mcs/api/hallsApi';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { useToast } from '@/shared/context/ToastContext';
import { NON_HALL_DESTINATIONS, REASON_OPTIONS, PURCHASER_OPTIONS } from '@/shared/utils/constants';
import { cn } from '@/shared/utils/cn';

const EMPTY = {
  pickedByName: '',
  destination: '',
  reason: '',
  reasonOther: '',
  notes: '',
  supplierName: '',
  purchaser: '',
  purchaserOther: '',
};

/** Mirrors IssueSampleModal — see that file for the field-by-field rationale. */
export function IssuePanelModal({ open, onClose, panel, onSuccess }) {
  const toast = useToast();
  const { data: halls } = useAsyncData(listHalls, []);
  const [form, setForm] = useState(EMPTY);
  const [photo, setPhoto] = useState(null);
  const [signatureBlob, setSignatureBlob] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const destinationOptions = [...(halls || []).map((h) => h.name), ...NON_HALL_DESTINATIONS];
  const isSupplier = form.destination === 'Supplier';

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleClose() {
    setForm(EMPTY);
    setPhoto(null);
    setSignatureBlob(null);
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
    if (isSupplier && form.purchaser === 'Other' && !form.purchaserOther.trim()) {
      setError('Enter the purchaser name.');
      return;
    }

    setSubmitting(true);
    try {
      await issuePanel({
        panel,
        pickedByName: form.pickedByName.trim(),
        destination: form.destination,
        reason: form.reason,
        reasonOther: form.reasonOther.trim(),
        notes: form.notes.trim(),
        photoFile: photo instanceof File ? photo : null,
        signatureBlob,
        supplierName: isSupplier ? form.supplierName.trim() : '',
        purchaserName: isSupplier ? (form.purchaser === 'Other' ? form.purchaserOther.trim() : form.purchaser) : '',
      });
      toast.success('Panel issued successfully');
      onSuccess?.();
      setSubmitting(false);
      handleClose();
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  if (!panel) return null;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Issue Panel"
      maxWidth="md:max-w-[520px]"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            Issue Panel
          </Button>
        </>
      }
    >
      <div className="mb-6 -mt-1 flex items-center gap-3 pb-4 border-b border-border">
        <PanelThumbnail panel={panel} size="md" />
        <div className="min-w-0">
          <p className="text-body font-semibold text-ink truncate">{panel.panel_name}</p>
          <p className="font-mono text-caption text-ink-secondary">{panel.panel_code}</p>
        </div>
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
            {destinationOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </FormField>

        {isSupplier && (
          <>
            <FormField label="Supplier Name" htmlFor="supplier-name">
              <Input
                id="supplier-name"
                placeholder="Supplier name"
                value={form.supplierName}
                onChange={(e) => set('supplierName', e.target.value)}
              />
            </FormField>

            <FormField label="Purchaser" htmlFor="purchaser">
              <Select id="purchaser" value={form.purchaser} onChange={(e) => set('purchaser', e.target.value)}>
                <option value="">Select purchaser</option>
                {PURCHASER_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </FormField>

            {form.purchaser === 'Other' && (
              <FormField label="Purchaser Name" htmlFor="purchaser-other" required>
                <Input
                  id="purchaser-other"
                  value={form.purchaserOther}
                  onChange={(e) => set('purchaserOther', e.target.value)}
                />
              </FormField>
            )}
          </>
        )}

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
                      ? 'bg-accent text-accent-ink border-accent scale-105'
                      : 'bg-card text-ink-secondary border-border hover:bg-surface-subtle hover:text-ink scale-100'
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

        <div className="pt-1 border-t border-border flex flex-col gap-6">
          <FormField label="Photo" hint="Optional — opens the camera on mobile">
            <FileUpload value={photo} onChange={setPhoto} accept="image/*" capture="environment" />
          </FormField>

          <FormField label="Signature" hint="Optional">
            <SignaturePad onChange={setSignatureBlob} />
          </FormField>

          <FormField label="Notes" htmlFor="notes" hint="Optional">
            <Textarea
              id="notes"
              placeholder="Any additional notes..."
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={3}
            />
          </FormField>
        </div>

        {error && <p className="text-caption text-error">{error}</p>}
      </form>
    </Modal>
  );
}
