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

export const PAGE_SIZE = 20;
