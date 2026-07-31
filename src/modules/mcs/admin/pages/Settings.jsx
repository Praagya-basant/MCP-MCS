import { useState } from 'react';
import { PageHeader } from '@/shared/components/PageHeader';
import { Button } from '@/shared/components/Button';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { listMovements } from '@/modules/mcs/api/movementsApi';
import { IconTrash } from '@/shared/components/icons';
import { ClearMovementHistoryDialog } from '@/modules/mcs/admin/components/ClearMovementHistoryDialog';

/**
 * Home for dangerous/irreversible admin actions — kept separate from the
 * main Movements view so a routine visit there never sits next to a
 * "delete everything" button. Currently just Clear Test Data (moved here
 * from Movements), but this is where future admin-only utilities belong.
 */
export default function AdminSettings() {
  const { data: movements, loading, reload } = useAsyncData(listMovements, []);
  const [clearOpen, setClearOpen] = useState(false);

  return (
    <div>
      <PageHeader title="Settings" description="Admin-only configuration and maintenance." />

      <div className="bg-card border border-error/25 rounded-card shadow-card px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-error shrink-0">
            <IconTrash className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-body-lg font-semibold text-ink">Clear Test Data</h2>
            <p className="mt-0.5 text-body text-ink-secondary max-w-md">
              Permanently deletes every movement record across every hall and buyer. Use this to
              wipe test movements before going live — it cannot be undone.
            </p>
          </div>
        </div>
        <Button variant="danger" onClick={() => setClearOpen(true)} disabled={loading || (movements || []).length === 0}>
          Clear Test Data
        </Button>
      </div>

      <ClearMovementHistoryDialog open={clearOpen} onClose={() => setClearOpen(false)} onCleared={reload} />
    </div>
  );
}
