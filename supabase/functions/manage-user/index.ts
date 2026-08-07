// Supabase Edge Function: manage-user
//
// Editing another user's password or deleting their login both require
// the Auth admin API (service role key), same reason create-user needs an
// edge function. This one function handles all three admin user-management
// actions the desktop rebuild's Team page needs (update/password-reset/
// delete) behind one super_admin check, rather than three near-identical
// functions.
//
// Deploy: supabase functions deploy manage-user
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

const VALID_ROLES = ['super_admin', 'hall_manager', 'merchant', 'custom'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

  try {
    const authHeader = req.headers.get('Authorization') || '';

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
      return new Response(JSON.stringify({ error: 'Only admins can manage users' }), {
        status: 403,
        headers: jsonHeaders,
      });
    }

    const body = await req.json();
    const { action, user_id } = body;

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id is required' }), { status: 400, headers: jsonHeaders });
    }

    if (action === 'delete') {
      // Profile row first (FK references would otherwise block the auth
      // delete on some setups) — profiles has ON DELETE behavior handled
      // by its own schema, but deleting the auth user is the operation
      // that actually revokes login access, so it always happens even if
      // the profile delete below is a no-op.
      await admin.from('profiles').delete().eq('id', user_id);
      const { error } = await admin.auth.admin.deleteUser(user_id);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: jsonHeaders });
      }
      return new Response(JSON.stringify({ success: true }), { headers: jsonHeaders });
    }

    if (action === 'reset_password') {
      const { password } = body;
      if (!password || password.length < 6) {
        return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), {
          status: 400,
          headers: jsonHeaders,
        });
      }
      const { error } = await admin.auth.admin.updateUserById(user_id, { password });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: jsonHeaders });
      }
      return new Response(JSON.stringify({ success: true }), { headers: jsonHeaders });
    }

    if (action === 'update') {
      const { full_name, role, hall_id, custom_permissions, is_disabled, password } = body;

      if (role && !VALID_ROLES.includes(role)) {
        return new Response(JSON.stringify({ error: 'Invalid role' }), { status: 400, headers: jsonHeaders });
      }
      if (role === 'hall_manager' && !hall_id) {
        return new Response(JSON.stringify({ error: 'Hall managers require a hall assignment' }), {
          status: 400,
          headers: jsonHeaders,
        });
      }

      if (password) {
        if (password.length < 6) {
          return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), {
            status: 400,
            headers: jsonHeaders,
          });
        }
        const { error: pwErr } = await admin.auth.admin.updateUserById(user_id, { password });
        if (pwErr) {
          return new Response(JSON.stringify({ error: pwErr.message }), { status: 400, headers: jsonHeaders });
        }
      }

      const patch = {};
      if (full_name !== undefined) patch.full_name = full_name;
      if (role !== undefined) {
        patch.role = role;
        patch.hall_id = role === 'hall_manager' ? hall_id : null;
      }
      if (custom_permissions !== undefined) patch.custom_permissions = custom_permissions;
      if (is_disabled !== undefined) patch.is_disabled = is_disabled;

      const { data: profile, error: profileErr } = await admin
        .from('profiles')
        .update(patch)
        .eq('id', user_id)
        .select()
        .single();

      if (profileErr) {
        return new Response(JSON.stringify({ error: profileErr.message }), { status: 400, headers: jsonHeaders });
      }

      return new Response(JSON.stringify({ profile }), { headers: jsonHeaders });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: jsonHeaders });
  } catch (err) {
    console.error('manage-user error', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: jsonHeaders });
  }
});
