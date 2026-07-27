import { useState } from 'react';
import { PageHeader } from '@/shared/components/PageHeader';
import { Card } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/shared/components/Table';
import { TableSkeleton } from '@/shared/components/Skeleton';
import { EmptyState } from '@/shared/components/EmptyState';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { listHallsWithDetails } from '@/modules/mcs/api/hallsApi';
import { IconPlus, IconEdit } from '@/shared/components/icons';
import { HallFormModal } from '@/modules/mcs/admin/components/HallFormModal';

export default function Halls() {
  const { data: halls, loading, reload } = useAsyncData(listHallsWithDetails, []);
  const [modalHall, setModalHall] = useState(undefined);

  return (
    <div>
      <PageHeader
        title="Halls"
        description="All halls registered on the platform."
        actions={
          <Button onClick={() => setModalHall(null)}>
            <IconPlus className="w-4 h-4" />
            Add Hall
          </Button>
        }
      />

      <Card>
        {loading ? (
          <TableSkeleton rows={5} cols={3} />
        ) : halls.length === 0 ? (
          <EmptyState title="No halls found" description="Add a hall to get started." actionLabel="Add Hall" onAction={() => setModalHall(null)} />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Hall</Th>
                <Th>Assigned Manager</Th>
                <Th>Samples</Th>
                <Th></Th>
              </Tr>
            </Thead>
            <Tbody>
              {halls.map((h) => (
                <Tr key={h.id}>
                  <Td className="font-medium">{h.name}</Td>
                  <Td>
                    {h.managers.length === 0 ? (
                      <span className="text-ink-muted">Unassigned</span>
                    ) : (
                      h.managers.map((m) => m.full_name).join(', ')
                    )}
                  </Td>
                  <Td>{h.sampleCount}</Td>
                  <Td className="text-right">
                    <Button size="sm" variant="ghost" aria-label="Rename hall" onClick={() => setModalHall(h)}>
                      <IconEdit className="w-4 h-4" />
                    </Button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Card>

      <HallFormModal open={modalHall !== undefined} hall={modalHall} onClose={() => setModalHall(undefined)} onSaved={reload} />
    </div>
  );
}
