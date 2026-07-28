import { Card } from '@/shared/components/Card';
import { cn } from '@/shared/utils/cn';
import { useCountUp } from '@/shared/hooks/useCountUp';

export function StatCard({ label, value, icon, trend, onClick, className }) {
  const animated = useCountUp(value);
  const isNumeric = typeof value === 'number';

  return (
    <Card
      onClick={onClick}
      className={cn(
        'px-6 py-5 flex flex-col gap-2 interactive hover:-translate-y-0.5 hover:shadow-md',
        onClick && 'cursor-pointer',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-caption font-medium uppercase tracking-wide text-ink-secondary select-none">
          {label}
        </span>
        {icon && <span className="text-ink-muted">{icon}</span>}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-display font-semibold text-ink leading-none">
          {isNumeric ? animated : value}
        </span>
        {trend && <span className="text-caption text-ink-secondary mb-0.5">{trend}</span>}
      </div>
    </Card>
  );
}
