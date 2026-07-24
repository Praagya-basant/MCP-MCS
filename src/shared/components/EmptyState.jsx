import { Button } from '@/shared/components/Button';

function DefaultIllustration() {
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none" className="text-ink-muted">
      <rect x="20" y="28" width="56" height="44" rx="6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M20 40h56" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="30" cy="34" r="1.5" fill="currentColor" />
      <circle cx="36" cy="34" r="1.5" fill="currentColor" />
      <path d="M32 52h20M32 60h32" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-12 px-6 ${className || ''}`}>
      {icon || <DefaultIllustration />}
      <h3 className="mt-4 text-body-lg font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 text-body text-ink-secondary max-w-sm">{description}</p>}
      {actionLabel && onAction && (
        <Button className="mt-6" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
