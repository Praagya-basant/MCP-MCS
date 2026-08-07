import { useState } from 'react';
import { Modal } from '@/core/components/Modal';
import { Button } from '@/core/components/Button';
import { FileUpload } from '@/core/components/FileUpload';
import { uploadAndSetSampleImage } from '@/modules/mcs/api/samplesApi';
import { useToast } from '@/core/context/ToastContext';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png'];
const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png'];

function isAcceptedImage(file) {
  if (ACCEPTED_TYPES.includes(file.type)) return true;
  const name = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

/**
 * Row-level camera-icon flow on Admin/Hall Samples. Shows the sample's
 * current image (if any) as a static preview, separate from the
 * FileUpload dropzone used to pick a replacement — reusing FileUpload's
 * own "current image" slot for both would surface its "Remove image"
 * link on the *existing* saved image too, which isn't a feature this
 * modal offers (only replace, not delete).
 */
export function SampleImageModal({ open, sample, onClose, onSaved }) {
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function handleClose() {
    setFile(null);
    setError('');
    onClose();
  }

  function handleFileChange(selected) {
    setError('');
    if (!selected) {
      setFile(null);
      return;
    }
    if (!isAcceptedImage(selected)) {
      setError('Unsupported file type. Upload a .jpg, .jpeg, or .png image.');
      return;
    }
    setFile(selected);
  }

  async function handleSave() {
    if (!file) return;
    setSaving(true);
    setError('');
    try {
      const updated = await uploadAndSetSampleImage({ sample, file });
      toast.success('Sample image updated');
      onSaved?.(updated);
      handleClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!sample) return null;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Sample Image"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving} disabled={!file}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-caption text-ink-secondary -mt-1">
          <span className="font-mono text-ink font-medium">{sample.bt_code}</span> · {sample.product_name}
        </p>

        {sample.image_url && !file && (
          <div>
            <p className="text-caption font-medium text-ink-secondary mb-1.5">Current Image</p>
            <img
              src={sample.image_url}
              alt={sample.product_name}
              className="w-full h-40 object-cover rounded-control border border-border"
            />
          </div>
        )}

        <div>
          <p className="text-caption font-medium text-ink-secondary mb-1.5">
            {sample.image_url ? 'Replace Image' : 'Upload Image'}
          </p>
          <FileUpload value={file} onChange={handleFileChange} accept=".jpg,.jpeg,.png" />
        </div>

        {error && <p className="text-caption text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
