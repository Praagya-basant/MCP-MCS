import { forwardRef } from 'react';
import { cn } from '@/core/utils/cn';

export const Input = forwardRef(function Input({ className, error, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        'interactive w-full h-9 rounded-control border bg-card px-3 text-body text-ink placeholder:text-ink-muted',
        'focus:outline-none focus:ring-[1.5px] focus:ring-ink focus:border-ink',
        error ? 'border-error' : 'border-border',
        props.disabled && 'bg-surface-subtle text-ink-muted cursor-not-allowed',
        className
      )}
      {...props}
    />
  );
});

export const Textarea = forwardRef(function Textarea({ className, error, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'interactive w-full min-h-[80px] rounded-control border bg-card px-3 py-2 text-body text-ink placeholder:text-ink-muted resize-none',
        'focus:outline-none focus:ring-[1.5px] focus:ring-ink focus:border-ink',
        error ? 'border-error' : 'border-border',
        className
      )}
      {...props}
    />
  );
});

export const Select = forwardRef(function Select({ className, error, children, ...props }, ref) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          'interactive w-full h-9 appearance-none rounded-control border bg-card pl-3 pr-8 text-body text-ink',
          'focus:outline-none focus:ring-[1.5px] focus:ring-ink focus:border-ink',
          error ? 'border-error' : 'border-border',
          props.disabled && 'bg-surface-subtle text-ink-muted cursor-not-allowed',
          className
        )}
        {...props}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-secondary"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  );
});

export function FormField({ label, htmlFor, error, hint, required, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={htmlFor} className="text-body font-medium text-ink">
          {label}
          {required && <span className="text-error ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error && <span className="text-caption text-error">{error}</span>}
      {!error && hint && <span className="text-caption text-ink-muted">{hint}</span>}
    </div>
  );
}
