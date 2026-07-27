import { useState } from 'react';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { Input, FormField } from '@/shared/components/Input';
import { createBuyer, syncMerchantContacts } from '@/modules/mcs/api/buyersApi';
import { listMerchantUsers } from '@/modules/mcs/api/usersApi';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { useToast } from '@/shared/context/ToastContext';
import { MerchantContactsSelect } from '@/modules/mcs/admin/components/MerchantContactsSelect';

export function AddBuyerModal({ open, onClose, onCreated }) {
  const toast = useToast();
  const { data: merchants } = useAsyncData(listMerchantUsers, []);
  const [name, setName] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleClose() {
    setName('');
    setSelectedIds([]);
    setError('');
    onClose();
  }

  function toggleMerchant(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
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

      let contacts = [];
      if (selectedIds.length > 0) {
        await syncMerchantContacts({ buyerId: buyer.id, addProfileIds: selectedIds });
        contacts = selectedIds.map((id) => ({
          profile: merchants.find((m) => m.id === id),
        }));
      }

      toast.success(
        selectedIds.length > 0
          ? `Buyer added with ${selectedIds.length} merchant contact${selectedIds.length === 1 ? '' : 's'}`
          : 'Buyer added'
      );
      onCreated?.({ ...buyer, contacts });
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
            placeholder="e.g. IKEA"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </FormField>

        <FormField
          label="Merchant Contacts"
          hint={selectedIds.length > 0 ? `${selectedIds.length} selected` : 'Optional — link existing merchant users to this buyer'}
        >
          <MerchantContactsSelect merchants={merchants} selectedIds={selectedIds} onToggle={toggleMerchant} />
        </FormField>
      </form>
    </Modal>
  );
}
