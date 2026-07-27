import { useState } from 'react';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { Input, Select, FormField } from '@/shared/components/Input';
import { createUser } from '@/modules/mcs/api/usersApi';
import { useToast } from '@/shared/context/ToastContext';
import { ROLES, ROLE_LABELS } from '@/shared/utils/constants';

const EMPTY = { fullName: '', email: '', password: '', role: '', hallId: '' };

export function CreateUserModal({ open, onClose, onCreated, halls }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleClose() {
    setForm(EMPTY);
    setError('');
    onClose();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.fullName.trim() || !form.email.trim() || !form.password || !form.role) {
      setError('Fill in all required fields.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (form.role === ROLES.HALL_MANAGER && !form.hallId) {
      setError('Select a hall for this hall manager.');
      return;
    }

    setSubmitting(true);
    try {
      const { profile } = await createUser({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        hallId: form.role === ROLES.HALL_MANAGER ? form.hallId : null,
      });
      toast.success('User created');
      onCreated?.(profile);
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
      title="Create User"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            Create User
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <FormField label="Full Name" htmlFor="full-name" required>
          <Input id="full-name" value={form.fullName} onChange={(e) => set('fullName', e.target.value)} autoFocus />
        </FormField>

        <FormField label="Email" htmlFor="user-email" required>
          <Input
            id="user-email"
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
          />
        </FormField>

        <FormField label="Password" htmlFor="user-password" required hint="At least 8 characters.">
          <Input
            id="user-password"
            type="password"
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
          />
        </FormField>

        <FormField label="Role" htmlFor="user-role" required>
          <Select id="user-role" value={form.role} onChange={(e) => set('role', e.target.value)}>
            <option value="">Select a role</option>
            {Object.values(ROLES).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        </FormField>

        {form.role === ROLES.HALL_MANAGER && (
          <FormField label="Assigned Hall" htmlFor="user-hall" required>
            <Select id="user-hall" value={form.hallId} onChange={(e) => set('hallId', e.target.value)}>
              <option value="">Select a hall</option>
              {halls.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </Select>
          </FormField>
        )}

        {form.role === ROLES.MERCHANT && (
          <p className="text-caption text-ink-muted -mt-1">
            Buyer assignment happens from Admin &rarr; Buyers, not here.
          </p>
        )}

        {error && <p className="text-caption text-red-600">{error}</p>}
      </form>
    </Modal>
  );
}
