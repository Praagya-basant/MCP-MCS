import { VALIDITY_STATUS, VALIDITY_EXPIRING_SOON_DAYS, SAMPLE_STATUS, PANEL_STATUS } from '@/shared/utils/constants';

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Fixed "25 Jul 2026, 1:17 PM" format, built manually rather than via
 * Intl/toLocaleString — locale-based formatting varies by browser/OS for
 * both date ordering and AM/PM casing, which made table columns render
 * inconsistently wide. This is deterministic everywhere.
 */
export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  const day = String(date.getDate()).padStart(2, '0');
  const month = SHORT_MONTHS[date.getMonth()];
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${day} ${month} ${year}, ${hours}:${minutes} ${period}`;
}

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatRelativeTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDate(value);
}

/** "Good morning"/"afternoon"/"evening" based on the visitor's local clock. */
export function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function initials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

/**
 * Display-only shortening for buyer names — DB keeps the full legal name,
 * the UI shows the short form everywhere. Applied at the API boundary
 * (see buyersApi/samplesApi/movementsApi/usersApi/AuthContext) so every
 * component that renders a buyer name gets it automatically.
 */
export function shortenBuyerName(name) {
  if (!name) return name;
  if (/maison du monde/i.test(name)) return 'MDM';
  return name;
}

/** "Today, 2:34 PM" / "Yesterday, 2:34 PM" / "25 Jul 2026, 2:34 PM" for the user dropdown's last-login line. */
export function formatLastLogin(value) {
  if (!value) return null;
  const date = new Date(value);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const sameDayAs = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const time = `${hours}:${minutes} ${period}`;

  if (sameDayAs(date, now)) return `Today, ${time}`;
  if (sameDayAs(date, yesterday)) return `Yesterday, ${time}`;
  return `${formatDate(value)}, ${time}`;
}

/**
 * Whole days from today until `value` (negative once past) — plain `date`
 * columns come back as "YYYY-MM-DD" strings, parsed with an explicit
 * local-midnight time (no `Z`) so this doesn't drift a day depending on
 * the viewer's UTC offset.
 */
export function daysUntil(value) {
  if (!value) return null;
  const target = new Date(`${value}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/** Valid / Expiring Soon (within VALIDITY_EXPIRING_SOON_DAYS) / Expired, or null if no expiry is set. */
export function getValidityStatus(expiryDate) {
  if (!expiryDate) return null;
  const days = daysUntil(expiryDate);
  if (days < 0) return VALIDITY_STATUS.EXPIRED;
  if (days <= VALIDITY_EXPIRING_SOON_DAYS) return VALIDITY_STATUS.EXPIRING_SOON;
  return VALIDITY_STATUS.VALID;
}

/**
 * 'in_transit' is a display-only refinement of 'checked_out', not a real
 * samples.status value — a sample whose currently active movement leg is
 * its 2nd or later hop (forwarded onward at least once) reads as "In
 * Transit" instead of "Issued". `hopNumber` comes from the sample's open
 * movement (see forward_sample/hop_number in schema.sql); pass undefined
 * when it isn't known and this just echoes `status` back unchanged.
 */
export function getSampleDisplayStatus(status, hopNumber) {
  if (status !== SAMPLE_STATUS.CHECKED_OUT) return status;
  return hopNumber > 1 ? 'in_transit' : status;
}

/** Same 'in_transit' refinement as getSampleDisplayStatus(), for panels.status. */
export function getPanelDisplayStatus(status, hopNumber) {
  if (status !== PANEL_STATUS.ISSUED) return status;
  return hopNumber > 1 ? 'in_transit' : status;
}

export function isToday(value) {
  if (!value) return false;
  const d = new Date(value);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function isYesterday(value) {
  if (!value) return false;
  const d = new Date(value);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  );
}

/** Buckets a timestamped list into Today/Yesterday/Earlier, preserving each bucket's incoming order. */
export function groupByDay(items, getDate) {
  const groups = { Today: [], Yesterday: [], Earlier: [] };
  items.forEach((item) => {
    const value = getDate(item);
    if (isToday(value)) groups.Today.push(item);
    else if (isYesterday(value)) groups.Yesterday.push(item);
    else groups.Earlier.push(item);
  });
  return Object.entries(groups).filter(([, rows]) => rows.length > 0);
}
