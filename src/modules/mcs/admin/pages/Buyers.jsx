import { useState } from 'react';
import { PageHeader } from '@/shared/components/PageHeader';
import { Card } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/shared/components/Table';
import { TableSkeleton } from '@/shared/components/Skeleton';
import { EmptyState } from '@/shared/components/EmptyState';
import { SearchInput } from '@/shared/components/SearchInput';
import { Pagination } from '@/shared/components/Pagination';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { useTableControls } from '@/shared/hooks/useTableControls';
import { listBuyersWithDetails } from '@/modules/mcs/api/buyersApi';
import { PAGE_SIZE } from '@/shared/utils/constants';
import { IconPlus, IconBuilding } from '@/shared/components/icons';
import { AddBuyerModal } from '@/modules/mcs/admin/components/AddBuyerModal';

export default function Buyers() {
  const { data: buyers, loading, setData } = useAsyncData(listBuyersWithDetails, []);
  const [modalOpen, setModalOpen] = useState(false);

  const { search, setSearch, page, setPage, totalPages, totalCount, pageRows } = useTableControls(
    buyers || [],
    { searchFields: ['name'] }
  );

  function handleCreated(buyer) {
    setData((prev) => [...(prev || []), { ...buyer, sampleCount: 0, contacts: [] }]);
  }

  return (
    <div>
      <PageHeader
        title="Buyers"
        description="Every buyer with samples signed into BASANT halls."
        actions={
          <Button onClick={() => setModalOpen(true)}>
            <IconPlus className="w-4 h-4" />
            Add Buyer
          </Button>
        }
      />

      <Card>
        <div className="px-4 py-3 border-b border-border">
          <SearchInput value={search} onChange={setSearch} placeholder="Search buyers..." className="max-w-xs" />
        </div>

        {loading ? (
          <TableSkeleton rows={6} cols={3} />
        ) : buyers.length === 0 ? (
          <EmptyState
            icon={<IconBuilding className="w-12 h-12 text-ink-muted" />}
            title="No buyers yet"
            description="Add your first buyer to start signing in samples for them."
            actionLabel="Add Buyer"
            onAction={() => setModalOpen(true)}
          />
        ) : pageRows.length === 0 ? (
          <EmptyState title="No matches" description="Try a different search term." />
        ) : (
          <>
            <Table>
              <Thead>
                <Tr>
                  <Th>Buyer</Th>
                  <Th>Samples</Th>
                  <Th>Merchant Contacts</Th>
                </Tr>
              </Thead>
              <Tbody>
                {pageRows.map((b) => (
                  <Tr key={b.id}>
                    <Td className="font-medium">{b.name}</Td>
                    <Td>{b.sampleCount}</Td>
                    <Td>
                      {b.contacts.length === 0 ? (
                        <span className="text-ink-muted">None assigned</span>
                      ) : (
                        <span>{b.contacts.map((c) => c.profile?.full_name).filter(Boolean).join(', ')}</span>
                      )}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
            <Pagination page={page} totalPages={totalPages} totalCount={totalCount} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </Card>

      <AddBuyerModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={handleCreated} />
    </div>
  );
}
