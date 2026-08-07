import { cn } from '@/core/utils/cn';

export function Card({ className, children, bordered = true, ...props }) {
  return (
    <div
      className={cn(
        'bg-card rounded-card shadow-card',
        bordered && 'border border-border',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }) {
  return (
    <div className={cn('px-6 py-4 border-b border-border', className)} {...props}>
      {children}
    </div>
  );
}

export function CardBody({ className, children, ...props }) {
  return (
    <div className={cn('px-6 py-4', className)} {...props}>
      {children}
    </div>
  );
}
