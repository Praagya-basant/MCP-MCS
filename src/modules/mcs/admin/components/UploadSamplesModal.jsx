import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { Select, FormField } from '@/shared/components/Input';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/shared/components/Table';
import { useAsyncData } from '@/shared/hooks/useAsyncData';
import { useToast } from '@/shared/context/ToastContext';
import { listHalls } from '@/modules/mcs/api/hallsApi';
import { bulkImportSamples } from '@/modules/mcs/api/samplesApi';
import { cn } from '@/shared/utils/cn';

const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls'];

/**
 * Column layout is fixed by spec, not read from a header row: first
 * sheet, data starting row 2 (row 1 is the header we skip), columns
 * A=S.N. (ignored), B=Product Image (ignored, embedded images aren't
 * read in this flow), C=BT Code, D=Product Ref, E=Product Name.
 */
async function parseExcelFile(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error('The workbook has no sheets.');

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
  return rows
    .slice(1)
    .map((row) => ({
      btCode: String(row[2] ?? '').trim(),
      productRef: String(row[3] ?? '').trim(),
      productName: String(row[4] ?? '').trim(),
    }))
    .filter((r) => r.btCode && r.productName);
}

function isAcceptedFile(file) {
  const name = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

export function UploadSamplesModal({ open, buyer, onClose, onImported }) {
  const toast = useToast();
  const inputRef = useRef(null);
  const { data: halls } = useAsyncData(listHalls, []);

  const [hallId, setHallId] = useState('');
  const [fileName, setFileName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [rows, setRows] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  function reset() {
    setHallId('');
    setFileName('');
    setDragOver(false);
    setParsing(false);
    setParseError('');
    setRows(null);
    setImporting(false);
    setResult(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleFiles(files) {
    const file = files?.[0];
    if (!file) return;

    setParseError('');
    setRows(null);
    setFileName(file.name);

    if (!isAcceptedFile(file)) {
      setParseError('Unsupported file type. Upload a .xlsx or .xls file.');
      setFileName('');
      return;
    }

    setParsing(true);
    try {
      const parsed = await parseExcelFile(file);
      if (parsed.length === 0) {
        setParseError('No valid rows found — every row is missing a BT Code or Product Name.');
        setFileName('');
        return;
      }
      setRows(parsed);
    } catch (err) {
      setParseError(err.message || 'Could not read that file. Make sure it’s a valid Excel workbook.');
      setFileName('');
    } finally {
      setParsing(false);
    }
  }

  async function handleImport() {
    setImporting(true);
    try {
      const { inserted, skipped } = await bulkImportSamples({ buyerId: buyer.id, hallId, rows });
      toast.success(`${inserted.length} sample${inserted.length === 1 ? '' : 's'} imported successfully, ${skipped.length} skipped as duplicates`);
      setResult({ insertedCount: inserted.length, skipped });
      onImported?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setImporting(false);
    }
  }

  if (!buyer) return null;

  const canImport = !!hallId && !!rows && rows.length > 0 && !parsing && !importing;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Upload Samples"
      maxWidth="max-w-[640px]"
      footer={
        result ? (
          <Button onClick={handleClose}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={handleClose} disabled={importing}>
              Cancel
            </Button>
            <Button onClick={handleImport} loading={importing} disabled={!canImport}>
              Import Samples
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-control bg-status-in-hall-bg px-4 py-3">
            <p className="text-body font-medium text-status-in-hall-text">
              {result.insertedCount} sample{result.insertedCount === 1 ? '' : 's'} imported successfully
            </p>
            <p className="mt-0.5 text-caption text-ink-secondary">
              Signed into {halls?.find((h) => h.id === hallId)?.name} for {buyer.name}.
            </p>
          </div>

          {result.skipped.length > 0 && (
            <div>
              <p className="text-body font-medium text-ink mb-2">
                Skipped duplicates ({result.skipped.length})
              </p>
              <div className="max-h-40 overflow-y-auto scrollbar-thin border border-border rounded-control">
                <ul className="divide-y divide-border">
                  {result.skipped.map((r, i) => (
                    <li key={`${r.btCode}-${i}`} className="px-3 py-2 text-caption text-ink-secondary flex items-center justify-between gap-3">
                      <span className="font-mono text-ink">{r.btCode}</span>
                      <span className="truncate">{r.productName}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <p className="text-caption text-ink-secondary -mt-1">
            Uploading samples for <span className="font-medium text-ink">{buyer.name}</span>
          </p>

          <FormField label="Hall" htmlFor="upload-hall" required hint="Default hall for every sample in this file">
            <Select id="upload-hall" value={hallId} onChange={(e) => setHallId(e.target.value)}>
              <option value="">Select hall</option>
              {(halls || []).map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Excel File" required>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleFiles(e.dataTransfer.files);
              }}
              className={cn(
                'interactive cursor-pointer rounded-control border border-dashed flex flex-col items-center justify-center gap-1.5 px-4 py-6 text-center',
                parseError ? 'border-red-400 bg-red-50' : dragOver ? 'border-ink bg-surface-subtle' : 'border-border-strong bg-surface'
              )}
            >
              {parsing ? (
                <>
                  <svg className="w-5 h-5 animate-spin text-ink-secondary" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  <span className="text-caption text-ink-secondary">Parsing {fileName}&hellip;</span>
                </>
              ) : rows ? (
                <>
                  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-status-in-hall-text">
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-caption text-ink font-medium">{fileName}</span>
                  <span className="text-caption text-ink-muted">
                    {rows.length} row{rows.length === 1 ? '' : 's'} parsed &middot; click or drop to replace
                  </span>
                </>
              ) : parseError ? (
                <>
                  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-red-500">
                    <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                  <span className="text-caption text-red-600">{parseError}</span>
                  <span className="text-caption text-ink-muted">Click or drop another file to try again</span>
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-ink-muted">
                    <path d="M12 16V4m0 0L7 9m5-5l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M20 16v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-caption text-ink-secondary">Click or drag an Excel file to upload</span>
                  <span className="text-caption text-ink-muted">.xlsx or .xls only</span>
                </>
              )}
            </div>
          </FormField>

          {rows && (
            <div>
              <p className="text-body font-medium text-ink mb-2">Preview</p>
              <div className="max-h-56 overflow-y-auto scrollbar-thin border border-border rounded-control">
                <Table>
                  <Thead>
                    <Tr>
                      <Th>BT Code</Th>
                      <Th>Product Ref</Th>
                      <Th>Product Name</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {rows.map((r, i) => (
                      <Tr key={`${r.btCode}-${i}`}>
                        <Td className="font-mono">{r.btCode}</Td>
                        <Td className="text-ink-secondary">{r.productRef || '—'}</Td>
                        <Td>{r.productName}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
