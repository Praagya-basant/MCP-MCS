import { motion } from 'framer-motion';
import { Button } from '@/core/components/Button';

function DefaultIllustration() {
  return (
    <svg width="40" height="40" viewBox="0 0 96 96" fill="none" className="text-ink-muted">
      <rect x="20" y="28" width="56" height="44" rx="6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M20 40h56" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="30" cy="34" r="1.5" fill="currentColor" />
      <circle cx="36" cy="34" r="1.5" fill="currentColor" />
      <path d="M32 52h20M32 60h32" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Standard "nothing here yet" treatment — every list/table/card grid in
 * the app renders this instead of blank space. Icon sits in a soft
 * circular backdrop (matching StatCard/NotificationBell's icon-circle
 * language) whether it's the default illustration or a page-supplied one
 * (callers just pass an <IconX /> at whatever size, this component owns
 * the circle around it).
 */
export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex flex-col items-center justify-center text-center py-12 px-6 ${className || ''}`}
    >
      <span className="w-20 h-20 rounded-full bg-surface-subtle flex items-center justify-center">
        {icon || <DefaultIllustration />}
      </span>
      <h3 className="mt-4 text-body-lg font-bold text-ink">{title}</h3>
      {description && <p className="mt-1 text-body text-ink-secondary max-w-sm">{description}</p>}
      {actionLabel && onAction && (
        <Button className="mt-6" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </motion.div>
  );
}
