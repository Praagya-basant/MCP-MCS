import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/shared/utils/cn';

/**
 * Stays mounted for the close transition (mounted vs. visible are
 * separate states) instead of vanishing instantly, so both open and
 * close animate.
 *
 * Mobile (<md): bottom sheet — flush to the screen edges, slides up from
 * the bottom, only the top corners rounded. Desktop (md:+): today's
 * centered dialog, unchanged. `maxWidth` only takes effect at md: and up
 * (callers pass it pre-prefixed, e.g. `"md:max-w-[640px]"` — Tailwind's
 * static scanner needs the literal class string in source, so it can't be
 * built by prefixing a plain `"max-w-[640px]"` at runtime here).
 */
export function Modal({ open, onClose, title, children, footer, maxWidth = 'md:max-w-[480px]' }) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
    const timer = setTimeout(() => setMounted(false), 200);
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
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4">
      <div
        className={cn('modal-overlay absolute inset-0 bg-black/40', visible ? 'opacity-100' : 'opacity-0')}
        onClick={onClose}
      />
      <div
        className={cn(
          'modal-panel relative w-full bg-card shadow-xl flex flex-col',
          'max-h-[92vh] rounded-t-2xl md:rounded-t-modal md:rounded-b-modal md:max-h-[90vh]',
          visible
            ? 'translate-y-0 opacity-100 md:scale-100'
            : 'translate-y-full opacity-0 md:translate-y-0 md:scale-[0.98]',
          maxWidth
        )}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
            <h2 className="text-heading font-semibold text-ink select-none">{title}</h2>
            <button
              onClick={onClose}
              className="interactive w-9 h-9 -mr-2 flex items-center justify-center text-ink-muted hover:text-ink"
              aria-label="Close"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>
        )}
        <div className="px-6 py-4 overflow-y-auto scrollbar-thin">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-2 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
