import { motion } from 'framer-motion';
import { cn } from '@/shared/utils/cn';

/**
 * Mobile card-list equivalent of Table/Tr — used below `md:` where a
 * multi-column table doesn't fit a phone screen. Pages keep their
 * existing `<Table>` for desktop (`hidden md:block`) and add a
 * `<CardList>` (`md:hidden`) reading the same already-fetched rows, one
 * `<CardListItem>` per row.
 */
export function CardList({ children }) {
  return <div className="flex flex-col gap-2">{children}</div>;
}

/**
 * `subtitle`/`trailing`/`meta` all accept any ReactNode, not just text —
 * `trailing` is typically a status badge, `meta` a wrapped row of smaller
 * badges/labels (e.g. reason + date) below the title/subtitle. `actions`
 * is an optional bottom row (row-level buttons, e.g. camera/edit/delete)
 * — rendered inside its own `stopPropagation` wrapper so tapping an
 * action doesn't also trigger the card's own `onClick`.
 */
export function CardListItem({ onClick, leading, title, subtitle, trailing, meta, actions, className }) {
  return (
    <motion.div
      onClick={onClick}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={cn(
        'interactive bg-card border border-border rounded-card px-4 py-3 flex flex-col gap-2.5 min-h-[44px] shadow-card',
        onClick && 'cursor-pointer active:bg-surface-subtle',
        className
      )}
    >
      <div className="flex items-start gap-3">
        {leading && <div className="shrink-0 mt-0.5">{leading}</div>}
        <div className="min-w-0 flex-1 flex flex-col gap-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-body font-medium text-ink truncate">{title}</p>
              {subtitle && <p className="text-caption text-ink-secondary truncate">{subtitle}</p>}
            </div>
            {trailing && <div className="shrink-0">{trailing}</div>}
          </div>
          {meta && <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-caption text-ink-secondary">{meta}</div>}
        </div>
      </div>
      {actions && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex items-center justify-end gap-1 border-t border-border pt-2 -mb-1"
        >
          {actions}
        </div>
      )}
    </motion.div>
  );
}
