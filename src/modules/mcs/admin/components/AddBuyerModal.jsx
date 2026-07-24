import { useState } from 'react';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { Input, FormField } from '@/shared/components/Input';
import { createBuyer } from '@/modules/mcs/api/buyersApi';
import { useToast } from '@/shared/context/ToastContext';

export function AddBuyerModal({ open, onClose, onCreated }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleClose() {
    setName('');
    setError('');
    onClose();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Buyer name is required.');
      return;
    }
    setSubmitting(true);
    try {
      const buyer = await createBuyer({ name: name.trim() });
      toast.success('Buyer added');
      onCreated?.(buyer);
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
      title="Add Buyer"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            Add Buyer
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <FormField label="Buyer Name" htmlFor="buyer-name" required error={error}>
          <Input
            id="buyer-name"
            placeholder="e.g. Maison du Monde (MDM)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </FormField>
      </form>
    </Modal>
  );
}
