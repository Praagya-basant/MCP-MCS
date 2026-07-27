import { supabase } from '@/shared/lib/supabaseClient';
import { shortenBuyerName } from '@/shared/utils/formatters';

export async function listUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, hall:halls(id, hall_number), buyer:buyers(id, name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map((u) => (u.buyer ? { ...u, buyer: { ...u.buyer, name: shortenBuyerName(u.buyer.name) } } : u));
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
export async function createUser({ fullName, email, password, role, hallId }) {
  const { data, error } = await supabase.functions.invoke('create-user', {
    body: {
      full_name: fullName,
      email,
      password,
      role,
      hall_id: hallId || null,
    },
  });

  if (error) {
    const message = data?.error || error.message || 'Failed to create user';
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);

  return data;
}
