import { useState } from 'react';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { Input, FormField } from '@/shared/components/Input';
import { createBuyer, addMerchantContacts } from '@/modules/mcs/api/buyersApi';
import { listMerchantUsers } from '@/modules/mcs/api/usersApi';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { useToast } from '@/shared/context/ToastContext';

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
        await addMerchantContacts({ buyerId: buyer.id, profileIds: selectedIds });
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
          <div className="max-h-48 overflow-y-auto scrollbar-thin border border-border rounded-control divide-y divide-border">
            {!merchants ? (
              <p className="px-3 py-3 text-caption text-ink-muted">Loading merchants&hellip;</p>
            ) : merchants.length === 0 ? (
              <p className="px-3 py-3 text-caption text-ink-muted">No merchant users yet.</p>
            ) : (
              merchants.map((m) => (
                <label
                  key={m.id}
                  className="interactive flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-sidebar"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(m.id)}
                    onChange={() => toggleMerchant(m.id)}
                    className="w-4 h-4 rounded border-border-strong accent-ink focus:ring-1 focus:ring-ink"
                  />
                  <div className="min-w-0">
                    <p className="text-body text-ink truncate">{m.full_name}</p>
                    <p className="text-caption text-ink-muted truncate">{m.email}</p>
                  </div>
                </label>
              ))
            )}
          </div>
        </FormField>
      </form>
    </Modal>
  );
}
