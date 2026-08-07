import { useState } from 'react';
import { Card } from '@/core/components/Card';
import { Button } from '@/core/components/Button';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/core/components/Table';
import { TableSkeleton } from '@/core/components/Skeleton';
import { EmptyState } from '@/core/components/EmptyState';
import { SearchInput } from '@/core/components/SearchInput';
import { Pagination } from '@/core/components/Pagination';
import { RoleBadge, Badge } from '@/core/components/Badge';
import { ConfirmDialog } from '@/core/components/ConfirmDialog';
import { useAsyncData } from '@/core/hooks/useAsyncData';
import { useTableControls } from '@/core/hooks/useTableControls';
import { listUsers, setUserDisabled, deleteUser } from '@/core/lib/usersApi';
import { listHalls } from '@/core/lib/hallsApi';
import { PAGE_SIZE, ROLE_LABELS } from '@/core/utils/constants';
import { IconPlus, IconUsers, IconEdit, IconTrash } from '@/core/components/icons';
import { formatRelativeTime } from '@/core/utils/formatters';
import { logAuditEvent } from '@/core/lib/auditLog';
import { useToast } from '@/core/context/ToastContext';
import { CreateUserModal } from '@/admin/components/CreateUserModal';
import { EditUserModal } from '@/admin/components/EditUserModal';

/** Users tab of Admin -> Team & Buyers (/admin/team). Same table/behavior as the old standalone Users page. */
export function UsersPanel() {
  const toast = useToast();
  const { data: users, loading, error, setData } = useAsyncData(listUsers, []);
  const { data: halls } = useAsyncData(listHalls, []);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const rows = users || [];

  const { search, setSearch, page, setPage, totalPages, totalCount, pageRows } = useTableControls(rows, {
    searchFields: ['full_name', 'email'],
  });

  function handleCreated(profile) {
    setData((prev) => [profile, ...(prev || [])]);
    logAuditEvent('user.create', { userId: profile.id, email: profile.email, role: profile.role });
  }

  function handleSaved(profile) {
    setData((prev) => (prev || []).map((u) => (u.id === profile.id ? { ...u, ...profile } : u)));
    logAuditEvent('user.update', { userId: profile.id });
  }

  async function handleToggleDisabled(user) {
    const next = !user.is_disabled;
    setData((prev) => (prev || []).map((u) => (u.id === user.id ? { ...u, is_disabled: next } : u)));
    try {
      await setUserDisabled(user.id, next);
      logAuditEvent(next ? 'user.disable' : 'user.enable', { userId: user.id });
      toast.success(next ? 'User disabled' : 'User enabled');
    } catch (err) {
      setData((prev) => (prev || []).map((u) => (u.id === user.id ? { ...u, is_disabled: !next } : u)));
      toast.error(err.message);
    }
  }

  async function handleDelete() {
    if (!deletingUser) return;
    setDeleting(true);
    try {
      await deleteUser(deletingUser.id);
      setData((prev) => (prev || []).filter((u) => u.id !== deletingUser.id));
      logAuditEvent('user.delete', { userId: deletingUser.id, email: deletingUser.email });
      toast.success('User deleted');
      setDeletingUser(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setModalOpen(true)}>
          <IconPlus className="w-4 h-4" />
          Create User
        </Button>
      </div>

      <Card>
        <div className="px-4 py-3 border-b border-border">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name or email..." className="max-w-xs" />
        </div>

        {loading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : error ? (
          <EmptyState icon={<IconUsers className="w-12 h-12 text-ink-muted" />} title="Couldn't load users" description={error.message} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<IconUsers className="w-12 h-12 text-ink-muted" />}
            title="No users yet"
            description="Create hall manager and merchant accounts here."
            actionLabel="Create User"
            onAction={() => setModalOpen(true)}
          />
        ) : pageRows.length === 0 ? (
          <EmptyState title="No matches" description="Try a different search term." />
        ) : (
          <>
            <Table>
              <Thead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Email</Th>
                  <Th>Role</Th>
                  <Th>Assignment</Th>
                  <Th>Last Login</Th>
                  <Th>Status</Th>
                  <Th></Th>
                </Tr>
              </Thead>
              <Tbody>
                {pageRows.map((u) => (
                  <Tr key={u.id}>
                    <Td className="font-medium">{u.full_name}</Td>
                    <Td className="text-ink-secondary">{u.email}</Td>
                    <Td>
                      <RoleBadge role={u.role} label={ROLE_LABELS[u.role]} />
                    </Td>
                    <Td className="text-ink-secondary">
                      {u.hall ? u.hall.name : u.buyer ? u.buyer.name : '—'}
                    </Td>
                    <Td className="text-ink-secondary">
                      {u.last_sign_in_at ? formatRelativeTime(u.last_sign_in_at) : 'Never'}
                    </Td>
                    <Td>
                      <button
                        type="button"
                        onClick={() => handleToggleDisabled(u)}
                        className="interactive"
                        title={u.is_disabled ? 'Click to enable' : 'Click to disable'}
                      >
                        {u.is_disabled ? (
                          <Badge className="bg-status-expired-bg text-status-expired-text">Disabled</Badge>
                        ) : (
                          <Badge className="bg-status-in-hall-bg text-status-in-hall-text">Active</Badge>
                        )}
                      </button>
                    </Td>
                    <Td className="text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" aria-label="Edit user" onClick={() => setEditingUser(u)}>
                        <IconEdit className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" aria-label="Delete user" onClick={() => setDeletingUser(u)}>
                        <IconTrash className="w-4 h-4" />
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
            <Pagination page={page} totalPages={totalPages} totalCount={totalCount} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </Card>

      <CreateUserModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
        halls={halls || []}
      />

      <EditUserModal
        open={!!editingUser}
        user={editingUser}
        onClose={() => setEditingUser(null)}
        onSaved={handleSaved}
        halls={halls || []}
      />

      <ConfirmDialog
        open={!!deletingUser}
        onClose={() => setDeletingUser(null)}
        onConfirm={handleDelete}
        title="Delete this user?"
        description={`${deletingUser?.full_name || 'This user'} will permanently lose access. This can't be undone.`}
        confirmLabel="Delete User"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
