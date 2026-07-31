import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/shared/utils/cn';

/**
 * Right-side panel, 480px wide at md: and up — full-screen below that
 * (max-width only kicks in at md:, so mobile is always the full viewport
 * width regardless of exact device size, not just "coincidentally full
 * width" because most phones happen to be under 480px). Stays mounted for
 * the 0.25s close transition (mounted vs. visible are separate states)
 * instead of vanishing instantly, so both open and close animate.
 * Deliberately has no built-in header/title bar — callers with rich
 * headers (e.g. the sample detail drawer's image + badges) render their
 * own; pass a plain `title` for a simple text + close-button bar instead.
 */
export function Drawer({ open, onClose, title, children }) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
    const timer = setTimeout(() => setMounted(false), 250);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [mounted, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className={cn('drawer-overlay absolute inset-0 bg-black/40', visible ? 'opacity-100' : 'opacity-0')}
        onClick={onClose}
      />
      <div
        className={cn(
          'drawer-panel relative w-full md:max-w-[480px] h-full bg-card shadow-xl flex flex-col',
          visible ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {title && (
          <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
            <h2 className="text-heading font-semibold text-ink truncate select-none">{title}</h2>
            <button
              onClick={onClose}
              className="text-ink-muted hover:text-ink interactive shrink-0"
              aria-label="Close"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto scrollbar-thin flex flex-col min-h-0">{children}</div>
      </div>
    </div>,
    document.body
  );
}
