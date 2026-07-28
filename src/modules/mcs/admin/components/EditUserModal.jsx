import { useEffect, useState } from 'react';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { FormField } from '@/shared/components/Input';
import { listBuyers, listMerchantBuyerIds, setMerchantBuyers } from '@/modules/mcs/api/buyersApi';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { useToast } from '@/shared/context/ToastContext';
import { BuyersMultiSelect } from '@/modules/mcs/admin/components/BuyersMultiSelect';
import { RoleBadge } from '@/shared/components/Badge';
import { ROLES, ROLE_LABELS } from '@/shared/utils/constants';

/**
 * Currently only exposes the merchant multi-buyer assignment (see
 * merchant_buyers in schema.sql) — the only per-user setting Admin ->
 * Buyers doesn't already cover. Hall/admin accounts have nothing to edit
 * here yet, so the modal just shows their identity.
 */
export function EditUserModal({ open, user, onClose, onUpdated }) {
  const toast = useToast();
  const { data: buyers } = useAsyncData(listBuyers, []);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loadingAssigned, setLoadingAssigned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !user || user.role !== ROLES.MERCHANT) return;
    setLoadingAssigned(true);
    setError('');
    listMerchantBuyerIds(user.id)
      .then(setSelectedIds)
      .catch((err) => setError(err.message))
      .finally(() => setLoadingAssigned(false));
  }, [open, user]);

  function toggleBuyer(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleClose() {
    setError('');
    setSelectedIds([]);
    onClose();
  }

  async function handleSave() {
    setError('');
    setSubmitting(true);
    try {
      await setMerchantBuyers({ profileId: user.id, buyerIds: selectedIds });
      toast.success('Buyer assignments updated');
      onUpdated?.();
      handleClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) return null;

  const isMerchant = user.role === ROLES.MERCHANT;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Edit User"
      footer={
        isMerchant ? (
          <>
            <Button variant="secondary" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={submitting} disabled={loadingAssigned}>
              Save Changes
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-body font-medium text-ink truncate">{user.full_name}</p>
            <p className="text-caption text-ink-secondary truncate">{user.email}</p>
          </div>
          <RoleBadge role={user.role} label={ROLE_LABELS[user.role] || user.role} />
        </div>

        {isMerchant ? (
          <FormField
            label="Assigned Buyers"
            hint={selectedIds.length > 0 ? `${selectedIds.length} selected` : 'No buyers assigned yet'}
          >
            <BuyersMultiSelect buyers={buyers} selectedIds={selectedIds} onToggle={toggleBuyer} />
          </FormField>
        ) : (
          <p className="text-caption text-ink-muted">Buyer assignment only applies to merchant accounts.</p>
        )}

        {error && <p className="text-caption text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
