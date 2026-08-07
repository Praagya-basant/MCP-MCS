import { cn } from '@/core/utils/cn';

export function Table({ children, className }) {
  return (
    <div className="w-full overflow-x-auto scrollbar-thin">
      <table className={cn('w-full text-body border-collapse', className)}>{children}</table>
    </div>
  );
}

export function Thead({ children }) {
  return <thead>{children}</thead>;
}

export function Tbody({ children }) {
  return <tbody>{children}</tbody>;
}

export function Tr({ children, onClick, className }) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        'border-b border-border interactive',
        onClick && 'cursor-pointer hover:bg-sidebar',
        className
      )}
    >
      {children}
    </tr>
  );
}

export function Th({ children, sortable, active, dir, onClick, className }) {
  return (
    <th
      onClick={sortable ? onClick : undefined}
      className={cn(
        'text-left px-4 py-3 text-caption font-medium uppercase tracking-wide text-ink-secondary whitespace-nowrap',
        sortable && 'cursor-pointer select-none hover:text-ink',
        className
      )}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortable && (
          <svg
            className={cn('w-3 h-3 transition-transform', active && dir === 'desc' && 'rotate-180', !active && 'opacity-30')}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </span>
    </th>
  );
}

export function Td({ children, className }) {
  return <td className={cn('px-4 py-3 align-middle text-ink', className)}>{children}</td>;
}
