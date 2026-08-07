import { motion } from 'framer-motion';
import { formatRelativeTime, formatDateTime } from '@/core/utils/formatters';
import { cn } from '@/core/utils/cn';

const BORDER_COLOR = {
  issue: 'border-status-checked-out-text',
  return: 'border-status-in-hall-text',
  recall: 'border-status-in-transit-text',
};

export function ActivityFeed({ items }) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item, i) => (
        <motion.li
          key={item.id}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25, delay: Math.min(i, 8) * 0.05 }}
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
        </motion.li>
      ))}
    </ul>
  );
}
