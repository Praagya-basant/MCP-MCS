import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Modal } from '@/core/components/Modal';
import { Button } from '@/core/components/Button';
import { Input, Select, FormField } from '@/core/components/Input';
import { Toggle } from '@/core/components/Toggle';
import { updateUser } from '@/core/lib/usersApi';
import { useToast } from '@/core/context/ToastContext';
import { ROLES, ROLE_LABELS } from '@/core/utils/constants';
import { CUSTOM_PERMISSION_TOGGLES } from '@/core/permissions';

/**
 * Same fields as Create User plus a password-reset field inside the same
 * modal (left blank = unchanged) — no separate "reset password" flow, per
 * the spec's explicit "no separate reset flow" instruction.
 */
export function EditUserModal({ open, user, onClose, onSaved, halls }) {
  const toast = useToast();
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('');
  const [hallId, setHallId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [customPermissions, setCustomPermissions] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    setFullName(user.full_name || '');
    setRole(user.role || '');
    setHallId(user.hall_id || '');
    setPassword('');
    setShowPassword(false);
    setCustomPermissions(user.custom_permissions || {});
    setError('');
  }, [user]);

  function toggleCustomPermission(key, value) {
    setCustomPermissions((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!fullName.trim() || !role) {
      setError('Fill in all required fields.');
      return;
    }
    if (role === ROLES.HALL_MANAGER && !hallId) {
      setError('Select a hall for this hall manager.');
      return;
    }
    if (password && password.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const profile = await updateUser({
        userId: user.id,
        fullName: fullName.trim(),
        role,
        hallId: role === ROLES.HALL_MANAGER ? hallId : null,
        customPermissions: role === ROLES.CUSTOM ? customPermissions : undefined,
        password: password || undefined,
      });
      toast.success('User updated');
      onSaved?.(profile);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit User"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            Save Changes
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <FormField label="Full Name" htmlFor="edit-full-name" required>
          <Input id="edit-full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus />
        </FormField>

        <FormField label="Email" hint="Email can't be changed here — contact Supabase support if it needs to change.">
          <Input value={user.email} disabled />
        </FormField>

        <FormField label="Role" htmlFor="edit-role" required>
          <Select id="edit-role" value={role} onChange={(e) => setRole(e.target.value)}>
            {Object.values(ROLES).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        </FormField>

        {role === ROLES.HALL_MANAGER && (
          <FormField label="Assigned Hall" htmlFor="edit-hall" required>
            <Select id="edit-hall" value={hallId} onChange={(e) => setHallId(e.target.value)}>
              <option value="">Select a hall</option>
              {(halls || []).map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </Select>
          </FormField>
        )}

        {role === ROLES.CUSTOM && (
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

        <FormField label="Reset Password" htmlFor="edit-password" hint="Leave blank to keep the current password">
          <div className="relative">
            <Input
              id="edit-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
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

        {error && <p className="text-caption text-error">{error}</p>}
      </form>
    </Modal>
  );
}
