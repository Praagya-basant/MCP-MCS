import { useEffect, useRef, useState } from 'react';
import { Button } from '@/shared/components/Button';
import { cn } from '@/shared/utils/cn';

/**
 * Draw-to-sign canvas — mouse on desktop, finger on mobile, both handled
 * uniformly via the Pointer Events API (no separate touch/mouse code
 * paths). Canvas backing size is scaled by devicePixelRatio so strokes
 * stay crisp on high-DPI phone screens instead of blurring.
 *
 * Uncontrolled-ish: calls `onChange(blob | null)` with a PNG blob after
 * every completed stroke (and `null` on Clear) — the parent just holds
 * onto whatever blob it was last given, there's no `value` prop to feed
 * back in (a signature isn't meaningfully "resumable" once cleared).
 */
export function SignaturePad({ onChange, className }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef(null);
  const [hasStrokes, setHasStrokes] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    function resize() {
      const rect = container.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      const ctx = canvas.getContext('2d');
      const prevData = hasStrokes ? canvas.toDataURL() : null;

      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#1A1A1A';

      // Resizing clears the canvas's pixel buffer — redraw whatever was
      // already signed so rotating a phone mid-signature doesn't wipe it.
      if (prevData) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
        img.src = prevData;
      }
    }

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getPoint(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e) {
    e.preventDefault();
    canvasRef.current.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastPointRef.current = getPoint(e);
  }

  function handlePointerMove(e) {
    if (!drawingRef.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const point = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPointRef.current = point;
  }

  function finishStroke() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    setHasStrokes(true);
    canvasRef.current.toBlob((blob) => onChange?.(blob), 'image/png');
  }

  function handleClear() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const ratio = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / ratio, canvas.height / ratio);
    setHasStrokes(false);
    onChange?.(null);
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div
        ref={containerRef}
        className="relative h-40 rounded-control border border-border bg-surface touch-none"
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full cursor-crosshair"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishStroke}
          onPointerLeave={finishStroke}
        />
        {!hasStrokes && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-caption text-ink-muted">
            Sign here
          </p>
        )}
      </div>
      <Button type="button" variant="ghost" size="sm" className="self-end" onClick={handleClear} disabled={!hasStrokes}>
        Clear
      </Button>
    </div>
  );
}
