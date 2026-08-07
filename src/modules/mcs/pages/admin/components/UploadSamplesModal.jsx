import { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Modal } from '@/core/components/Modal';
import { Button } from '@/core/components/Button';
import { Select, FormField } from '@/core/components/Input';
import { Badge } from '@/core/components/Badge';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/core/components/Table';
import { useAsyncData } from '@/core/hooks/useAsyncData';
import { useToast } from '@/core/context/ToastContext';
import { listHalls } from '@/core/lib/hallsApi';
import { bulkImportSamples, uploadAndSetSampleImage } from '@/modules/mcs/api/samplesApi';
import { extractSpreadsheetImages } from '@/core/lib/extractSpreadsheetImages';
import { cn } from '@/core/utils/cn';

const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls'];

const HEADER_ALIASES = {
  btCode: ['btcode'],
  productName: ['productname', 'name', 'itemname'],
  productRef: ['productref', 'ref', 'reference'],
  hall: ['hall', 'hallno', 'hallnumber'],
};

// Column-position fallback when the header row doesn't match known
// aliases: A=S.N., B=Product Image (both ignored), C=BT Code,
// D=Product Ref, E=Product Name, F=Hall.
const FALLBACK_COLUMNS = { btCode: 2, productRef: 3, productName: 4, hall: 5 };

function normalizeHeader(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function detectColumns(headerRow) {
  const columns = {};
  (headerRow || []).forEach((cell, index) => {
    const normalized = normalizeHeader(cell);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (columns[field] === undefined && aliases.includes(normalized)) {
        columns[field] = index;
      }
    }
  });
  return columns;
}

/** Resolves an Excel hall cell (e.g. "5", "Hall 5", "Mandore") against the halls table by name or hall_number. */
function resolveHall(raw, halls) {
  const value = String(raw ?? '').trim();
  if (!value) return null;

  const byName = (halls || []).find((h) => h.name?.toLowerCase() === value.toLowerCase());
  if (byName) return byName;

  const numMatch = value.match(/(\d+)/);
  if (numMatch) {
    const num = Number(numMatch[1]);
    const byNumber = (halls || []).find((h) => h.hall_number === num);
    if (byNumber) return byNumber;
  }
  return null;
}

/**
 * Parses raw rows only — no hall dropdown fallback is applied here, since
 * the fallback hall can be picked (or changed) after the file is already
 * parsed. `hallRaw` stays empty when the sheet has no Hall column at all
 * or the cell itself is blank, which is exactly the signal
 * applyHallFallback() below uses to decide whether to fall back to the
 * dropdown.
 */
async function parseExcelFile(file, halls) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error('The workbook has no sheets.');

  const sheetRows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
  if (sheetRows.length === 0) return [];

  const detected = detectColumns(sheetRows[0]);
  const columns = {
    btCode: detected.btCode !== undefined && detected.productName !== undefined ? detected.btCode : FALLBACK_COLUMNS.btCode,
    productName: detected.btCode !== undefined && detected.productName !== undefined ? detected.productName : FALLBACK_COLUMNS.productName,
    productRef: detected.btCode !== undefined && detected.productName !== undefined ? detected.productRef : FALLBACK_COLUMNS.productRef,
    hall: detected.btCode !== undefined && detected.productName !== undefined ? detected.hall : FALLBACK_COLUMNS.hall,
  };

  return sheetRows
    .slice(1)
    .map((row, rowIndex) => {
      const btCode = String(row[columns.btCode] ?? '').trim();
      const productName = String(row[columns.productName] ?? '').trim();
      const productRef = columns.productRef !== undefined ? String(row[columns.productRef] ?? '').trim() : '';
      const hallRaw = columns.hall !== undefined ? String(row[columns.hall] ?? '').trim() : '';
      const matchedHall = resolveHall(hallRaw, halls);

      // rowIndex tracks this row's position among data rows (before the
      // filter below can drop blank ones) so it lines up with
      // extractSpreadsheetImages()'s dataRowIndex keys, letting us
      // re-match an embedded image back to its row after import.
      return { btCode, productRef, productName, hallRaw, matchedHall, rowIndex };
    })
    .filter((r) => r.btCode || r.productName || r.hallRaw);
}

/**
 * Applies the fallback dropdown hall to rows whose file didn't supply one
 * (no Hall column, or a blank cell) and computes each row's final
 * Valid/Error status. Rows that DID have a hall value in the file, but it
 * didn't match any known hall, still error out — the dropdown is a
 * fallback for missing data, not a way to override a bad value.
 */
function applyHallFallback(parsedRows, halls, fallbackHallId) {
  const fallbackHall = (halls || []).find((h) => h.id === fallbackHallId) || null;

  return (parsedRows || []).map((r) => {
    let hall = r.matchedHall;
    let status = 'valid';
    let errorReason = '';

    if (!r.btCode) {
      status = 'error';
      errorReason = 'Missing BT Code';
    } else if (!r.productName) {
      status = 'error';
      errorReason = 'Missing Product Name';
    } else if (!r.hallRaw) {
      if (fallbackHall) {
        hall = fallbackHall;
      } else {
        status = 'error';
        errorReason = 'Missing Hall — select a fallback hall';
      }
    } else if (!r.matchedHall) {
      status = 'error';
      errorReason = `Unrecognized hall "${r.hallRaw}"`;
    }

    return {
      ...r,
      hallId: hall?.id || null,
      hallName: hall?.name || r.hallRaw,
      status,
      errorReason,
    };
  });
}

function isAcceptedFile(file) {
  const name = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

export function UploadSamplesModal({ open, buyer, onClose, onImported }) {
  const toast = useToast();
  const inputRef = useRef(null);
  const { data: halls } = useAsyncData(listHalls, []);

  const [fallbackHallId, setFallbackHallId] = useState('');
  const [fileName, setFileName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [parsedRows, setParsedRows] = useState(null);
  const [imagesByRow, setImagesByRow] = useState(new Map());
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  const rows = useMemo(
    () => (parsedRows ? applyHallFallback(parsedRows, halls, fallbackHallId) : null),
    [parsedRows, halls, fallbackHallId]
  );

  function reset() {
    setFallbackHallId('');
    setFileName('');
    setDragOver(false);
    setParsing(false);
    setParseError('');
    setParsedRows(null);
    setImagesByRow(new Map());
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
    setParsedRows(null);
    setImagesByRow(new Map());
    setFileName(file.name);

    if (!isAcceptedFile(file)) {
      setParseError('Unsupported file type. Upload a .xlsx or .xls file.');
      setFileName('');
      return;
    }

    setParsing(true);
    try {
      const [parsed, images] = await Promise.all([
        parseExcelFile(file, halls),
        // Embedded images are a .xlsx-only feature (drawing parts don't
        // exist in the legacy .xls binary format) — extraction quietly
        // no-ops for a .xls upload rather than erroring the whole import.
        extractSpreadsheetImages(file).catch(() => new Map()),
      ]);
      if (parsed.length === 0) {
        setParseError('No rows found in that file.');
        setFileName('');
        return;
      }
      setParsedRows(parsed);
      setImagesByRow(images);
    } catch (err) {
      setParseError(err.message || 'Could not read that file. Make sure it’s a valid Excel workbook.');
      setFileName('');
    } finally {
      setParsing(false);
    }
  }

  const validRows = (rows || []).filter((r) => r.status === 'valid');
  const errorRows = (rows || []).filter((r) => r.status === 'error');

  async function handleImport() {
    setImporting(true);
    try {
      const { inserted, skipped } = await bulkImportSamples({ buyerId: buyer.id, rows: validRows });

      let imagesUploaded = 0;
      if (imagesByRow.size > 0 && inserted.length > 0) {
        const rowIndexByBtCode = new Map(validRows.map((r) => [r.btCode, r.rowIndex]));
        const uploads = inserted.map(async (sample) => {
          const rowIndex = rowIndexByBtCode.get(sample.bt_code);
          const image = rowIndex !== undefined ? imagesByRow.get(rowIndex) : undefined;
          if (!image) return;
          try {
            const file = new File([image.blob], `${sample.bt_code}.${image.extension}`, { type: image.blob.type || `image/${image.extension}` });
            await uploadAndSetSampleImage({ sample, file });
            imagesUploaded += 1;
          } catch {
            // A single row's image failing to upload shouldn't roll back
            // or block the rest — the sample itself already imported
            // fine, it just keeps a blank image_url like any other
            // manually-added sample.
          }
        });
        await Promise.all(uploads);
      }

      toast.success(
        `${inserted.length} sample${inserted.length === 1 ? '' : 's'} imported successfully, ${skipped.length} skipped as duplicates` +
          (imagesUploaded > 0 ? `, ${imagesUploaded} image${imagesUploaded === 1 ? '' : 's'} matched` : '')
      );
      setResult({ insertedCount: inserted.length, skipped, errorRows, imagesFoundCount: imagesByRow.size, imagesUploaded });
      onImported?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setImporting(false);
    }
  }

  if (!buyer) return null;

  const canImport = !!rows && validRows.length > 0 && !parsing && !importing;

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
            <p className="mt-0.5 text-caption text-ink-secondary">for {buyer.name}.</p>
            {result.imagesFoundCount > 0 && (
              <p className="mt-1 text-caption text-ink-secondary">
                {result.imagesFoundCount} image{result.imagesFoundCount === 1 ? '' : 's'} found in the file, {result.imagesUploaded}{' '}
                matched to an imported row and uploaded.
              </p>
            )}
          </div>

          {result.skipped.length > 0 && (
            <div>
              <p className="text-body font-medium text-ink mb-2">Skipped duplicates ({result.skipped.length})</p>
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

          {result.errorRows.length > 0 && (
            <div>
              <p className="text-body font-medium text-ink mb-2">Not imported — errors ({result.errorRows.length})</p>
              <div className="max-h-40 overflow-y-auto scrollbar-thin border border-border rounded-control">
                <ul className="divide-y divide-border">
                  {result.errorRows.map((r, i) => (
                    <li key={`${r.btCode}-${i}`} className="px-3 py-2 text-caption text-ink-secondary flex items-center justify-between gap-3">
                      <span className="font-mono text-ink">{r.btCode || '—'}</span>
                      <span className="truncate text-red-600">{r.errorReason}</span>
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
            Uploading samples for <span className="font-medium text-ink">{buyer.name}</span> — hall is read from each
            row's Hall column when present, otherwise falls back to the hall selected below.
          </p>

          <FormField label="Fallback Hall" htmlFor="upload-fallback-hall" hint="Used for rows with no Hall column, or a blank Hall cell">
            <Select id="upload-fallback-hall" value={fallbackHallId} onChange={(e) => setFallbackHallId(e.target.value)}>
              <option value="">No fallback selected</option>
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
                    {validRows.length} valid, {errorRows.length} error{errorRows.length === 1 ? '' : 's'}
                    {imagesByRow.size > 0 ? `, ${imagesByRow.size} image${imagesByRow.size === 1 ? '' : 's'} found` : ''} &middot; click
                    or drop to replace
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
                      <Th>Product Name</Th>
                      <Th>Product Ref</Th>
                      <Th>Hall</Th>
                      <Th>Status</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {rows.map((r, i) => (
                      <Tr key={`${r.btCode}-${i}`}>
                        <Td className="font-mono">{r.btCode || '—'}</Td>
                        <Td>{r.productName || '—'}</Td>
                        <Td className="text-ink-secondary">{r.productRef || '—'}</Td>
                        <Td className="text-ink-secondary">{r.hallName || '—'}</Td>
                        <Td>
                          {r.status === 'valid' ? (
                            <Badge className="bg-status-in-hall-bg text-status-in-hall-text">Valid</Badge>
                          ) : (
                            <span title={r.errorReason}>
                              <Badge className="bg-red-50 text-red-600">Error</Badge>
                            </span>
                          )}
                        </Td>
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
