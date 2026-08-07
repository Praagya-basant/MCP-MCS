// Central permission map — the single source of truth for "who can do
// what." Components never hardcode a role name to gate an action; they
// call hasPermission(role, 'sample.issue', customPermissions) instead, so
// changing who's allowed to do something is a one-line edit here rather
// than a hunt through every page that happens to check `role === 'admin'`.
export const PERMISSIONS = {
  'sample.add': ['admin', 'manager'],
  'sample.issue': ['admin', 'manager'],
  'sample.return': ['admin', 'manager'],
  'sample.edit': ['admin'],
  'sample.delete': ['admin'],
  'sample.view': ['admin', 'manager', 'merchant', 'custom'],
  'sample.upload_image': ['admin', 'merchant'],
  'panel.add': ['admin', 'manager'],
  'panel.issue': ['admin', 'manager'],
  'panel.retire': ['admin'],
  'validity.extend': ['admin', 'manager'],
  'validity.pre_expire': ['admin'],
  'shift.request': ['admin', 'manager', 'merchant'],
  'recall.raise': ['merchant'],
  'user.manage': ['admin'],
  'buyer.manage': ['admin'],
  'hall.manage': ['admin'],
  'export.data': ['admin', 'manager', 'merchant'],
  'settings.manage': ['admin'],
};

// DB role values -> the short names PERMISSIONS is keyed on.
const ROLE_ALIASES = {
  super_admin: 'admin',
  hall_manager: 'manager',
  merchant: 'merchant',
  custom: 'custom',
};

/**
 * True if `role` (a DB role value: super_admin/hall_manager/merchant/
 * custom) is allowed to perform `action` (a PERMISSIONS key). For a
 * `custom` role, this is granted two ways that both apply: the spec's own
 * PERMISSIONS table already lists 'custom' as a baseline for a few
 * actions (sample.view, shift.request, export.data — things every
 * custom user can do regardless of their toggles), and on top of that
 * `customPermissions` (profiles.custom_permissions, set individually per
 * user) can grant additional actions the toggle list maps to. Either one
 * being true is enough.
 */
export function hasPermission(role, action, customPermissions) {
  if (!PERMISSIONS[action]) return false;
  const shortRole = ROLE_ALIASES[role] || role;
  if (PERMISSIONS[action].includes(shortRole)) return true;
  if (shortRole === 'custom') return !!customPermissions?.[action];
  return false;
}

// The toggle set shown when creating/editing a "Custom" role user — each
// key here should read naturally as a checkbox label and map to one or
// more PERMISSIONS-style checks the frontend cares about for that user.
export const CUSTOM_PERMISSION_TOGGLES = [
  { key: 'view_all_buyers', label: 'View All Buyers' },
  { key: 'manage_users', label: 'Manage Users' },
  { key: 'view_movements', label: 'View Movements' },
  { key: 'export_data', label: 'Export Data' },
  { key: 'manage_samples', label: 'Manage Samples' },
  { key: 'manage_panels', label: 'Manage Panels' },
];
