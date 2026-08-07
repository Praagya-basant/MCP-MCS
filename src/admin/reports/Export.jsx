import { useMemo, useState } from 'react';
import { PageHeader } from '@/core/components/PageHeader';
import { Card } from '@/core/components/Card';
import { Button } from '@/core/components/Button';
import { Select } from '@/core/components/Input';
import { DateRangeFilter } from '@/core/components/DateRangeFilter';
import { useAsyncData } from '@/core/hooks/useAsyncData';
import { useToast } from '@/core/context/ToastContext';
import { listSamples } from '@/modules/mcs/api/samplesApi';
import { listMovements } from '@/modules/mcs/api/movementsApi';
import { listPanels } from '@/modules/mcp/api/panelsApi';
import { listPanelMovements } from '@/modules/mcp/api/panelMovementsApi';
import { listBuyers } from '@/core/lib/buyersApi';
import { listHalls } from '@/core/lib/hallsApi';
import { exportToExcel } from '@/core/lib/excelExport';
import { cn } from '@/core/utils/cn';
import { IconBox, IconMove, IconLayers, IconDownload } from '@/core/components/icons';
import { formatDateTime } from '@/core/utils/formatters';

const DATASETS = [
  { id: 'samples', label: 'Samples', description: 'Every sample and its current status/location.', icon: IconBox },
  { id: 'movements', label: 'Sample Movements', description: 'Full sample movement log.', icon: IconMove },
  { id: 'panels', label: 'Panels', description: 'Every panel and its current status/location.', icon: IconLayers },
  { id: 'panelMovements', label: 'Panel Movements', description: 'Full panel movement log.', icon: IconMove },
];

function inRange(dateStr, from, to) {
  if (from && new Date(dateStr) < new Date(from)) return false;
  if (to && new Date(dateStr) > new Date(`${to}T23:59:59`)) return false;
  return true;
}

function samplesToRows(rows) {
  return rows.map((s) => ({
    'BT Code': s.bt_code,
    'Product Name': s.product_name,
    'Product Ref': s.product_ref || '',
    Buyer: s.buyer?.name || '',
    Hall: s.hall?.name || '',
    Status: s.status === 'checked_out' ? 'Issued' : 'In Hall',
    'Added On': formatDateTime(s.created_at),
  }));
}

function movementsToRows(rows) {
  return rows.map((m) => ({
    'BT Code': m.sample?.bt_code || '',
    'Product Name': m.sample?.product_name || '',
    Buyer: m.sample?.buyer?.name || '',
    Hall: m.sample?.hall?.name || '',
    'Picked By': m.picked_by_name || m.logged_by_profile?.full_name || '',
    Destination: m.destination || '',
    Reason: m.reason === 'Other' ? m.reason_other || 'Other' : m.reason,
    Status: m.status === 'out' ? 'Out' : 'Returned',
    'Picked At': formatDateTime(m.picked_at),
    'Returned At': m.returned_at ? formatDateTime(m.returned_at) : '',
  }));
}

function panelsToRows(rows) {
  return rows.map((p) => ({
    'Panel Code': p.panel_code,
    'Panel Name': p.panel_name,
    'Panel Ref': p.panel_ref || '',
    Buyer: p.is_shared ? 'Shared' : p.buyer?.name || '',
    Hall: p.hall?.name || '',
    Status: p.status === 'checked_out' ? 'Issued' : p.status === 'retired' ? 'Retired' : 'In Hall',
    'Added On': formatDateTime(p.created_at),
  }));
}

function panelMovementsToRows(rows) {
  return rows.map((m) => ({
    'Panel Code': m.panel?.panel_code || '',
    'Panel Name': m.panel?.panel_name || '',
    Buyer: m.panel?.buyer?.name || '',
    Hall: m.panel?.hall?.name || '',
    'Picked By': m.picked_by_name || m.logged_by_profile?.full_name || '',
    Destination: m.destination || '',
    Reason: m.reason === 'Other' ? m.reason_other || 'Other' : m.reason,
    Status: m.status === 'out' ? 'Out' : 'Returned',
    'Picked At': formatDateTime(m.picked_at),
    'Returned At': m.returned_at ? formatDateTime(m.returned_at) : '',
  }));
}

/**
 * Admin's "everything, with filters" export — one page bundling all four
 * MCS/MCP datasets into a single styled workbook, scoped by an optional
 * buyer/hall and date range (dates apply to the two movement sheets
 * only, samples/panels have no natural date-range field beyond
 * created_at which the buyer/hall filters already narrow).
 */
export default function AdminExport() {
  const toast = useToast();
  const { data: samples, loading: samplesLoading } = useAsyncData(listSamples, []);
  const { data: movements, loading: movementsLoading } = useAsyncData(listMovements, []);
  const { data: panels, loading: panelsLoading } = useAsyncData(listPanels, []);
  const { data: panelMovements, loading: panelMovementsLoading } = useAsyncData(listPanelMovements, []);
  const { data: buyers } = useAsyncData(listBuyers, []);
  const { data: halls } = useAsyncData(listHalls, []);

  const [selected, setSelected] = useState(() => new Set(['samples', 'movements', 'panels', 'panelMovements']));
  const [buyerId, setBuyerId] = useState('all');
  const [hallId, setHallId] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [exporting, setExporting] = useState(false);

  const loading = samplesLoading || movementsLoading || panelsLoading || panelMovementsLoading;

  const filteredSamples = useMemo(
    () =>
      (samples || []).filter(
        (s) => (buyerId === 'all' || s.buyer_id === buyerId) && (hallId === 'all' || s.hall_id === hallId)
      ),
    [samples, buyerId, hallId]
  );
  const filteredMovements = useMemo(
    () =>
      (movements || []).filter(
        (m) =>
          (buyerId === 'all' || m.sample?.buyer_id === buyerId) &&
          (hallId === 'all' || m.sample?.hall_id === hallId) &&
          inRange(m.picked_at, dateFrom, dateTo)
      ),
    [movements, buyerId, hallId, dateFrom, dateTo]
  );
  const filteredPanels = useMemo(
    () =>
      (panels || []).filter(
        (p) => (buyerId === 'all' || p.buyer_id === buyerId) && (hallId === 'all' || p.hall_id === hallId)
      ),
    [panels, buyerId, hallId]
  );
  const filteredPanelMovements = useMemo(
    () =>
      (panelMovements || []).filter(
        (m) =>
          (buyerId === 'all' || m.panel?.buyer_id === buyerId) &&
          (hallId === 'all' || m.panel?.hall_id === hallId) &&
          inRange(m.picked_at, dateFrom, dateTo)
      ),
    [panelMovements, buyerId, hallId, dateFrom, dateTo]
  );

  function toggleDataset(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleExport() {
    setExporting(true);
    try {
      const sheets = [];
      if (selected.has('samples')) sheets.push({ sheetName: 'Samples', rows: samplesToRows(filteredSamples) });
      if (selected.has('movements')) sheets.push({ sheetName: 'Sample Movements', rows: movementsToRows(filteredMovements) });
      if (selected.has('panels')) sheets.push({ sheetName: 'Panels', rows: panelsToRows(filteredPanels) });
      if (selected.has('panelMovements'))
        sheets.push({ sheetName: 'Panel Movements', rows: panelMovementsToRows(filteredPanelMovements) });

      if (!sheets.length) {
        toast.error('Select at least one dataset to export.');
        return;
      }

      const buyerName = buyers?.find((b) => b.id === buyerId)?.name;
      const hallName = halls?.find((h) => h.id === hallId)?.name;
      const subtitleParts = [buyerName, hallName].filter(Boolean);

      await exportToExcel(sheets, `basant-ssm-export-${Date.now()}.xlsx`, {
        title: 'BASANT SSM — Full Export',
        subtitle: subtitleParts.length ? subtitleParts.join(' · ') : 'All buyers · All halls',
      });
      toast.success('Export downloaded');
    } catch {
      toast.error('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Export" description="Download samples, panels and movement history as an Excel file." />

      <Card className="p-6">
        <p className="text-caption font-medium text-ink-secondary mb-3">Datasets</p>
        <div className="flex flex-col gap-3 mb-6">
          {DATASETS.map((opt) => {
            const Icon = opt.icon;
            const active = selected.has(opt.id);
            return (
              <button
                key={opt.id}
                onClick={() => toggleDataset(opt.id)}
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

        <p className="text-caption font-medium text-ink-secondary mb-3">Filters</p>
        <div className="flex flex-col gap-3 mb-6">
          <Select value={buyerId} onChange={(e) => setBuyerId(e.target.value)}>
            <option value="all">All buyers</option>
            {(buyers || []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <Select value={hallId} onChange={(e) => setHallId(e.target.value)}>
            <option value="all">All halls</option>
            {(halls || []).map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </Select>
          <div>
            <p className="text-caption text-ink-muted mb-1.5">Date range (movements only)</p>
            <DateRangeFilter from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
          </div>
        </div>

        <Button onClick={handleExport} loading={exporting} disabled={loading}>
          <IconDownload className="w-4 h-4" />
          Download Excel
        </Button>
      </Card>
    </div>
  );
}
