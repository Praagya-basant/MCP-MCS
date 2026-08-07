import { supabase } from '@/core/lib/supabaseClient';
import { shortenBuyerName } from '@/core/utils/formatters';

export async function listUsers() {
  const [{ data, error }, { data: logins }] = await Promise.all([
    supabase
      .from('profiles')
      .select('*, hall:halls(id, hall_number, name), buyer:buyers(id, name)')
      .order('created_at', { ascending: false }),
    // Empty (not an error) for non-admins — admin_list_users_last_login()
    // filters to zero rows rather than raising, see schema.sql.
    supabase.rpc('admin_list_users_last_login'),
  ]);
  if (error) throw error;
  const loginMap = new Map((logins || []).map((l) => [l.id, l.last_sign_in_at]));
  return data.map((u) => ({
    ...(u.buyer ? { ...u, buyer: { ...u.buyer, name: shortenBuyerName(u.buyer.name) } } : u),
    last_sign_in_at: loginMap.get(u.id) || null,
  }));
}

/**
 * Every merchant-role profile, for the "Merchant Contacts" multi-select
 * on Add/Edit Buyer — that's the only place a merchant gets connected to
 * a buyer (see buyersApi.syncMerchantContacts), since Add User no longer
 * collects one.
 */
export async function listMerchantUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('role', 'merchant')
    .order('full_name');
  if (error) throw error;
  return data;
}

/**
 * Creating a login user requires the Supabase Auth admin API, which needs
 * the service role key — that can never live in the browser. This calls
 * the `create-user` edge function, which validates the caller is a
 * super_admin, creates the auth user, and inserts the matching profile
 * row in one server-side step. Merchants are created with no buyer —
 * that's assigned later via the Add/Edit Buyer form.
 */
export async function createUser({ fullName, email, password, role, hallId, customPermissions }) {
  const { data, error } = await supabase.functions.invoke('create-user', {
    body: {
      full_name: fullName,
      email,
      password,
      role,
      hall_id: hallId || null,
      custom_permissions: customPermissions || {},
    },
  });

  if (error) {
    const message = data?.error || error.message || 'Failed to create user';
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);

  return data;
}

function invokeManageUser(body) {
  return supabase.functions.invoke('manage-user', { body }).then(({ data, error }) => {
    if (error) throw new Error(data?.error || error.message || 'Request failed');
    if (data?.error) throw new Error(data.error);
    return data;
  });
}

/**
 * Edits name/role/hall/custom-permissions and optionally resets the
 * password in one call — all through manage-user since role/hall changes
 * touch `profiles` (fine via direct RLS-scoped update too, but bundling
 * with an optional password reset means one edge function call instead of
 * two round trips when both are being changed in the same Edit User save).
 */
export async function updateUser({ userId, fullName, role, hallId, customPermissions, password }) {
  const { profile } = await invokeManageUser({
    action: 'update',
    user_id: userId,
    full_name: fullName,
    role,
    hall_id: hallId || null,
    custom_permissions: customPermissions,
    password: password || undefined,
  });
  return profile;
}

/** Disable/enable toggle — a plain profiles update, RLS already grants admin full UPDATE, no edge function needed. */
export async function setUserDisabled(userId, isDisabled) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ is_disabled: isDisabled })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteUser(userId) {
  await invokeManageUser({ action: 'delete', user_id: userId });
}
