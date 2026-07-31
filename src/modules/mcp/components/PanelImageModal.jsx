import { useState } from 'react';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { FileUpload } from '@/shared/components/FileUpload';
import { uploadAndSetPanelImage } from '@/modules/mcp/api/panelsApi';
import { useToast } from '@/shared/context/ToastContext';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png'];
const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png'];

function isAcceptedImage(file) {
  if (ACCEPTED_TYPES.includes(file.type)) return true;
  const name = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

/** Mirrors MCS's SampleImageModal — see that file for the layout rationale. */
export function PanelImageModal({ open, panel, onClose, onSaved }) {
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
      const updated = await uploadAndSetPanelImage({ panel, file });
      toast.success('Panel image updated');
      onSaved?.(updated);
      handleClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!panel) return null;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Panel Image"
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
          <span className="font-mono text-ink font-medium">{panel.panel_code}</span> · {panel.panel_name}
        </p>

        {panel.image_url && !file && (
          <div>
            <p className="text-caption font-medium text-ink-secondary mb-1.5">Current Image</p>
            <img
              src={panel.image_url}
              alt={panel.panel_name}
              className="w-full h-40 object-cover rounded-control border border-border"
            />
          </div>
        )}

        <div>
          <p className="text-caption font-medium text-ink-secondary mb-1.5">
            {panel.image_url ? 'Replace Image' : 'Upload Image'}
          </p>
          <FileUpload value={file} onChange={handleFileChange} accept=".jpg,.jpeg,.png" />
        </div>

        {error && <p className="text-caption text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
