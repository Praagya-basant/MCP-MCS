// Central place for enum-like values shared across the app.
// Keeping these here means the DB check constraints, forms, and
// badges all read from a single source of truth.

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  HALL_MANAGER: 'hall_manager',
  MERCHANT: 'merchant',
};

export const ROLE_LABELS = {
  [ROLES.SUPER_ADMIN]: 'Admin',
  [ROLES.HALL_MANAGER]: 'Manager',
  [ROLES.MERCHANT]: 'Merchant',
};

export const ROLE_HOME = {
  [ROLES.SUPER_ADMIN]: '/admin/dashboard',
  [ROLES.HALL_MANAGER]: '/hall/dashboard',
  [ROLES.MERCHANT]: '/merchant/dashboard',
};

export const SAMPLE_STATUS = {
  IN_HALL: 'in_hall',
  CHECKED_OUT: 'checked_out',
};

export const SAMPLE_STATUS_LABELS = {
  [SAMPLE_STATUS.IN_HALL]: 'In Hall',
  [SAMPLE_STATUS.CHECKED_OUT]: 'Issued',
};

export const MOVEMENT_STATUS = {
  OUT: 'out',
  RETURNED: 'returned',
};

export const RECALL_STATUS = {
  PENDING: 'pending',
  ACKNOWLEDGED: 'acknowledged',
  RESOLVED: 'resolved',
};

export const RECALL_STATUS_LABELS = {
  [RECALL_STATUS.PENDING]: 'Pending',
  [RECALL_STATUS.ACKNOWLEDGED]: 'Acknowledged',
  [RECALL_STATUS.RESOLVED]: 'Resolved',
};

// Non-hall destination options for the Issue Sample form — the hall
// portion of that dropdown is read live from the `halls` table (see
// IssueSampleModal), not hardcoded here.
export const NON_HALL_DESTINATIONS = ['Supplier', 'Other'];

export const REASON_OPTIONS = [
  'Inspection',
  'Production',
  'Testing',
  'R&D',
  'Packaging',
  'Other',
];

// Shown on the Issue Sample form only when the destination is "Supplier".
export const PURCHASER_OPTIONS = ['Thanaram', 'Suresh Chaudhary', 'Nitin Jain', 'Other'];

export const VALIDITY_STATUS = {
  VALID: 'valid',
  EXPIRING_SOON: 'expiring_soon',
  EXPIRED: 'expired',
};

export const VALIDITY_STATUS_LABELS = {
  [VALIDITY_STATUS.VALID]: 'Valid',
  [VALIDITY_STATUS.EXPIRING_SOON]: 'Expiring Soon',
  [VALIDITY_STATUS.EXPIRED]: 'Expired',
};

// Days-remaining threshold for the amber "Expiring Soon" badge — matches
// the earlier of the two scheduled alert thresholds (30/15 days), see
// send_validity_alerts() in schema.sql.
export const VALIDITY_EXPIRING_SOON_DAYS = 30;

export const PAGE_SIZE = 20;
