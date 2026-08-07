import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/core/utils/cn';

const VARIANTS = {
  primary:
    'bg-accent text-accent-ink hover:bg-accent-hover disabled:opacity-40',
  secondary:
    'bg-card text-ink border border-ink hover:bg-surface-subtle disabled:opacity-40',
  ghost:
    'bg-transparent text-ink hover:bg-surface-subtle disabled:opacity-40',
  danger:
    'bg-card text-error border border-error/25 hover:bg-error/10 disabled:opacity-40',
  success:
    'bg-success text-white hover:bg-success/90 disabled:opacity-40',
  warning:
    'bg-warning text-white hover:bg-warning/90 disabled:opacity-40',
};

const SIZES = {
  md: 'h-9 px-4 text-body',
  sm: 'h-8 px-3 text-caption',
};

export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', className, children, loading, disabled, ...props },
  ref
) {
  const isDisabled = disabled || loading;
  return (
    <motion.button
      ref={ref}
      disabled={isDisabled}
      whileTap={isDisabled ? undefined : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={cn(
        'interactive inline-flex items-center justify-center gap-2 rounded-control font-medium whitespace-nowrap disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {loading && (
        <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      )}
      {children}
    </motion.button>
  );
});
