import { formatRelativeTime, formatDateTime } from '@/shared/utils/formatters';
import { cn } from '@/shared/utils/cn';

const BORDER_COLOR = {
  issue: 'border-status-checked-out-text',
  return: 'border-status-in-hall-text',
  recall: 'border-status-in-transit-text',
};

export function ActivityFeed({ items }) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li
          key={item.id}
          className={cn('border-l-[3px] pl-3 py-0.5', BORDER_COLOR[item.type] || 'border-border-strong')}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-body text-ink truncate">
              <span className="font-medium font-mono">{item.sample?.bt_code}</span> {item.text}
            </p>
            <span className="text-caption text-ink-muted shrink-0" title={formatDateTime(item.timestamp)}>
              {formatRelativeTime(item.timestamp)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
