import { useMemo, useRef, useState } from 'react';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/shared/components/Table';
import { useToast } from '@/shared/context/ToastContext';
import { uploadAndSetSampleImage } from '@/modules/mcs/api/samplesApi';
import { cn } from '@/shared/utils/cn';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png'];
const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png'];

function isAcceptedImage(file) {
  if (ACCEPTED_TYPES.includes(file.type)) return true;
  const name = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

function baseName(fileName) {
  return fileName.replace(/\.[^.]+$/, '').trim();
}

/**
 * Bulk-matches selected image files to samples by filename (filename
 * without extension == bt_code, case-insensitive) and uploads each match
 * via the same uploadAndSetSampleImage() path the per-row camera icon
 * uses — same storage layout, same "replace existing" behavior.
 *
 * Selected files are kept as raw state and matches are *derived* via
 * useMemo rather than computed once inside the change handler — matching
 * at selection time would freeze `matches` against whatever `samples`
 * happened to be in that instant (e.g. still `null` if the page's sample
 * list hadn't finished loading yet), silently leaving everything
 * "unmatched" with no way to recover short of re-picking the same files.
 * Deriving it keeps matches correct if `samples` arrives/changes after
 * the files were picked.
 */
export function BulkImageUploadModal({ open, samples, onClose, onUploaded }) {
  const toast = useToast();
  const inputRef = useRef(null);

  const [selectedFiles, setSelectedFiles] = useState(null);
  const [selectError, setSelectError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);

  function reset() {
    setSelectedFiles(null);
    setSelectError('');
    setUploading(false);
    setProgress(0);
    setResult(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    const accepted = files.filter(isAcceptedImage);
    if (accepted.length === 0) {
      setSelectError('No .jpg, .jpeg, or .png files found in that selection.');
      return;
    }

    setSelectError('');
    setSelectedFiles(accepted);
    setResult(null);
  }

  const matches = useMemo(() => {
    if (!selectedFiles) return null;
    return selectedFiles.map((file) => {
      const name = baseName(file.name);
      const sample = (samples || []).find((s) => s.bt_code?.toLowerCase() === name.toLowerCase()) || null;
      return { file, name, sample };
    });
  }, [selectedFiles, samples]);

  const matchedCount = (matches || []).filter((m) => m.sample).length;
  const unmatchedCount = (matches || []).filter((m) => !m.sample).length;

  async function handleUploadAll() {
    const toUpload = (matches || []).filter((m) => m.sample);
    if (toUpload.length === 0) return;

    setUploading(true);
    setProgress(0);
    let uploaded = 0;
    const failures = [];
    const updatedSamples = [];

    for (const m of toUpload) {
      try {
        const updated = await uploadAndSetSampleImage({ sample: m.sample, file: m.file });
        updatedSamples.push(updated);
        uploaded += 1;
      } catch (err) {
        failures.push({ name: m.name, message: err.message });
      }
      setProgress((p) => p + 1);
    }

    onUploaded?.(updatedSamples);
    setResult({ uploaded, unmatched: unmatchedCount, failures });
    toast.success(`${uploaded} uploaded, ${unmatchedCount} unmatched`);
    setUploading(false);
  }

  const total = matches?.length || 0;
  const pct = total > 0 ? Math.round((progress / total) * 100) : 0;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Upload Images"
      maxWidth="md:max-w-[640px]"
      footer={
        result ? (
          <Button onClick={handleClose}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={handleClose} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={handleUploadAll} loading={uploading} disabled={!matchedCount || uploading}>
              Upload All Matched
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-control bg-status-in-hall-bg px-4 py-3">
            <p className="text-body font-medium text-status-in-hall-text">{result.uploaded} image{result.uploaded === 1 ? '' : 's'} uploaded</p>
            <p className="mt-0.5 text-caption text-ink-secondary">
              {result.unmatched} file{result.unmatched === 1 ? '' : 's'} had no matching BT code.
            </p>
          </div>
          {result.failures.length > 0 && (
            <div>
              <p className="text-body font-medium text-ink mb-2">Failed ({result.failures.length})</p>
              <div className="max-h-40 overflow-y-auto scrollbar-thin border border-border rounded-control">
                <ul className="divide-y divide-border">
                  {result.failures.map((f, i) => (
                    <li key={`${f.name}-${i}`} className="px-3 py-2 text-caption flex items-center justify-between gap-3">
                      <span className="font-mono text-ink">{f.name}</span>
                      <span className="truncate text-red-600">{f.message}</span>
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
            Name each image file after its BT code, e.g. <span className="font-mono text-ink">BT0069C.jpg</span>
          </p>

          <div>
            <input
              ref={inputRef}
              type="file"
              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
              multiple
              className="hidden"
              onChange={(e) => {
                handleFiles(e.target.files);
                // Reset so picking the exact same file(s) again still fires
                // onChange next time — the browser only fires `change` when
                // the input's value actually differs from before.
                e.target.value = '';
              }}
            />
            <div
              onClick={() => inputRef.current?.click()}
              className={cn(
                'interactive cursor-pointer rounded-control border border-dashed flex flex-col items-center justify-center gap-1.5 px-4 py-6 text-center',
                selectError ? 'border-red-400 bg-red-50' : 'border-border-strong bg-surface'
              )}
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-ink-muted">
                <path d="M12 16V4m0 0L7 9m5-5l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M20 16v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-caption text-ink-secondary">
                {matches ? 'Click to choose more files' : 'Click to choose image files'}
              </span>
              <span className="text-caption text-ink-muted">.jpg, .jpeg, .png only</span>
            </div>
            {selectError && <p className="mt-1.5 text-caption text-red-600">{selectError}</p>}
          </div>

          {uploading && (
            <div>
              <div className="h-1.5 bg-surface-subtle rounded-full overflow-hidden">
                <div className="h-full bg-ink transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1.5 text-caption text-ink-muted">
                Uploading {progress} of {total}&hellip;
              </p>
            </div>
          )}

          {matches && !uploading && (
            <div>
              <p className="text-body font-medium text-ink mb-2">
                {matchedCount} matched, {unmatchedCount} unmatched
              </p>
              <div className="max-h-56 overflow-y-auto scrollbar-thin border border-border rounded-control">
                <Table>
                  <Thead>
                    <Tr>
                      <Th>File</Th>
                      <Th>Product Name</Th>
                      <Th>Status</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {matches.map((m, i) => (
                      <Tr key={`${m.name}-${i}`}>
                        <Td className="font-mono">{m.file.name}</Td>
                        <Td className="text-ink-secondary">{m.sample?.product_name || '—'}</Td>
                        <Td>
                          {m.sample ? (
                            <Badge className="bg-status-in-hall-bg text-status-in-hall-text">Matched</Badge>
                          ) : (
                            <Badge className="bg-red-50 text-red-600">No match</Badge>
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
