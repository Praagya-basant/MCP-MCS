import { useEffect, useState } from 'react';
import { Modal } from '@/core/components/Modal';
import { Button } from '@/core/components/Button';
import { Input, FormField } from '@/core/components/Input';
import { createHall, renameHall } from '@/core/lib/hallsApi';
import { useToast } from '@/core/context/ToastContext';

/** hall=null -> "Add Hall"; hall passed -> "Rename Hall". No hall_number field — see createHall(). */
export function HallFormModal({ open, hall, onClose, onSaved }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isRename = !!hall;

  useEffect(() => {
    if (open) setName(hall?.name || '');
  }, [open, hall]);

  function handleClose() {
    setName('');
    setError('');
    onClose();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Hall name is required.');
      return;
    }
    setSubmitting(true);
    try {
      const saved = isRename ? await renameHall({ id: hall.id, name: name.trim() }) : await createHall({ name: name.trim() });
      toast.success(isRename ? 'Hall renamed' : 'Hall added');
      onSaved?.(saved, isRename);
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
      title={isRename ? 'Rename Hall' : 'Add Hall'}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            {isRename ? 'Save' : 'Add Hall'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <FormField label="Hall Name" htmlFor="hall-name" required error={error}>
          <Input id="hall-name" placeholder="e.g. Mandore" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </FormField>
      </form>
    </Modal>
  );
}
