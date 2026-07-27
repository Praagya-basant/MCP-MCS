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
import { IconPlus, IconBuilding, IconUpload, IconEdit } from '@/shared/components/icons';
import { AddBuyerModal } from '@/modules/mcs/admin/components/AddBuyerModal';
import { EditBuyerModal } from '@/modules/mcs/admin/components/EditBuyerModal';
import { UploadSamplesModal } from '@/modules/mcs/admin/components/UploadSamplesModal';

export default function Buyers() {
  const { data: buyers, loading, reload, setData } = useAsyncData(listBuyersWithDetails, []);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBuyer, setEditingBuyer] = useState(null);
  const [uploadForBuyer, setUploadForBuyer] = useState(null);

  const { search, setSearch, page, setPage, totalPages, totalCount, pageRows } = useTableControls(
    buyers || [],
    { searchFields: ['name'] }
  );

  function handleCreated(buyer) {
    setData((prev) => [...(prev || []), { sampleCount: 0, contacts: [], ...buyer }]);
  }

  function handleUpdated(updatedBuyer) {
    setData((prev) => (prev || []).map((b) => (b.id === updatedBuyer.id ? { ...b, ...updatedBuyer } : b)));
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
                  <Th></Th>
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
                    <Td>
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setEditingBuyer(b)}>
                          <IconEdit className="w-3.5 h-3.5" />
                          Edit
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setUploadForBuyer(b)}>
                          <IconUpload className="w-3.5 h-3.5" />
                          Upload Samples
                        </Button>
                      </div>
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

      <EditBuyerModal
        open={!!editingBuyer}
        buyer={editingBuyer}
        onClose={() => setEditingBuyer(null)}
        onUpdated={handleUpdated}
      />

      <UploadSamplesModal
        open={!!uploadForBuyer}
        buyer={uploadForBuyer}
        onClose={() => setUploadForBuyer(null)}
        onImported={reload}
      />
    </div>
  );
}
