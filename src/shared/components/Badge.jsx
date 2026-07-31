import { cn } from '@/shared/utils/cn';
import {
  SAMPLE_STATUS,
  SAMPLE_STATUS_LABELS,
  RECALL_STATUS,
  RECALL_STATUS_LABELS,
  VALIDITY_STATUS,
  VALIDITY_STATUS_LABELS,
  PANEL_STATUS,
  PANEL_STATUS_LABELS,
} from '@/shared/utils/constants';
import { daysUntil, getValidityStatus } from '@/shared/utils/formatters';

const BADGE_BASE = 'inline-flex items-center rounded-pill px-2.5 py-[3px] text-caption font-medium whitespace-nowrap select-none';

const STATUS_STYLES = {
  [SAMPLE_STATUS.IN_HALL]: 'bg-status-in-hall-bg text-status-in-hall-text',
  [SAMPLE_STATUS.CHECKED_OUT]: 'bg-status-checked-out-bg text-status-checked-out-text',
  in_transit: 'bg-status-in-transit-bg text-status-in-transit-text',
};

export function StatusBadge({ status, className }) {
  return (
    <span className={cn(BADGE_BASE, STATUS_STYLES[status] || 'bg-surface-subtle text-ink-secondary', className)}>
      {SAMPLE_STATUS_LABELS[status] || status}
    </span>
  );
}

const PANEL_STATUS_STYLES = {
  [PANEL_STATUS.IN_HALL]: 'bg-status-in-hall-bg text-status-in-hall-text',
  [PANEL_STATUS.ISSUED]: 'bg-status-checked-out-bg text-status-checked-out-text',
  [PANEL_STATUS.RETIRED]: 'bg-surface-subtle text-ink-muted',
};

export function PanelStatusBadge({ status, className }) {
  return (
    <span className={cn(BADGE_BASE, PANEL_STATUS_STYLES[status] || 'bg-surface-subtle text-ink-secondary', className)}>
      {PANEL_STATUS_LABELS[status] || status}
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
    <span className={cn(BADGE_BASE, RECALL_STYLES[status] || 'bg-surface-subtle text-ink-secondary', className)}>
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
    <span className={cn(BADGE_BASE, ROLE_STYLES[role] || 'bg-surface-subtle text-ink-secondary', className)}>
      {label}
    </span>
  );
}

export function Badge({ children, className }) {
  return <span className={cn(BADGE_BASE, 'bg-surface-subtle text-ink-secondary', className)}>{children}</span>;
}

const VALIDITY_STYLES = {
  [VALIDITY_STATUS.VALID]: 'bg-status-in-hall-bg text-status-in-hall-text',
  [VALIDITY_STATUS.EXPIRING_SOON]: 'bg-status-checked-out-bg text-status-checked-out-text',
  [VALIDITY_STATUS.EXPIRED]: 'bg-status-expired-bg text-status-expired-text',
};

/**
 * Renders nothing if `expiryDate` is unset — validity tracking is optional
 * per-sample, so an empty badge slot is preferable to a misleading one.
 */
export function ValidityBadge({ expiryDate, className }) {
  const status = getValidityStatus(expiryDate);
  if (!status) return null;

  const days = daysUntil(expiryDate);
  const label =
    status === VALIDITY_STATUS.EXPIRED
      ? `${VALIDITY_STATUS_LABELS[status]} · ${Math.abs(days)}d ago`
      : `${VALIDITY_STATUS_LABELS[status]} · ${days}d left`;

  return <span className={cn(BADGE_BASE, VALIDITY_STYLES[status], className)}>{label}</span>;
}
