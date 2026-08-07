-- ============================================================================
-- Migration 0001 — Desktop rebuild (Steps 8-14 DB changes)
-- Run once in the Supabase SQL editor. Additive only — no existing table,
-- column, RLS policy, or RPC is dropped or renamed; every change here is
-- `add column if not exists` / `create or replace function` /
-- `create table if not exists`, safe to run against the live database.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A. Panel movements: quantity (Step 8 — "Quantity field, tracked per
-- movement"). Nullable — quantity isn't meaningful for every panel, so an
-- unset value just means "not tracked for this movement" rather than 0.
-- ----------------------------------------------------------------------------
alter table panel_movements add column if not exists quantity integer;

-- checkout_panel/forward_panel gain an optional trailing p_quantity param
-- (appended after their existing final optional param, so positional
-- compatibility is preserved for any caller not passing it) — the
-- frontend's supabase-js calls use named params anyway, so this is a
-- purely additive, non-breaking signature change either way.
create or replace function public.checkout_panel(
  p_panel_id uuid,
  p_picked_by_name text,
  p_picked_by_email text,
  p_destination text,
  p_reason text,
  p_reason_other text,
  p_notes text,
  p_photo_url text default null,
  p_signature_url text default null,
  p_purchaser_name text default null,
  p_supplier_name text default null,
  p_movement_id uuid default null,
  p_quantity integer default null
)
returns panel_movements
language plpgsql security definer set search_path = public as $$
declare
  v_hall_id uuid;
  v_current_status text;
  v_dest_hall_id uuid;
  v_movement panel_movements;
begin
  select hall_id, status into v_hall_id, v_current_status from panels where id = p_panel_id;

  if v_hall_id is null then
    raise exception 'Panel not found';
  end if;

  if not public.is_super_admin() and v_hall_id is distinct from public.current_hall_id() then
    raise exception 'Not authorized to check out this panel';
  end if;

  if v_current_status = 'issued' then
    raise exception 'Panel is already issued';
  end if;

  if v_current_status = 'retired' then
    raise exception 'Panel is retired';
  end if;

  select id into v_dest_hall_id from halls where name = p_destination;

  update panels set status = 'issued' where id = p_panel_id;

  insert into panel_movements (
    id, panel_id, picked_by_name, picked_by_email, destination, reason,
    reason_other, notes, logged_by, status, from_hall_id, destination_hall_id,
    photo_url, signature_url, purchaser_name, supplier_name, quantity
  ) values (
    coalesce(p_movement_id, gen_random_uuid()), p_panel_id, p_picked_by_name, p_picked_by_email,
    p_destination, p_reason, nullif(p_reason_other, ''), nullif(p_notes, ''), auth.uid(), 'out',
    v_hall_id, v_dest_hall_id, p_photo_url, p_signature_url,
    nullif(p_purchaser_name, ''), nullif(p_supplier_name, ''), p_quantity
  ) returning * into v_movement;

  return v_movement;
end;
$$;

create or replace function public.forward_panel(
  p_movement_id uuid,
  p_picked_by_name text,
  p_picked_by_email text,
  p_destination text,
  p_reason text,
  p_reason_other text,
  p_notes text,
  p_photo_url text default null,
  p_signature_url text default null,
  p_purchaser_name text default null,
  p_supplier_name text default null,
  p_new_movement_id uuid default null,
  p_quantity integer default null
)
returns panel_movements
language plpgsql security definer set search_path = public as $$
declare
  v_panel panels;
  v_old_movement panel_movements;
  v_old_hall_id uuid;
  v_dest_hall_id uuid;
  v_new_movement panel_movements;
begin
  select p.* into v_panel
  from panel_movements m join panels p on p.id = m.panel_id
  where m.id = p_movement_id;

  if v_panel.id is null then
    raise exception 'Movement not found';
  end if;

  if v_panel.status <> 'issued' then
    raise exception 'Panel is not currently issued';
  end if;

  if not public.is_super_admin() and v_panel.hall_id is distinct from public.current_hall_id() then
    raise exception 'Not authorized to forward this panel';
  end if;

  update panel_movements
  set status = 'returned', returned_at = now()
  where id = p_movement_id and status = 'out'
  returning * into v_old_movement;

  if v_old_movement.id is null then
    raise exception 'Movement already closed or not found';
  end if;

  v_old_hall_id := v_panel.hall_id;
  select id into v_dest_hall_id from halls where name = p_destination;

  if v_dest_hall_id is not null then
    update panels set hall_id = v_dest_hall_id where id = v_panel.id;
  end if;

  insert into panel_movements (
    id, panel_id, picked_by_name, picked_by_email, destination, reason,
    reason_other, notes, logged_by, status, from_hall_id, destination_hall_id,
    photo_url, signature_url, purchaser_name, supplier_name, hop_number, quantity
  ) values (
    coalesce(p_new_movement_id, gen_random_uuid()), v_panel.id, p_picked_by_name, p_picked_by_email,
    p_destination, p_reason, nullif(p_reason_other, ''), nullif(p_notes, ''), auth.uid(), 'out',
    v_old_hall_id, v_dest_hall_id, p_photo_url, p_signature_url,
    nullif(p_purchaser_name, ''), nullif(p_supplier_name, ''), v_old_movement.hop_number + 1, p_quantity
  ) returning * into v_new_movement;

  return v_new_movement;
end;
$$;

grant execute on function public.checkout_panel to authenticated;
grant execute on function public.forward_panel to authenticated;

-- ----------------------------------------------------------------------------
-- B. Validity alerts now also cover panels (Step 10 — the pg_cron job
-- previously only scanned `samples`). Same 30/15-day-exact logic, same
-- recipient matrix, duplicated for `panels`/`panel_movements` since the two
-- tables aren't unioned anywhere else in the schema either.
-- ----------------------------------------------------------------------------
create or replace function public.send_validity_alerts()
returns void
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_recipient_ids uuid[];
  v_anon_key text := current_setting('app.settings.supabase_anon_key', true);
begin
  for r in
    select s.id, s.bt_code as code, s.product_name as name, s.expiry_date, s.buyer_id, s.hall_id,
           (s.expiry_date - current_date)::int as days_left, 'sample' as item_type
    from samples s
    where s.expiry_date in (current_date + 30, current_date + 15)
    union all
    select p.id, p.panel_code as code, p.panel_name as name, p.expiry_date, p.buyer_id, p.hall_id,
           (p.expiry_date - current_date)::int as days_left, 'panel' as item_type
    from panels p
    where p.expiry_date in (current_date + 30, current_date + 15)
  loop
    select array_agg(distinct p.id) into v_recipient_ids
    from profiles p
    left join merchant_buyers mb on mb.profile_id = p.id
    where p.role = 'super_admin'
       or (p.role = 'merchant' and (p.buyer_id = r.buyer_id or mb.buyer_id = r.buyer_id))
       or (p.role = 'hall_manager' and p.hall_id = r.hall_id);

    insert into notifications (recipient_id, title, message, type, item_type, item_id)
    select uid,
           initcap(r.item_type) || ' expiring in ' || r.days_left || ' days',
           r.code || ' — ' || r.name || ' expires on ' || to_char(r.expiry_date, 'DD Mon YYYY'),
           'validity_expiring', r.item_type, r.id
    from unnest(coalesce(v_recipient_ids, array[]::uuid[])) as uid;

    if v_anon_key is not null then
      perform net.http_post(
        url := 'https://ztxqksvexjonqmfyjijf.supabase.co/functions/v1/send-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_anon_key
        ),
        body := jsonb_build_object(
          'type', 'validity_alert',
          'payload', jsonb_build_object(
            'btCode', r.code,
            'productName', r.name,
            'daysLeft', r.days_left,
            'expiryDate', r.expiry_date,
            'buyerId', r.buyer_id,
            'hallId', r.hall_id
          )
        )
      );
    end if;
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- C. Managers can now approve a pending validity request (extend only —
-- direct arbitrary extend/pre-expire via admin_update_validity stays
-- admin-only). Scoped to the manager's own hall so they can't approve a
-- request for an item sitting in someone else's hall. The audit trail
-- (validity_changes.reason) now says "Extended by <name> (Manager)" for a
-- manager approval vs. the existing "Approved request: ..." for admin, per
-- spec Step 10 ("logged as 'Extended by [Manager name]'").
-- ----------------------------------------------------------------------------
create or replace function public.review_validity_request(
  p_request_id uuid,
  p_approve boolean,
  p_admin_note text default null
)
returns validity_requests
language plpgsql security definer set search_path = public as $$
declare
  v_request validity_requests;
  v_old_expiry date;
  v_new_expiry date;
  v_item_hall_id uuid;
  v_caller_role text := public.current_role();
  v_caller_name text;
  v_reason text;
begin
  if v_caller_role not in ('super_admin', 'hall_manager') then
    raise exception 'Only admins or hall managers can review validity requests';
  end if;

  select * into v_request from validity_requests where id = p_request_id and status = 'pending';
  if not found then
    raise exception 'Request not found or already reviewed';
  end if;

  if v_request.item_type = 'sample' then
    select hall_id into v_item_hall_id from samples where id = v_request.item_id;
  else
    select hall_id into v_item_hall_id from panels where id = v_request.item_id;
  end if;

  if v_caller_role = 'hall_manager' and v_item_hall_id is distinct from public.current_hall_id() then
    raise exception 'You can only review requests for items in your own hall';
  end if;

  if p_approve then
    if v_request.item_type = 'sample' then
      select expiry_date into v_old_expiry from samples where id = v_request.item_id;
    else
      select expiry_date into v_old_expiry from panels where id = v_request.item_id;
    end if;

    v_new_expiry := coalesce(
      v_request.requested_expiry_date,
      (coalesce(v_old_expiry, current_date) + (coalesce(v_request.requested_months, 0) || ' months')::interval)::date
    );

    if v_request.item_type = 'sample' then
      update samples set expiry_date = v_new_expiry where id = v_request.item_id;
    else
      update panels set expiry_date = v_new_expiry where id = v_request.item_id;
    end if;

    if v_caller_role = 'hall_manager' then
      select full_name into v_caller_name from profiles where id = auth.uid();
      v_reason := 'Extended by ' || coalesce(v_caller_name, 'Manager') || ' (Manager) — ' || coalesce(v_request.reason, 'no reason given');
    else
      v_reason := 'Approved request: ' || coalesce(v_request.reason, 'no reason given');
    end if;

    insert into validity_changes (item_type, item_id, changed_by, old_expiry_date, new_expiry_date, reason)
    values (v_request.item_type, v_request.item_id, auth.uid(), v_old_expiry, v_new_expiry, v_reason);
  end if;

  update validity_requests
  set status = case when p_approve then 'approved' else 'rejected' end,
      approved_by = auth.uid(),
      approved_at = now(),
      admin_note = p_admin_note
  where id = p_request_id
  returning * into v_request;

  return v_request;
end;
$$;

-- admin_update_validity's reason now records whether this was a pre-expire
-- (new date in the past) vs. a normal extend, for the drawer's Validity
-- History to read unambiguously — still admin-only, unchanged authorization.
create or replace function public.admin_update_validity(
  p_item_type text,
  p_item_id uuid,
  p_new_expiry_date date,
  p_reason text
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_old_expiry date;
  v_reason text;
begin
  if not public.is_super_admin() then
    raise exception 'Only admins can manage validity';
  end if;

  if p_item_type = 'sample' then
    select expiry_date into v_old_expiry from samples where id = p_item_id;
    if not found then
      raise exception 'Sample not found';
    end if;
    update samples set expiry_date = p_new_expiry_date where id = p_item_id;
  elsif p_item_type = 'panel' then
    select expiry_date into v_old_expiry from panels where id = p_item_id;
    if not found then
      raise exception 'Panel not found';
    end if;
    update panels set expiry_date = p_new_expiry_date where id = p_item_id;
  else
    raise exception 'Invalid item type: %', p_item_type;
  end if;

  v_reason := case when p_new_expiry_date < current_date then 'Pre-expired: ' else '' end || coalesce(nullif(p_reason, ''), 'No reason given');

  insert into validity_changes (item_type, item_id, changed_by, old_expiry_date, new_expiry_date, reason)
  values (p_item_type, p_item_id, auth.uid(), v_old_expiry, p_new_expiry_date, v_reason);
end;
$$;

-- ----------------------------------------------------------------------------
-- D. Shift requests: review_shift_request previously only handled
-- item_type = 'sample' (branch-free against the `samples`/`movements`
-- tables directly) even though the table itself was always polymorphic —
-- approving a panel shift request would have failed with "Sample not
-- found". Mirrors the sample branch exactly for panels.
-- ----------------------------------------------------------------------------
create or replace function public.review_shift_request(
  p_request_id uuid,
  p_approve boolean,
  p_admin_note text default null
)
returns shift_requests
language plpgsql security definer set search_path = public as $$
declare
  v_request shift_requests;
  v_sample samples;
  v_panel panels;
  v_to_hall_name text;
begin
  if not public.is_super_admin() then
    raise exception 'Only admins can review shift requests';
  end if;

  select * into v_request from shift_requests where id = p_request_id and status = 'pending';
  if not found then
    raise exception 'Request not found or already reviewed';
  end if;

  if p_approve then
    select name into v_to_hall_name from halls where id = v_request.to_hall_id;

    if v_request.item_type = 'sample' then
      select * into v_sample from samples where id = v_request.item_id;
      if v_sample.id is null then
        raise exception 'Sample not found';
      end if;
      if v_sample.status <> 'in_hall' or v_sample.hall_id <> v_request.from_hall_id then
        raise exception 'Sample has moved since this request was raised';
      end if;

      update samples set hall_id = v_request.to_hall_id where id = v_sample.id;

      insert into movements (
        sample_id, picked_by_name, picked_by_email, destination, reason, notes,
        logged_by, status, picked_at, returned_at, from_hall_id, destination_hall_id, hop_number
      ) values (
        v_sample.id, 'Hall Shift', '', coalesce(v_to_hall_name, ''), 'Hall Shift', nullif(v_request.note, ''),
        auth.uid(), 'returned', now(), now(), v_request.from_hall_id, v_request.to_hall_id, 1
      );
    else
      select * into v_panel from panels where id = v_request.item_id;
      if v_panel.id is null then
        raise exception 'Panel not found';
      end if;
      if v_panel.status <> 'in_hall' or v_panel.hall_id <> v_request.from_hall_id then
        raise exception 'Panel has moved since this request was raised';
      end if;

      update panels set hall_id = v_request.to_hall_id where id = v_panel.id;

      insert into panel_movements (
        panel_id, picked_by_name, picked_by_email, destination, reason, notes,
        logged_by, status, picked_at, returned_at, from_hall_id, destination_hall_id, hop_number
      ) values (
        v_panel.id, 'Hall Shift', '', coalesce(v_to_hall_name, ''), 'Hall Shift', nullif(v_request.note, ''),
        auth.uid(), 'returned', now(), now(), v_request.from_hall_id, v_request.to_hall_id, 1
      );
    end if;
  end if;

  update shift_requests
  set status = case when p_approve then 'approved' else 'rejected' end,
      approved_by = auth.uid(),
      approved_at = now(),
      admin_note = p_admin_note
  where id = p_request_id
  returning * into v_request;

  return v_request;
end;
$$;

-- ----------------------------------------------------------------------------
-- E. Disable/enable users (Step 9) — a disabled profile is invisible to
-- every RLS policy in one shot, since all four scalar helper functions
-- that policies gate on now return null/false for a disabled caller
-- (`current_role() is null` fails every `= 'x'` check; `is_super_admin()`
-- returns false), rather than needing "and not is_disabled" added to each
-- of the many individual policies across the schema.
-- ----------------------------------------------------------------------------
alter table profiles add column if not exists is_disabled boolean not null default false;

create or replace function public.current_role()
returns text
language sql security definer stable set search_path = public as $$
  select role from profiles where id = auth.uid() and is_disabled is not true;
$$;

create or replace function public.current_hall_id()
returns uuid
language sql security definer stable set search_path = public as $$
  select hall_id from profiles where id = auth.uid() and is_disabled is not true;
$$;

create or replace function public.current_buyer_id()
returns uuid
language sql security definer stable set search_path = public as $$
  select buyer_id from profiles where id = auth.uid() and is_disabled is not true;
$$;

create or replace function public.is_super_admin()
returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'super_admin' and is_disabled is not true);
$$;

-- ----------------------------------------------------------------------------
-- F. Custom role (Step 9) — a 4th role value plus a permission-toggle
-- bag. `custom_permissions` keys match core/permissions/index.js's action
-- names (e.g. {"view_all_buyers": true, "manage_users": false, ...}); the
-- frontend permissions helper reads this only when role = 'custom'.
-- ----------------------------------------------------------------------------
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('super_admin','hall_manager','merchant','custom'));
alter table profiles add column if not exists custom_permissions jsonb not null default '{}'::jsonb;

-- ----------------------------------------------------------------------------
-- G. Audit log (Step 9) — append-only. Every authenticated user may insert
-- a row for their OWN actor_id (client calls this right after a state-
-- changing action succeeds — see core/lib/auditLog.js); only admins can
-- read the log. No update/delete policy at all — it's an audit trail.
-- ----------------------------------------------------------------------------
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id) not null default auth.uid(),
  action text not null,
  details jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_audit_log_created_at on audit_log(created_at desc);

alter table audit_log enable row level security;

drop policy if exists "audit_log_select_admin" on audit_log;
create policy "audit_log_select_admin" on audit_log for select to authenticated
  using (public.is_super_admin());

drop policy if exists "audit_log_insert_own" on audit_log;
create policy "audit_log_insert_own" on audit_log for insert to authenticated
  with check (actor_id = auth.uid());

-- ----------------------------------------------------------------------------
-- H. App settings (Step 9) — a single row of admin-configurable platform
-- settings (sender identity, notification toggles, Vercel deploy hook URL,
-- uploaded logo). Never stores the actual Resend/WhatsApp API keys — those
-- stay as Supabase Edge Function secrets (RESEND_API_KEY etc, set via
-- `supabase secrets set`), since a DB row readable by the app is the wrong
-- place for a real secret. This table only stores non-secret configuration
-- plus a boolean "is this key configured" flag the Settings page can show.
-- ----------------------------------------------------------------------------
create table if not exists app_settings (
  id boolean primary key default true,
  sender_name text default 'BASANT',
  sender_email text default 'noreply@basant.info',
  deploy_hook_url text,
  logo_url text,
  notification_prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now(),
  constraint app_settings_singleton check (id)
);

insert into app_settings (id) values (true) on conflict (id) do nothing;

alter table app_settings enable row level security;

drop policy if exists "app_settings_select_authenticated" on app_settings;
create policy "app_settings_select_authenticated" on app_settings for select to authenticated
  using (true);

drop policy if exists "app_settings_update_admin" on app_settings;
create policy "app_settings_update_admin" on app_settings for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ----------------------------------------------------------------------------
-- I. Custom role read access (Step 9/14) — the "View All Buyers"/"View
-- Movements"/"Manage Samples"/"Manage Panels" toggles need to actually
-- unlock data at the RLS layer, not just show/hide nav items client-side
-- (a hidden button is not a security boundary). A 'custom' profile with
-- has_custom_permission('view_all_buyers') sees everything an admin's
-- SELECT policies would show it; write access for custom roles is
-- intentionally NOT granted here — every insert/update policy in this
-- schema still requires is_super_admin() or an exact role match, so a
-- custom user can look but not touch beyond what's already select-scoped.
-- ----------------------------------------------------------------------------
create or replace function public.has_custom_permission(p_key text)
returns boolean
language sql security definer stable set search_path = public as $$
  select coalesce(
    (select (custom_permissions ->> p_key)::boolean
     from profiles where id = auth.uid() and role = 'custom' and is_disabled is not true),
    false
  );
$$;

drop policy if exists "buyers_select" on buyers;
create policy "buyers_select" on buyers for select to authenticated
  using (
    public.is_super_admin()
    or public.current_role() = 'hall_manager'
    or public.is_merchant_buyer(id)
    or public.has_custom_permission('view_all_buyers')
  );

drop policy if exists "samples_select" on samples;
create policy "samples_select" on samples for select to authenticated
  using (
    public.is_super_admin()
    or (public.current_role() = 'hall_manager' and hall_id = public.current_hall_id())
    or (public.current_role() = 'merchant' and public.is_merchant_buyer(buyer_id))
    or public.has_custom_permission('manage_samples')
    or public.has_custom_permission('view_all_buyers')
  );

drop policy if exists "movements_select" on movements;
create policy "movements_select" on movements for select to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from samples s where s.id = movements.sample_id
      and (
        (public.current_role() = 'hall_manager' and s.hall_id = public.current_hall_id())
        or (public.current_role() = 'merchant' and public.is_merchant_buyer(s.buyer_id))
      )
    )
    or public.has_custom_permission('view_movements')
  );

drop policy if exists "panels_select" on panels;
create policy "panels_select" on panels for select to authenticated
  using (
    public.is_super_admin()
    or (public.current_role() = 'hall_manager' and hall_id = public.current_hall_id())
    or (public.current_role() = 'merchant' and (is_shared or public.is_merchant_buyer(buyer_id)))
    or public.has_custom_permission('manage_panels')
    or public.has_custom_permission('view_all_buyers')
  );

-- Unchanged from the existing policy except the added has_custom_permission
-- clause — deliberately NOT adding the panels_select is_shared fix here too
-- (out of scope for this migration; preserving exactly what's live today).
drop policy if exists "panel_movements_select" on panel_movements;
create policy "panel_movements_select" on panel_movements for select to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from panels p where p.id = panel_movements.panel_id
      and (
        (public.current_role() = 'hall_manager' and p.hall_id = public.current_hall_id())
        or (public.current_role() = 'merchant' and public.is_merchant_buyer(p.buyer_id))
      )
    )
    or public.has_custom_permission('view_movements')
  );

-- ----------------------------------------------------------------------------
-- J. Last-login for the Team page's Users table (Step 9). `auth.users` is
-- not exposed to the client at all — this is the one narrow, read-only,
-- admin-gated window into it (just last_sign_in_at, nothing else from the
-- auth record) so the frontend doesn't need a service-role edge function
-- just to show a login timestamp.
-- ----------------------------------------------------------------------------
create or replace function public.admin_list_users_last_login()
returns table (id uuid, last_sign_in_at timestamptz)
language sql security definer stable set search_path = public as $$
  select u.id, u.last_sign_in_at
  from auth.users u
  where public.is_super_admin();
$$;

grant execute on function public.admin_list_users_last_login to authenticated;

notify pgrst, 'reload schema';
