// Supabase Edge Function: create-user
//
// Creating a login user requires the Auth admin API (service role key),
// which must never reach the browser. This function verifies the caller
// is an authenticated super_admin, then creates the auth user + matching
// `profiles` row as a single server-side operation for /admin/users.
//
// Deploy: supabase functions deploy create-user
// No extra secrets needed — SUPABASE_URL / SUPABASE_ANON_KEY /
// SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const VALID_ROLES = ['super_admin', 'hall_manager', 'merchant'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

  try {
    const authHeader = req.headers.get('Authorization') || '';

    // Client scoped to the caller's own JWT — used only to confirm who's asking.
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: caller },
    } = await callerClient.auth.getUser();

    if (!caller) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401, headers: jsonHeaders });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single();

    if (callerProfile?.role !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Only admins can create users' }), {
        status: 403,
        headers: jsonHeaders,
      });
    }

    const { full_name, email, password, role, hall_id } = await req.json();

    if (!full_name || !email || !password || !VALID_ROLES.includes(role)) {
      return new Response(JSON.stringify({ error: 'Missing or invalid fields' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }
    if (role === 'hall_manager' && !hall_id) {
      return new Response(JSON.stringify({ error: 'Hall managers require a hall assignment' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createErr) {
      return new Response(JSON.stringify({ error: createErr.message }), { status: 400, headers: jsonHeaders });
    }

    // Merchants are created with no buyer_id — that assignment (which also
    // drives their RLS scoping) happens later from the Add/Edit Buyer
    // form's merchant-contacts multi-select, not at user creation time.
    const { data: profile, error: profileErr } = await admin
      .from('profiles')
      .insert({
        id: created.user.id,
        full_name,
        email,
        role,
        hall_id: role === 'hall_manager' ? hall_id : null,
        buyer_id: null,
      })
      .select()
      .single();

    if (profileErr) {
      // Roll back the auth user so we don't leave an orphaned login with no profile.
      await admin.auth.admin.deleteUser(created.user.id);
      return new Response(JSON.stringify({ error: profileErr.message }), { status: 400, headers: jsonHeaders });
    }

    return new Response(JSON.stringify({ profile }), { headers: jsonHeaders });
  } catch (err) {
    console.error('create-user error', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: jsonHeaders });
  }
});
