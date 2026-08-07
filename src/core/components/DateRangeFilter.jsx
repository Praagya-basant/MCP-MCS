import { cn } from '@/core/utils/cn';

/**
 * Compact "From"/"To" date range control matching the height/border/
 * radius of the Select filters it sits next to (36px, rounded-control,
 * border-border) — used in place of two bare <input type="date">
 * elements, which render as full-width raw browser controls when their
 * width override loses to the shared Input component's own w-full.
 */
export function DateRangeFilter({ from, to, onFromChange, onToChange, className }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <label className="interactive h-9 flex items-center gap-1.5 rounded-control border border-border bg-card pl-2.5 pr-2 focus-within:ring-[1.5px] focus-within:ring-ink focus-within:border-ink">
        <span className="text-caption text-ink-muted shrink-0">From</span>
        <input
          type="date"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          className="h-full w-[118px] border-0 bg-transparent p-0 text-body text-ink focus:outline-none focus:ring-0"
        />
      </label>
      <label className="interactive h-9 flex items-center gap-1.5 rounded-control border border-border bg-card pl-2.5 pr-2 focus-within:ring-[1.5px] focus-within:ring-ink focus-within:border-ink">
        <span className="text-caption text-ink-muted shrink-0">To</span>
        <input
          type="date"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          className="h-full w-[118px] border-0 bg-transparent p-0 text-body text-ink focus:outline-none focus:ring-0"
        />
      </label>
    </div>
  );
}
