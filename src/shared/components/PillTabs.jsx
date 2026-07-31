import { cn } from '@/shared/utils/cn';

/**
 * Segmented pill filter — e.g. the sample list's All / In Hall / Issued
 * status filter. Purely a controlled `value`/`onChange`; callers own the
 * actual filtering logic (see useTableControls' `setFilter`).
 */
export function PillTabs({ options, value, onChange, className }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'interactive select-none h-9 px-3.5 rounded-control text-body font-medium border whitespace-nowrap',
              active
                ? 'bg-accent text-accent-ink border-accent'
                : 'bg-card text-ink-secondary border-border hover:bg-surface-subtle hover:text-ink'
            )}
          >
            {opt.label}
            {opt.count !== undefined && (
              <span className={cn('ml-1.5', active ? 'text-accent-ink/70' : 'text-ink-muted')}>({opt.count})</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
