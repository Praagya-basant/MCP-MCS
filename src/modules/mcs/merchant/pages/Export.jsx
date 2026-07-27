import { useState } from 'react';
import { PageHeader } from '@/shared/components/PageHeader';
import { Card } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { useAuth } from '@/shared/context/AuthContext';
import { useToast } from '@/shared/context/ToastContext';
import { listSamples } from '@/modules/mcs/api/samplesApi';
import { listMovements } from '@/modules/mcs/api/movementsApi';
import { exportToExcel } from '@/shared/lib/excelExport';
import { cn } from '@/shared/utils/cn';
import { IconBox, IconHistory, IconDownload } from '@/shared/components/icons';
import { formatDateTime } from '@/shared/utils/formatters';

const OPTIONS = [
  { id: 'samples', label: 'Sample List Only', description: 'Current status and location of every sample.', icon: IconBox },
  { id: 'history', label: 'Full History Only', description: 'Every movement.', icon: IconHistory },
  { id: 'both', label: 'Both', description: 'Sample list and full history in one file.', icon: IconDownload },
];

function samplesToRows(samples) {
  return samples.map((s) => ({
    'BT Code': s.bt_code,
    'Product Name': s.product_name,
    'Product Ref': s.product_ref || '',
    Status: s.status === 'checked_out' ? 'Issued' : 'In Hall',
    Hall: s.hall?.hall_number ?? '',
    'Added On': formatDateTime(s.created_at),
  }));
}

function movementsToRows(movements) {
  return movements.map((m) => ({
    'BT Code': m.sample?.bt_code,
    'Product Name': m.sample?.product_name,
    'Picked By': m.picked_by_name,
    Destination: m.destination,
    Reason: m.reason === 'Other' ? m.reason_other : m.reason,
    Status: m.status === 'out' ? 'Out' : 'Returned',
    'Picked At': formatDateTime(m.picked_at),
    'Returned At': m.returned_at ? formatDateTime(m.returned_at) : '',
    Notes: m.notes || '',
  }));
}

export default function Export() {
  const { profile } = useAuth();
  const toast = useToast();
  const { data: samples, loading: samplesLoading } = useAsyncData(listSamples, []);
  const { data: movements, loading: movementsLoading } = useAsyncData(listMovements, []);
  const [selected, setSelected] = useState('samples');
  const [exporting, setExporting] = useState(false);

  const loading = samplesLoading || movementsLoading;

  function handleExport() {
    setExporting(true);
    try {
      const buyerName = profile?.buyer?.name?.replace(/[^a-z0-9]+/gi, '_') || 'buyer';
      const sheets = [];

      if (selected === 'samples' || selected === 'both') {
        sheets.push({ sheetName: 'Samples', rows: samplesToRows(samples || []) });
      }
      if (selected === 'history' || selected === 'both') {
        sheets.push({ sheetName: 'Movement History', rows: movementsToRows(movements || []) });
      }

      exportToExcel(sheets, `basant-ssm-${buyerName}-${selected}.xlsx`);
      toast.success('Export downloaded');
    } catch {
      toast.error('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Export" description="Download your sample data as an Excel file." />

      <Card className="p-6">
        <div className="flex flex-col gap-3 mb-6">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = selected === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setSelected(opt.id)}
                className={cn(
                  'interactive flex items-start gap-3 rounded-control border px-4 py-3 text-left',
                  active ? 'border-ink bg-surface-subtle' : 'border-border hover:bg-sidebar'
                )}
              >
                <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', active ? 'text-ink' : 'text-ink-muted')} />
                <div>
                  <p className="text-body font-medium text-ink">{opt.label}</p>
                  <p className="text-caption text-ink-secondary">{opt.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        <Button onClick={handleExport} loading={exporting} disabled={loading}>
          <IconDownload className="w-4 h-4" />
          Download Excel
        </Button>
      </Card>
    </div>
  );
}
