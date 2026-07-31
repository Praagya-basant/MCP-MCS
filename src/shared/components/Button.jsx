import { forwardRef } from 'react';
import { cn } from '@/shared/utils/cn';

const VARIANTS = {
  primary:
    'bg-ink text-white hover:bg-[#2b2b2b] disabled:bg-ink/40 disabled:text-white/70',
  secondary:
    'bg-white text-ink border border-ink hover:bg-surface-subtle disabled:opacity-40',
  ghost:
    'bg-transparent text-ink hover:bg-surface-subtle disabled:opacity-40',
  danger:
    'bg-white text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-40',
  success:
    'bg-status-in-hall-text text-white hover:bg-[#128a3e] disabled:opacity-40',
  warning:
    'bg-status-checked-out-text text-white hover:bg-[#b45f04] disabled:opacity-40',
};

// 44px minimum tap target on mobile regardless of size variant (Apple HIG /
// Material guidance) — desktop keeps today's tighter density unchanged.
const SIZES = {
  md: 'h-11 md:h-9 px-4 text-body',
  sm: 'h-11 md:h-8 px-3 text-caption',
};

export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', className, children, loading, disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
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
    </button>
  );
});
