import { Card } from '@/core/components/Card';
import { cn } from '@/core/utils/cn';
import { useCountUp } from '@/core/hooks/useCountUp';

const TONE_STYLES = {
  neutral: 'bg-surface-subtle text-ink-secondary',
  accent: 'bg-accent/12 text-accent',
  success: 'bg-status-in-hall-bg text-status-in-hall-text',
  warning: 'bg-status-checked-out-bg text-status-checked-out-text',
  info: 'bg-status-in-transit-bg text-status-in-transit-text',
  error: 'bg-status-expired-bg text-status-expired-text',
};

/**
 * Dashboard stat card — the number is the hero (32px/700), the icon sits
 * in a soft tinted circle matching `tone` (defaults to a neutral gray so
 * existing callers that don't pass one still look intentional), and the
 * whole card lifts on hover. Borderless (bordered={false} on Card) —
 * shadow alone gives it definition, per the "soft shadow instead of
 * harsh borders" design direction.
 */
export function StatCard({ label, value, icon, tone = 'neutral', trend, onClick, className }) {
  const animated = useCountUp(value, 800);
  const isNumeric = typeof value === 'number';

  return (
    <Card
      bordered={false}
      onClick={onClick}
      className={cn(
        'px-5 py-5 flex flex-col gap-4 interactive hover:-translate-y-0.5 hover:shadow-lift rounded-2xl',
        onClick && 'cursor-pointer',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-caption font-medium uppercase tracking-wide text-ink-secondary select-none">
          {label}
        </span>
        {icon && (
          <span className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0', TONE_STYLES[tone] || TONE_STYLES.neutral)}>
            {icon}
          </span>
        )}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-[32px] leading-none font-bold text-ink tabular-nums">
          {isNumeric ? animated : value}
        </span>
        {trend && <span className="text-caption text-ink-secondary mb-0.5">{trend}</span>}
      </div>
    </Card>
  );
}
