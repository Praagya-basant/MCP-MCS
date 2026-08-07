import { useState } from 'react';
import { Card } from '@/core/components/Card';
import { Button } from '@/core/components/Button';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/core/components/Table';
import { TableSkeleton } from '@/core/components/Skeleton';
import { EmptyState } from '@/core/components/EmptyState';
import { SearchInput } from '@/core/components/SearchInput';
import { Pagination } from '@/core/components/Pagination';
import { useAsyncData } from '@/core/hooks/useAsyncData';
import { useTableControls } from '@/core/hooks/useTableControls';
import { listBuyersWithDetails } from '@/core/lib/buyersApi';
import { PAGE_SIZE } from '@/core/utils/constants';
import { IconPlus, IconBuilding, IconUpload, IconEdit, IconTrash } from '@/core/components/icons';
import { AddBuyerModal } from '@/admin/components/AddBuyerModal';
import { EditBuyerModal } from '@/admin/components/EditBuyerModal';
import { UploadSamplesModal } from '@/modules/mcs/pages/admin/components/UploadSamplesModal';
import { DeleteBuyerModal } from '@/admin/components/DeleteBuyerModal';

/** Buyers tab of Admin -> Team & Buyers (/admin/team). Same table/behavior as the old standalone Buyers page. */
export function BuyersPanel() {
  const { data: buyers, loading, error, reload, setData } = useAsyncData(listBuyersWithDetails, []);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBuyer, setEditingBuyer] = useState(null);
  const [uploadForBuyer, setUploadForBuyer] = useState(null);
  const [deletingBuyer, setDeletingBuyer] = useState(null);

  const rows = buyers || [];

  const { search, setSearch, page, setPage, totalPages, totalCount, pageRows } = useTableControls(rows, {
    searchFields: ['name'],
  });

  function handleCreated(buyer) {
    setData((prev) => [...(prev || []), { sampleCount: 0, issuedCount: 0, contacts: [], ...buyer }]);
  }

  function handleUpdated(updatedBuyer) {
    setData((prev) => (prev || []).map((b) => (b.id === updatedBuyer.id ? { ...b, ...updatedBuyer } : b)));
  }

  function handleDeleted(deletedId) {
    setData((prev) => (prev || []).filter((b) => b.id !== deletedId));
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setModalOpen(true)}>
          <IconPlus className="w-4 h-4" />
          Add Buyer
        </Button>
      </div>

      <Card>
        <div className="px-4 py-3 border-b border-border">
          <SearchInput value={search} onChange={setSearch} placeholder="Search buyers..." className="max-w-xs" />
        </div>

        {loading ? (
          <TableSkeleton rows={6} cols={3} />
        ) : error ? (
          <EmptyState icon={<IconBuilding className="w-12 h-12 text-ink-muted" />} title="Couldn't load buyers" description={error.message} />
        ) : rows.length === 0 ? (
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
                        <Button size="sm" variant="ghost" aria-label="Delete buyer" onClick={() => setDeletingBuyer(b)}>
                          <IconTrash className="w-3.5 h-3.5" />
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

      <DeleteBuyerModal
        open={!!deletingBuyer}
        buyer={deletingBuyer}
        onClose={() => setDeletingBuyer(null)}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
