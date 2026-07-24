import { Card } from '@/shared/components/Card';
import { cn } from '@/shared/utils/cn';

export function StatCard({ label, value, icon, trend, className }) {
  return (
    <Card className={cn('px-6 py-5 flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between">
        <span className="text-caption font-medium uppercase tracking-wide text-ink-secondary">
          {label}
        </span>
        {icon && <span className="text-ink-muted">{icon}</span>}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-display font-semibold text-ink leading-none">{value}</span>
        {trend && <span className="text-caption text-ink-secondary mb-0.5">{trend}</span>}
      </div>
    </Card>
  );
}
