import { cn } from '@/core/utils/cn';

/** Simple on/off switch — labeled button, not a bare checkbox, so the click target is the whole row. */
export function Toggle({ checked, onChange, label, hint, disabled, className }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'interactive flex items-center justify-between gap-3 w-full text-left disabled:opacity-40 disabled:cursor-not-allowed',
        className
      )}
    >
      <span>
        {label && <span className="text-body font-medium text-ink">{label}</span>}
        {hint && <span className="block text-caption text-ink-muted">{hint}</span>}
      </span>
      <span
        className={cn(
          'interactive shrink-0 w-10 h-6 rounded-pill border flex items-center px-0.5',
          checked ? 'bg-ink border-ink justify-end' : 'bg-surface-subtle border-border-strong justify-start'
        )}
      >
        <span className="w-[18px] h-[18px] rounded-full bg-card shadow-card" />
      </span>
    </button>
  );
}
