import { useRef, useState } from 'react';
import { cn } from '@/shared/utils/cn';

/**
 * `capture` is forwarded as-is to the underlying input (e.g.
 * `capture="environment"`) — on mobile that opens the camera directly
 * instead of a gallery/file chooser; desktop browsers ignore it and just
 * show the normal file picker, so one input covers both per the "camera
 * on mobile, file picker on desktop" requirement with no platform branch.
 */
export function FileUpload({ value, onChange, accept = 'image/*', capture, className }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  function handleFiles(files) {
    const file = files?.[0];
    if (!file) return;
    onChange(file);
  }

  const previewUrl = value instanceof File ? URL.createObjectURL(value) : value;

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        capture={capture}
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
          'interactive cursor-pointer rounded-control border border-dashed flex items-center justify-center overflow-hidden',
          dragOver ? 'border-ink bg-surface-subtle' : 'border-border-strong bg-surface',
          previewUrl ? 'h-40' : 'h-32'
        )}
      >
        {previewUrl ? (
          <img src={previewUrl} alt="Sample preview" className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-ink-muted px-4 text-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
              <path
                d="M12 16V4m0 0L7 9m5-5l5 5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M20 16v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-caption">Click or drag an image to upload</span>
          </div>
        )}
      </div>
      {previewUrl && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChange(null);
          }}
          className="mt-2 text-caption text-ink-secondary hover:text-ink interactive"
        >
          Remove image
        </button>
      )}
    </div>
  );
}
