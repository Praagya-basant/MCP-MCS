import { PageHeader } from '@/shared/components/PageHeader';
import { Card } from '@/shared/components/Card';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/shared/components/Table';
import { TableSkeleton } from '@/shared/components/Skeleton';
import { EmptyState } from '@/shared/components/EmptyState';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { listHallsWithDetails } from '@/modules/mcs/api/hallsApi';

export default function Halls() {
  const { data: halls, loading } = useAsyncData(listHallsWithDetails, []);

  return (
    <div>
      <PageHeader title="Halls" description="All halls registered on the platform." />

      <Card>
        {loading ? (
          <TableSkeleton rows={5} cols={3} />
        ) : halls.length === 0 ? (
          <EmptyState title="No halls found" description="Halls are seeded from the database schema." />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Hall</Th>
                <Th>Assigned Manager</Th>
                <Th>Samples</Th>
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
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
