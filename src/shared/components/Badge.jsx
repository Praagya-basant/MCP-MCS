import { cn } from '@/shared/utils/cn';
import { SAMPLE_STATUS, SAMPLE_STATUS_LABELS, RECALL_STATUS, RECALL_STATUS_LABELS } from '@/shared/utils/constants';

const STATUS_STYLES = {
  [SAMPLE_STATUS.IN_HALL]: 'bg-status-in-hall-bg text-status-in-hall-text',
  [SAMPLE_STATUS.CHECKED_OUT]: 'bg-status-checked-out-bg text-status-checked-out-text',
  in_transit: 'bg-status-in-transit-bg text-status-in-transit-text',
};

export function StatusBadge({ status, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-pill px-2.5 py-[3px] text-caption font-medium whitespace-nowrap',
        STATUS_STYLES[status] || 'bg-surface-subtle text-ink-secondary',
        className
      )}
    >
      {SAMPLE_STATUS_LABELS[status] || status}
    </span>
  );
}

const RECALL_STYLES = {
  [RECALL_STATUS.PENDING]: 'bg-status-checked-out-bg text-status-checked-out-text',
  [RECALL_STATUS.ACKNOWLEDGED]: 'bg-status-in-transit-bg text-status-in-transit-text',
  [RECALL_STATUS.RESOLVED]: 'bg-status-in-hall-bg text-status-in-hall-text',
};

export function RecallStatusBadge({ status, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-pill px-2.5 py-[3px] text-caption font-medium whitespace-nowrap',
        RECALL_STYLES[status] || 'bg-surface-subtle text-ink-secondary',
        className
      )}
    >
      {RECALL_STATUS_LABELS[status] || status}
    </span>
  );
}

const ROLE_STYLES = {
  super_admin: 'bg-surface-subtle text-ink',
  hall_manager: 'bg-status-in-transit-bg text-status-in-transit-text',
  merchant: 'bg-status-in-hall-bg text-status-in-hall-text',
};

export function RoleBadge({ role, label, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-pill px-2.5 py-[3px] text-caption font-medium whitespace-nowrap',
        ROLE_STYLES[role] || 'bg-surface-subtle text-ink-secondary',
        className
      )}
    >
      {label}
    </span>
  );
}

export function Badge({ children, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-pill px-2.5 py-[3px] text-caption font-medium whitespace-nowrap bg-surface-subtle text-ink-secondary',
        className
      )}
    >
      {children}
    </span>
  );
}
