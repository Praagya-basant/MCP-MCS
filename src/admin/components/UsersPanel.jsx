import { useState } from 'react';
import { Card } from '@/core/components/Card';
import { Button } from '@/core/components/Button';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/core/components/Table';
import { TableSkeleton } from '@/core/components/Skeleton';
import { EmptyState } from '@/core/components/EmptyState';
import { SearchInput } from '@/core/components/SearchInput';
import { Pagination } from '@/core/components/Pagination';
import { RoleBadge } from '@/core/components/Badge';
import { useAsyncData } from '@/core/hooks/useAsyncData';
import { useTableControls } from '@/core/hooks/useTableControls';
import { listUsers } from '@/core/lib/usersApi';
import { listHalls } from '@/core/lib/hallsApi';
import { PAGE_SIZE, ROLE_LABELS } from '@/core/utils/constants';
import { IconPlus, IconUsers } from '@/core/components/icons';
import { CreateUserModal } from '@/admin/components/CreateUserModal';

/** Users tab of Admin -> Team & Buyers (/admin/team). Same table/behavior as the old standalone Users page. */
export function UsersPanel() {
  const { data: users, loading, error, setData } = useAsyncData(listUsers, []);
  const { data: halls } = useAsyncData(listHalls, []);
  const [modalOpen, setModalOpen] = useState(false);

  const rows = users || [];

  const { search, setSearch, page, setPage, totalPages, totalCount, pageRows } = useTableControls(rows, {
    searchFields: ['full_name', 'email'],
  });

  function handleCreated(profile) {
    setData((prev) => [profile, ...(prev || [])]);
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
          <TableSkeleton rows={6} cols={4} />
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
    </div>
  );
}
