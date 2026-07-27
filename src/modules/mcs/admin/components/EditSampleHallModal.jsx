import { useEffect, useState } from 'react';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { Select, FormField } from '@/shared/components/Input';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { useToast } from '@/shared/context/ToastContext';
import { listHalls } from '@/modules/mcs/api/hallsApi';
import { updateSampleHall } from '@/modules/mcs/api/samplesApi';

export function EditSampleHallModal({ open, sample, onClose, onSaved }) {
  const toast = useToast();
  const { data: halls } = useAsyncData(listHalls, []);
  const [hallId, setHallId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (sample) setHallId(sample.hall_id || sample.hall?.id || '');
  }, [sample]);

  function handleClose() {
    setSaving(false);
    onClose();
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await updateSampleHall({ sampleId: sample.id, hallId });
      toast.success('Hall updated');
      onSaved?.(updated);
      handleClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!sample) return null;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Edit Sample Hall"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving} disabled={!hallId || hallId === sample.hall_id}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-caption text-ink-secondary -mt-1">
          <span className="font-mono text-ink font-medium">{sample.bt_code}</span> · {sample.product_name}
        </p>

        <FormField label="Current Hall">
          <p className="text-body text-ink-secondary">{sample.hall?.name || '—'}</p>
        </FormField>

        <FormField label="New Hall" htmlFor="edit-sample-hall" required>
          <Select id="edit-sample-hall" value={hallId} onChange={(e) => setHallId(e.target.value)}>
            <option value="">Select hall</option>
            {(halls || []).map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
    </Modal>
  );
}
