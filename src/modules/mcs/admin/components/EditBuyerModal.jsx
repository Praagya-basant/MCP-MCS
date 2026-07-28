import { useEffect, useState } from 'react';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { FormField } from '@/shared/components/Input';
import { syncMerchantContacts } from '@/modules/mcs/api/buyersApi';
import { listMerchantUsers } from '@/modules/mcs/api/usersApi';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { useToast } from '@/shared/context/ToastContext';
import { MerchantSearchSelect } from '@/modules/mcs/admin/components/MerchantSearchSelect';

/**
 * The only place buyer<->merchant assignment happens anywhere in the
 * app — Add Buyer is name-only, and Edit User has no buyer field at all.
 * Diffs the search-select's current selection against the buyer's
 * existing contacts so syncMerchantContacts only touches what changed.
 */
export function EditBuyerModal({ open, buyer, onClose, onUpdated }) {
  const toast = useToast();
  const { data: merchants } = useAsyncData(listMerchantUsers, []);
  const [selectedIds, setSelectedIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (buyer) {
      setSelectedIds((buyer.contacts || []).map((c) => c.profile?.id).filter(Boolean));
    }
  }, [buyer]);

  function handleClose() {
    setError('');
    onClose();
  }

  async function handleSave() {
    setError('');
    setSubmitting(true);
    try {
      const originalIds = (buyer.contacts || []).map((c) => c.profile?.id).filter(Boolean);
      const addProfileIds = selectedIds.filter((id) => !originalIds.includes(id));
      const removeProfileIds = originalIds.filter((id) => !selectedIds.includes(id));

      if (addProfileIds.length > 0 || removeProfileIds.length > 0) {
        await syncMerchantContacts({ buyerId: buyer.id, addProfileIds, removeProfileIds });
      }

      const contacts = selectedIds.map((id) => ({
        profile:
          merchants?.find((m) => m.id === id) ||
          (buyer.contacts || []).find((c) => c.profile?.id === id)?.profile,
      }));

      toast.success('Merchant contacts updated');
      onUpdated?.({ ...buyer, contacts });
      handleClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!buyer) return null;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Edit Buyer"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={submitting}>
            Save Changes
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-body font-medium text-ink -mt-1">{buyer.name}</p>

        <FormField
          label="Merchant Contacts"
          hint={selectedIds.length > 0 ? `${selectedIds.length} selected` : 'Search by name or email to assign merchants'}
        >
          <MerchantSearchSelect merchants={merchants} selectedIds={selectedIds} onChange={setSelectedIds} />
        </FormField>

        {error && <p className="text-caption text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
