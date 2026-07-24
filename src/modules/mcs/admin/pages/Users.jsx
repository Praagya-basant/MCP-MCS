import { useState } from 'react';
import { PageHeader } from '@/shared/components/PageHeader';
import { Card } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/shared/components/Table';
import { TableSkeleton } from '@/shared/components/Skeleton';
import { EmptyState } from '@/shared/components/EmptyState';
import { SearchInput } from '@/shared/components/SearchInput';
import { Pagination } from '@/shared/components/Pagination';
import { RoleBadge } from '@/shared/components/Badge';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { useTableControls } from '@/shared/hooks/useTableControls';
import { listUsers } from '@/modules/mcs/api/usersApi';
import { listBuyers } from '@/modules/mcs/api/buyersApi';
import { listHalls } from '@/modules/mcs/api/hallsApi';
import { PAGE_SIZE, ROLE_LABELS } from '@/shared/utils/constants';
import { IconPlus, IconUsers } from '@/shared/components/icons';
import { CreateUserModal } from '@/modules/mcs/admin/components/CreateUserModal';

export default function Users() {
  const { data: users, loading, setData } = useAsyncData(listUsers, []);
  const { data: halls } = useAsyncData(listHalls, []);
  const { data: buyers } = useAsyncData(listBuyers, []);
  const [modalOpen, setModalOpen] = useState(false);

  const { search, setSearch, page, setPage, totalPages, totalCount, pageRows } = useTableControls(
    users || [],
    { searchFields: ['full_name', 'email'] }
  );

  function handleCreated(profile) {
    setData((prev) => [profile, ...(prev || [])]);
  }

  return (
    <div>
      <PageHeader
        title="Users"
        description="Everyone with a login across every hall and buyer."
        actions={
          <Button onClick={() => setModalOpen(true)}>
            <IconPlus className="w-4 h-4" />
            Create User
          </Button>
        }
      />

      <Card>
        <div className="px-4 py-3 border-b border-border">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name or email..." className="max-w-xs" />
        </div>

        {loading ? (
          <TableSkeleton rows={6} cols={4} />
        ) : users.length === 0 ? (
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
                      {u.hall ? `Hall ${u.hall.hall_number}` : u.buyer ? u.buyer.name : '—'}
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
        buyers={buyers || []}
      />
    </div>
  );
}
