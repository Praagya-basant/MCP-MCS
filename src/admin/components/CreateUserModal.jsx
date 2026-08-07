import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Modal } from '@/core/components/Modal';
import { Button } from '@/core/components/Button';
import { Input, Select, FormField } from '@/core/components/Input';
import { Toggle } from '@/core/components/Toggle';
import { createUser } from '@/core/lib/usersApi';
import { useToast } from '@/core/context/ToastContext';
import { ROLES, ROLE_LABELS } from '@/core/utils/constants';
import { CUSTOM_PERMISSION_TOGGLES } from '@/core/permissions';

const EMPTY = { fullName: '', email: '', password: '', role: '', hallId: '' };

export function CreateUserModal({ open, onClose, onCreated, halls }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [customPermissions, setCustomPermissions] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleCustomPermission(key, value) {
    setCustomPermissions((prev) => ({ ...prev, [key]: value }));
  }

  function handleClose() {
    setForm(EMPTY);
    setCustomPermissions({});
    setShowPassword(false);
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
        customPermissions: form.role === ROLES.CUSTOM ? customPermissions : undefined,
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

        <FormField label="Password" htmlFor="user-password" required>
          <div className="relative">
            <Input
              id="user-password"
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              className="pr-9"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="interactive absolute right-0 top-0 h-9 w-9 flex items-center justify-center text-ink-muted hover:text-ink"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
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

        {form.role === ROLES.CUSTOM && (
          <div className="rounded-control border border-border p-3 flex flex-col gap-3">
            <p className="text-caption font-medium text-ink-secondary">Permissions</p>
            {CUSTOM_PERMISSION_TOGGLES.map((t) => (
              <Toggle
                key={t.key}
                label={t.label}
                checked={!!customPermissions[t.key]}
                onChange={(v) => toggleCustomPermission(t.key, v)}
              />
            ))}
          </div>
        )}

        {error && <p className="text-caption text-error">{error}</p>}
      </form>
    </Modal>
  );
}
