import { supabase } from '@/shared/lib/supabaseClient';

export async function listUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, hall:halls(id, hall_number), buyer:buyers(id, name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/**
 * Creating a login user requires the Supabase Auth admin API, which needs
 * the service role key — that can never live in the browser. This calls
 * the `create-user` edge function, which validates the caller is a
 * super_admin, creates the auth user, and inserts the matching profile
 * row in one server-side step.
 */
export async function createUser({ fullName, email, password, role, hallId, buyerId }) {
  const { data, error } = await supabase.functions.invoke('create-user', {
    body: {
      full_name: fullName,
      email,
      password,
      role,
      hall_id: hallId || null,
      buyer_id: buyerId || null,
    },
  });

  if (error) {
    const message = data?.error || error.message || 'Failed to create user';
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);

  return data;
}
