-- ============================================================================
-- BASANT SSM — Module 1 (MCS) database schema
-- Run this entire file once in the Supabase SQL editor on a fresh project.
-- Safe to re-run: every statement is idempotent (IF NOT EXISTS / ON CONFLICT).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TABLES
-- ----------------------------------------------------------------------------

create table if not exists buyers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table if not exists halls (
  id uuid primary key default gen_random_uuid(),
  hall_number integer not null unique,
  created_at timestamptz default now()
);

-- Added after the initial schema (the app now displays this instead of
-- "Hall {hall_number}" everywhere). `add column if not exists` keeps
-- this script idempotent whether the column is already there — as it is
-- on the live project — or this is a brand-new install.
alter table halls add column if not exists name text;

insert into halls (hall_number, name)
select v.hall_number, v.name from (values (2,'Hall 2'),(5,'Hall 5'),(8,'Hall 8'),(10,'Hall 10'),(11,'Hall 11')) as v(hall_number, name)
where not exists (select 1 from halls h where h.hall_number = v.hall_number);

-- Backfills any hall row that predates the `name` column (e.g. seeded
-- before this change). Add further/renamed halls (like a "Mandore") by
-- hand via SQL insert — this seed only knows about the original 5.
update halls set name = 'Hall ' || hall_number where name is null;

create table if not exists profiles (
  id uuid primary key references auth.users(id),
  full_name text not null,
  email text not null,
  role text not null check (role in ('super_admin','hall_manager','merchant')),
  hall_id uuid references halls(id),
  buyer_id uuid references buyers(id),
  created_at timestamptz default now()
);

create table if not exists samples (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references buyers(id) not null,
  hall_id uuid references halls(id) not null,
  bt_code text not null unique,
  product_ref text,
  product_name text not null,
  image_url text,
  status text default 'in_hall' check (status in ('in_hall','checked_out')),
  created_at timestamptz default now()
);

create table if not exists movements (
  id uuid primary key default gen_random_uuid(),
  sample_id uuid references samples(id) not null,
  picked_by_name text not null,
  picked_by_email text not null,
  destination text not null,
  reason text not null,
  reason_other text,
  status text default 'out' check (status in ('out','returned')),
  picked_at timestamptz default now(),
  returned_at timestamptz,
  notes text,
  logged_by uuid references profiles(id)
);

create table if not exists merchant_contacts (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references buyers(id) not null,
  profile_id uuid references profiles(id) not null
);

create table if not exists recall_requests (
  id uuid primary key default gen_random_uuid(),
  sample_id uuid references samples(id) not null,
  requested_by uuid references profiles(id) not null,
  reason text,
  status text default 'pending' check (status in ('pending','acknowledged','resolved')),
  created_at timestamptz default now()
);

create table if not exists sample_comments (
  id uuid primary key default gen_random_uuid(),
  sample_id uuid references samples(id) not null,
  author_id uuid references profiles(id) not null,
  comment text not null,
  created_at timestamptz default now()
);

-- Manager/merchant -> admin one-way feedback mailbox. Not part of the MCS
-- sample-tracking model — no hall/buyer scoping, just "any signed-in user
-- can send, only admins can read/mark read".
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references profiles(id) not null,
  subject text not null,
  message text not null,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- Multi-buyer merchants (e.g. one merchant user covering several
-- buyers). `profiles.buyer_id` stays as the legacy single-buyer pointer
-- for backwards compatibility — this table is the new source of truth,
-- additive to it, not a replacement migration.
create table if not exists merchant_buyers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) not null,
  buyer_id uuid references buyers(id) not null,
  unique(profile_id, buyer_id)
);

insert into buyers (id, name)
select '11111111-1111-1111-1111-111111111111', 'Maison du Monde (MDM)'
where not exists (select 1 from buyers where id = '11111111-1111-1111-1111-111111111111');

-- ----------------------------------------------------------------------------
-- 2. INDEXES (foreign keys are not auto-indexed in Postgres)
-- ----------------------------------------------------------------------------

create index if not exists idx_profiles_hall_id on profiles(hall_id);
create index if not exists idx_profiles_buyer_id on profiles(buyer_id);
create index if not exists idx_samples_buyer_id on samples(buyer_id);
create index if not exists idx_samples_hall_id on samples(hall_id);
create index if not exists idx_samples_status on samples(status);
create index if not exists idx_movements_sample_id on movements(sample_id);
create index if not exists idx_movements_status on movements(status);
create index if not exists idx_movements_picked_at on movements(picked_at);
create index if not exists idx_merchant_contacts_buyer_id on merchant_contacts(buyer_id);
create index if not exists idx_recall_requests_sample_id on recall_requests(sample_id);
create index if not exists idx_sample_comments_sample_id on sample_comments(sample_id);
create index if not exists idx_feedback_sender_id on feedback(sender_id);
create index if not exists idx_feedback_created_at on feedback(created_at);
create index if not exists idx_merchant_buyers_profile_id on merchant_buyers(profile_id);
create index if not exists idx_merchant_buyers_buyer_id on merchant_buyers(buyer_id);

-- ----------------------------------------------------------------------------
-- 3. HELPER FUNCTIONS
-- SECURITY DEFINER lets these read `profiles` without triggering RLS
-- recursion (a policy on `profiles` that queries `profiles` would deadlock
-- otherwise). Only ever return scalars derived from auth.uid() — never take
-- caller-supplied ids — so they can't be used to leak other users' data.
-- ----------------------------------------------------------------------------

create or replace function public.current_role()
returns text
language sql security definer stable set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function public.current_hall_id()
returns uuid
language sql security definer stable set search_path = public as $$
  select hall_id from profiles where id = auth.uid();
$$;

create or replace function public.current_buyer_id()
returns uuid
language sql security definer stable set search_path = public as $$
  select buyer_id from profiles where id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'super_admin');
$$;

-- Single access check covering BOTH the legacy profiles.buyer_id pointer
-- and the new merchant_buyers table, so every RLS policy that used to
-- compare `buyer_id = current_buyer_id()` can switch to this one call and
-- transparently support merchants with several assigned buyers.
create or replace function public.is_merchant_buyer(p_buyer_id uuid)
returns boolean
language sql security definer stable set search_path = public as $$
  select
    p_buyer_id = public.current_buyer_id()
    or exists (
      select 1 from merchant_buyers where profile_id = auth.uid() and buyer_id = p_buyer_id
    );
$$;

-- ----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------

alter table profiles enable row level security;
alter table buyers enable row level security;
alter table halls enable row level security;
alter table samples enable row level security;
alter table movements enable row level security;
alter table merchant_contacts enable row level security;
alter table recall_requests enable row level security;
alter table sample_comments enable row level security;
alter table feedback enable row level security;
alter table merchant_buyers enable row level security;

-- profiles: everyone can read their own row; admin reads/writes all.
-- Regular inserts/updates for user management go through the
-- `create-user` edge function (service role), which bypasses RLS —
-- these policies exist for admin-side reads and future direct edits.
drop policy if exists "profiles_select" on profiles;
create policy "profiles_select" on profiles for select to authenticated
  using (id = auth.uid() or public.is_super_admin());

drop policy if exists "profiles_insert_admin" on profiles;
create policy "profiles_insert_admin" on profiles for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists "profiles_update_admin" on profiles;
create policy "profiles_update_admin" on profiles for update to authenticated
  using (public.is_super_admin());

drop policy if exists "profiles_delete_admin" on profiles;
create policy "profiles_delete_admin" on profiles for delete to authenticated
  using (public.is_super_admin());

-- buyers: admin full read; hall managers need the full list for the
-- "buyer" dropdown when adding a sample; merchants only see their own buyer.
drop policy if exists "buyers_select" on buyers;
create policy "buyers_select" on buyers for select to authenticated
  using (
    public.is_super_admin()
    or public.current_role() = 'hall_manager'
    or public.is_merchant_buyer(id)
  );

drop policy if exists "buyers_insert_admin" on buyers;
create policy "buyers_insert_admin" on buyers for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists "buyers_update_admin" on buyers;
create policy "buyers_update_admin" on buyers for update to authenticated
  using (public.is_super_admin());

-- merchant_buyers: admin-only in every direction. Assignment happens
-- exclusively from Admin -> Buyers -> Edit Buyer (syncMerchantContacts),
-- which is always called by an admin session, so a single full-access
-- policy covers select/insert/update/delete — merchants never query this
-- table directly themselves (is_merchant_buyer() is SECURITY DEFINER and
-- bypasses RLS for the scoping checks on samples/movements/etc).
drop policy if exists "merchant_buyers_select" on merchant_buyers;
drop policy if exists "merchant_buyers_write_admin" on merchant_buyers;
drop policy if exists "Admin full access" on merchant_buyers;
create policy "Admin full access" on merchant_buyers
  using (exists (select 1 from profiles where id = auth.uid() and role = 'super_admin'));

-- halls: hall numbers aren't sensitive and are needed app-wide
-- (destination dropdowns, headers) — readable by any authenticated user.
drop policy if exists "halls_select" on halls;
create policy "halls_select" on halls for select to authenticated
  using (true);

drop policy if exists "halls_write_admin" on halls;
create policy "halls_write_admin" on halls for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- samples: scoped per role. Status transitions (checkout/return) happen
-- exclusively through the RPC functions below, which are SECURITY DEFINER
-- and enforce hall scoping internally — so no direct UPDATE policy is
-- needed for hall managers here.
drop policy if exists "samples_select" on samples;
create policy "samples_select" on samples for select to authenticated
  using (
    public.is_super_admin()
    or (public.current_role() = 'hall_manager' and hall_id = public.current_hall_id())
    or (public.current_role() = 'merchant' and public.is_merchant_buyer(buyer_id))
  );

drop policy if exists "samples_insert" on samples;
create policy "samples_insert" on samples for insert to authenticated
  with check (
    public.is_super_admin()
    or (public.current_role() = 'hall_manager' and hall_id = public.current_hall_id())
  );

drop policy if exists "samples_update_admin" on samples;
create policy "samples_update_admin" on samples for update to authenticated
  using (public.is_super_admin());

-- movements: read-scoped via the parent sample's hall/buyer. Writes happen
-- through the checkout_sample / return_sample RPCs only.
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
  );

-- merchant_contacts: admin-managed only (assigning merchants to buyers).
drop policy if exists "merchant_contacts_select_admin" on merchant_contacts;
create policy "merchant_contacts_select_admin" on merchant_contacts for select to authenticated
  using (public.is_super_admin());

drop policy if exists "merchant_contacts_write_admin" on merchant_contacts;
create policy "merchant_contacts_write_admin" on merchant_contacts for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- recall_requests: merchants raise recalls on their own buyer's samples;
-- hall managers can see recalls for samples in their hall (they're the
-- ones who receive the notification email and action the return).
drop policy if exists "recall_requests_select" on recall_requests;
create policy "recall_requests_select" on recall_requests for select to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from samples s where s.id = recall_requests.sample_id
      and (
        (public.current_role() = 'hall_manager' and s.hall_id = public.current_hall_id())
        or (public.current_role() = 'merchant' and public.is_merchant_buyer(s.buyer_id))
      )
    )
  );

drop policy if exists "recall_requests_insert_merchant" on recall_requests;
create policy "recall_requests_insert_merchant" on recall_requests for insert to authenticated
  with check (
    public.current_role() = 'merchant'
    and requested_by = auth.uid()
    and exists (select 1 from samples s where s.id = sample_id and public.is_merchant_buyer(s.buyer_id))
  );

drop policy if exists "recall_requests_update" on recall_requests;
create policy "recall_requests_update" on recall_requests for update to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from samples s where s.id = recall_requests.sample_id
      and public.current_role() = 'hall_manager' and s.hall_id = public.current_hall_id()
    )
  );

-- sample_comments: merchants comment on their own buyer's samples; hall
-- managers and admins can read comments on samples they can already see.
drop policy if exists "sample_comments_select" on sample_comments;
create policy "sample_comments_select" on sample_comments for select to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from samples s where s.id = sample_comments.sample_id
      and (
        (public.current_role() = 'hall_manager' and s.hall_id = public.current_hall_id())
        or (public.current_role() = 'merchant' and public.is_merchant_buyer(s.buyer_id))
      )
    )
  );

drop policy if exists "sample_comments_insert_merchant" on sample_comments;
create policy "sample_comments_insert_merchant" on sample_comments for insert to authenticated
  with check (
    public.current_role() = 'merchant'
    and author_id = auth.uid()
    and exists (select 1 from samples s where s.id = sample_id and public.is_merchant_buyer(s.buyer_id))
  );

-- feedback: one-way mailbox — any signed-in user can send (as themselves),
-- only admins can read it or mark it read. No update/select policy for the
-- sender since this isn't a two-way thread.
drop policy if exists "feedback_select_admin" on feedback;
create policy "feedback_select_admin" on feedback for select to authenticated
  using (public.is_super_admin());

drop policy if exists "feedback_insert_own" on feedback;
create policy "feedback_insert_own" on feedback for insert to authenticated
  with check (sender_id = auth.uid());

drop policy if exists "feedback_update_admin" on feedback;
create policy "feedback_update_admin" on feedback for update to authenticated
  using (public.is_super_admin());

-- ----------------------------------------------------------------------------
-- 5. ATOMIC WORKFLOW FUNCTIONS
-- Checkout/return touch two tables at once; wrapping them in a single
-- SECURITY DEFINER function keeps the frontend to one call and guarantees
-- samples.status and the movements row never drift out of sync.
-- ----------------------------------------------------------------------------

create or replace function public.checkout_sample(
  p_sample_id uuid,
  p_picked_by_name text,
  p_picked_by_email text,
  p_destination text,
  p_reason text,
  p_reason_other text,
  p_notes text
)
returns movements
language plpgsql security definer set search_path = public as $$
declare
  v_hall_id uuid;
  v_current_status text;
  v_movement movements;
begin
  select hall_id, status into v_hall_id, v_current_status from samples where id = p_sample_id;

  if v_hall_id is null then
    raise exception 'Sample not found';
  end if;

  if not public.is_super_admin() and v_hall_id <> public.current_hall_id() then
    raise exception 'Not authorized to check out this sample';
  end if;

  if v_current_status = 'checked_out' then
    raise exception 'Sample is already checked out';
  end if;

  update samples set status = 'checked_out' where id = p_sample_id;

  insert into movements (
    sample_id, picked_by_name, picked_by_email, destination, reason,
    reason_other, notes, logged_by, status
  ) values (
    p_sample_id, p_picked_by_name, p_picked_by_email, p_destination, p_reason,
    nullif(p_reason_other, ''), nullif(p_notes, ''), auth.uid(), 'out'
  ) returning * into v_movement;

  return v_movement;
end;
$$;

create or replace function public.return_sample(p_movement_id uuid)
returns movements
language plpgsql security definer set search_path = public as $$
declare
  v_hall_id uuid;
  v_movement movements;
begin
  select s.hall_id into v_hall_id
  from movements m join samples s on s.id = m.sample_id
  where m.id = p_movement_id;

  if v_hall_id is null then
    raise exception 'Movement not found';
  end if;

  if not public.is_super_admin() and v_hall_id <> public.current_hall_id() then
    raise exception 'Not authorized to return this sample';
  end if;

  update movements
  set status = 'returned', returned_at = now()
  where id = p_movement_id and status = 'out'
  returning * into v_movement;

  if v_movement.id is null then
    raise exception 'Movement already returned or not found';
  end if;

  update samples set status = 'in_hall' where id = v_movement.sample_id;

  return v_movement;
end;
$$;

grant execute on function public.checkout_sample to authenticated;
grant execute on function public.return_sample to authenticated;

-- ----------------------------------------------------------------------------
-- 5b. TEST-DATA UTILITY — clear all movement history (admin only)
-- Wipes the movements audit trail and resets any currently-issued
-- samples back to 'in_hall' in the same transaction, so nothing is left
-- stuck "Issued" with no movement record to return against. There is no
-- direct DELETE policy on `movements` — this SECURITY DEFINER function
-- (which checks is_super_admin() itself) is the only way to remove
-- movement rows, same pattern as checkout_sample/return_sample.
-- ----------------------------------------------------------------------------

create or replace function public.clear_movement_history()
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() then
    raise exception 'Only admins can clear movement history';
  end if;

  update samples set status = 'in_hall' where status = 'checked_out';
  delete from movements where true;
end;
$$;

grant execute on function public.clear_movement_history to authenticated;

-- ----------------------------------------------------------------------------
-- 5c. Set a sample's image_url — admin or that sample's own hall manager
-- `samples_update_admin` only grants direct table UPDATE to admins (hall
-- managers never got one, since checkout/return went through the RPCs
-- above instead), so hall managers have no way to set image_url via a
-- plain `.update()`. Same pattern as checkout_sample: SECURITY DEFINER,
-- hall-scoped check, admin bypass.
-- ----------------------------------------------------------------------------

create or replace function public.set_sample_image(p_sample_id uuid, p_image_url text)
returns samples
language plpgsql security definer set search_path = public as $$
declare
  v_hall_id uuid;
  v_sample samples;
begin
  select hall_id into v_hall_id from samples where id = p_sample_id;

  if v_hall_id is null then
    raise exception 'Sample not found';
  end if;

  if not public.is_super_admin() and v_hall_id <> public.current_hall_id() then
    raise exception 'Not authorized to update this sample';
  end if;

  update samples set image_url = p_image_url where id = p_sample_id
  returning * into v_sample;

  return v_sample;
end;
$$;

grant execute on function public.set_sample_image to authenticated;

-- ----------------------------------------------------------------------------
-- 5d. Delete a single sample (admin only) — permanently removes the sample
-- and its full history (movements, recalls, comments). Blocked while the
-- sample is checked out, same "don't leave an issue dangling" judgment as
-- clear_movement_history. No direct DELETE policy exists on
-- samples/movements/recall_requests/sample_comments, so this SECURITY
-- DEFINER function is the only way to remove them.
-- ----------------------------------------------------------------------------

create or replace function public.delete_sample(p_sample_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_status text;
begin
  if not public.is_super_admin() then
    raise exception 'Only admins can delete samples';
  end if;

  select status into v_status from samples where id = p_sample_id;

  if v_status is null then
    raise exception 'Sample not found';
  end if;

  if v_status = 'checked_out' then
    raise exception 'Cannot delete a sample that is currently issued';
  end if;

  delete from recall_requests where sample_id = p_sample_id;
  delete from sample_comments where sample_id = p_sample_id;
  delete from movements where sample_id = p_sample_id;
  delete from samples where id = p_sample_id;
end;
$$;

grant execute on function public.delete_sample to authenticated;

-- ----------------------------------------------------------------------------
-- 5e. Delete a buyer (admin only) — permanently removes the buyer, every
-- one of their samples, and all associated movement/recall/comment
-- history. Blocked if any of the buyer's samples is currently checked
-- out. Merchant profiles pointed at this buyer are unassigned (buyer_id
-- set to null) rather than left dangling on a deleted row — same
-- direction as unchecking a merchant contact in syncMerchantContacts().
-- ----------------------------------------------------------------------------

create or replace function public.delete_buyer(p_buyer_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() then
    raise exception 'Only admins can delete buyers';
  end if;

  if not exists (select 1 from buyers where id = p_buyer_id) then
    raise exception 'Buyer not found';
  end if;

  if exists (select 1 from samples where buyer_id = p_buyer_id and status = 'checked_out') then
    raise exception 'Cannot delete a buyer with samples currently issued';
  end if;

  delete from recall_requests where sample_id in (select id from samples where buyer_id = p_buyer_id);
  delete from sample_comments where sample_id in (select id from samples where buyer_id = p_buyer_id);
  delete from movements where sample_id in (select id from samples where buyer_id = p_buyer_id);
  delete from samples where buyer_id = p_buyer_id;

  update profiles set buyer_id = null where buyer_id = p_buyer_id;
  delete from merchant_contacts where buyer_id = p_buyer_id;
  delete from buyers where id = p_buyer_id;
end;
$$;

grant execute on function public.delete_buyer to authenticated;

-- ----------------------------------------------------------------------------
-- 6. STORAGE — sample images
-- Public bucket so <img> tags can render image_url directly with no auth
-- header; uploads restricted to hall managers and admins.
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('sample-images', 'sample-images', true)
on conflict (id) do nothing;

drop policy if exists "sample_images_upload" on storage.objects;
create policy "sample_images_upload" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'sample-images'
    and (public.is_super_admin() or public.current_role() = 'hall_manager')
  );

drop policy if exists "sample_images_update" on storage.objects;
create policy "sample_images_update" on storage.objects for update to authenticated
  using (
    bucket_id = 'sample-images'
    and (public.is_super_admin() or public.current_role() = 'hall_manager')
  );

drop policy if exists "sample_images_delete" on storage.objects;
create policy "sample_images_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'sample-images'
    and (public.is_super_admin() or public.current_role() = 'hall_manager')
  );

-- ============================================================================
-- 7. MAJOR UPGRADE (Foundation phase) — MCP module tables, validity/shift
-- request tables, notifications, and new columns on samples/movements.
-- Nothing here is wired to any UI yet (that's later phases) — this is
-- purely the schema so every later phase has ground to build on. Written
-- and reviewed against the live schema above, not run against the DB by
-- me directly (no service-role access) — hand this whole file to the
-- Supabase SQL editor.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 7a. New columns on existing tables
-- ----------------------------------------------------------------------------

alter table samples
  add column if not exists buyer_code text,
  add column if not exists collection_name text,
  add column if not exists signed_by text,
  add column if not exists signed_date date,
  add column if not exists validity_months integer,
  add column if not exists expiry_date date,
  add column if not exists date_added_to_hall date;

-- halls.name already exists (added in an earlier session) — kept for
-- idempotency so this file stays runnable standalone on a fresh project.
alter table halls add column if not exists name text;

alter table movements
  add column if not exists from_hall_id uuid references halls(id),
  add column if not exists destination_hall_id uuid references halls(id),
  add column if not exists purchaser_name text,
  add column if not exists supplier_name text,
  add column if not exists photo_url text,
  add column if not exists signature_url text;

-- ----------------------------------------------------------------------------
-- 7b. New tables
-- ----------------------------------------------------------------------------

create table if not exists panels (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references buyers(id) not null,
  hall_id uuid references halls(id) not null,
  panel_code text,
  panel_name text not null,
  panel_ref text,
  panel_finish text,
  finish_recipe text,
  collection_name text,
  image_url text,
  status text default 'in_hall' check (status in ('in_hall','issued','retired')),
  is_shared boolean default false,
  signed_by text,
  signed_date date,
  validity_months integer,
  expiry_date date,
  date_added_to_hall date,
  created_at timestamptz default now()
);

create table if not exists panel_movements (
  id uuid primary key default gen_random_uuid(),
  panel_id uuid references panels(id) not null,
  from_hall_id uuid references halls(id),
  destination text not null,
  destination_hall_id uuid references halls(id),
  picked_by_name text not null,
  picked_by_email text,
  reason text not null,
  reason_other text,
  purchaser_name text,
  supplier_name text,
  photo_url text,
  signature_url text,
  status text default 'out' check (status in ('out','returned')),
  picked_at timestamptz default now(),
  returned_at timestamptz,
  notes text,
  logged_by uuid references profiles(id)
);

create table if not exists shift_requests (
  id uuid primary key default gen_random_uuid(),
  item_type text not null check (item_type in ('sample','panel')),
  item_id uuid not null,
  from_hall_id uuid references halls(id) not null,
  to_hall_id uuid references halls(id) not null,
  requested_by uuid references profiles(id) not null,
  status text default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text,
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists validity_requests (
  id uuid primary key default gen_random_uuid(),
  item_type text not null check (item_type in ('sample','panel')),
  item_id uuid not null,
  requested_by uuid references profiles(id) not null,
  requested_months integer,
  requested_expiry_date date,
  reason text,
  status text default 'pending' check (status in ('pending','approved','rejected')),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_at timestamptz default now()
);

-- Already exists (built in an earlier session) — kept here so this file
-- stays runnable standalone; the create is a no-op against the live DB.
create table if not exists merchant_buyers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) not null,
  buyer_id uuid references buyers(id) not null,
  unique(profile_id, buyer_id)
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references profiles(id) not null,
  title text not null,
  message text not null,
  type text not null,
  item_type text,
  item_id uuid,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- ----------------------------------------------------------------------------
-- 7c. Indexes
-- ----------------------------------------------------------------------------

create index if not exists idx_samples_expiry_date on samples(expiry_date);
create index if not exists idx_movements_from_hall_id on movements(from_hall_id);
create index if not exists idx_movements_destination_hall_id on movements(destination_hall_id);
create index if not exists idx_panels_buyer_id on panels(buyer_id);
create index if not exists idx_panels_hall_id on panels(hall_id);
create index if not exists idx_panels_status on panels(status);
create index if not exists idx_panels_expiry_date on panels(expiry_date);
create index if not exists idx_panel_movements_panel_id on panel_movements(panel_id);
create index if not exists idx_panel_movements_status on panel_movements(status);
create index if not exists idx_panel_movements_picked_at on panel_movements(picked_at);
create index if not exists idx_shift_requests_item_id on shift_requests(item_id);
create index if not exists idx_shift_requests_requested_by on shift_requests(requested_by);
create index if not exists idx_shift_requests_status on shift_requests(status);
create index if not exists idx_validity_requests_item_id on validity_requests(item_id);
create index if not exists idx_validity_requests_requested_by on validity_requests(requested_by);
create index if not exists idx_validity_requests_status on validity_requests(status);
create index if not exists idx_notifications_recipient_id on notifications(recipient_id);
create index if not exists idx_notifications_is_read on notifications(is_read);
create index if not exists idx_notifications_created_at on notifications(created_at);

-- ----------------------------------------------------------------------------
-- 7d. Row level security
--
-- These are tightened from the original draft spec, which omitted `for`
-- clauses on several policies — without one, a policy defaults to `for
-- all` (select/insert/update/delete together), which would have let
-- merchants write to panels (spec says they're read-only) and let a
-- shift/validity requester edit their own request's status after
-- submitting it (only admin should ever change status — that happens via
-- an RPC in the phase that builds the approval flow, matching the
-- existing checkout_sample/return_sample pattern). Split into explicit
-- `for select` / `for insert` / `for update` below instead.
-- ----------------------------------------------------------------------------

alter table panels enable row level security;
alter table panel_movements enable row level security;
alter table shift_requests enable row level security;
alter table validity_requests enable row level security;
alter table merchant_buyers enable row level security;
alter table notifications enable row level security;

-- panels: same shape as samples_select/samples_insert. is_shared cross-buyer
-- visibility is deferred to the MCP module build — this is the baseline.
drop policy if exists "panels_select" on panels;
create policy "panels_select" on panels for select to authenticated
  using (
    public.is_super_admin()
    or (public.current_role() = 'hall_manager' and hall_id = public.current_hall_id())
    or (public.current_role() = 'merchant' and public.is_merchant_buyer(buyer_id))
  );

drop policy if exists "panels_insert" on panels;
create policy "panels_insert" on panels for insert to authenticated
  with check (
    public.is_super_admin()
    or (public.current_role() = 'hall_manager' and hall_id = public.current_hall_id())
  );

drop policy if exists "panels_update_admin" on panels;
create policy "panels_update_admin" on panels for update to authenticated
  using (public.is_super_admin());

-- panel_movements: read-scoped via the parent panel's hall/buyer, mirroring
-- movements_select. No insert/update policy yet — writes will go through a
-- SECURITY DEFINER RPC (like checkout_sample/return_sample) once the panel
-- issue/return flow is built; until then RLS blocks all writes by default.
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
  );

-- shift_requests: requester (manager or merchant) sees their own; admin
-- sees all. Broader visibility (e.g. a hall manager seeing a merchant-
-- raised request for their hall) is added when the shift-request flow
-- itself is built. Approval is admin-only.
drop policy if exists "shift_requests_select" on shift_requests;
create policy "shift_requests_select" on shift_requests for select to authenticated
  using (public.is_super_admin() or requested_by = auth.uid());

drop policy if exists "shift_requests_insert" on shift_requests;
create policy "shift_requests_insert" on shift_requests for insert to authenticated
  with check (requested_by = auth.uid());

drop policy if exists "shift_requests_update_admin" on shift_requests;
create policy "shift_requests_update_admin" on shift_requests for update to authenticated
  using (public.is_super_admin());

-- validity_requests: merchants raise their own, admin approves. Mirrors
-- recall_requests_insert_merchant's shape.
drop policy if exists "validity_requests_select" on validity_requests;
create policy "validity_requests_select" on validity_requests for select to authenticated
  using (public.is_super_admin() or requested_by = auth.uid());

drop policy if exists "validity_requests_insert_merchant" on validity_requests;
create policy "validity_requests_insert_merchant" on validity_requests for insert to authenticated
  with check (public.current_role() = 'merchant' and requested_by = auth.uid());

drop policy if exists "validity_requests_update_admin" on validity_requests;
create policy "validity_requests_update_admin" on validity_requests for update to authenticated
  using (public.is_super_admin());

-- merchant_buyers: already has its "Admin full access" policy from an
-- earlier session (admin-only select/insert/update/delete) — nothing to
-- add here; re-stated in the enable-RLS block above only for idempotency.

-- notifications: recipient reads/marks their own read; admin reads all.
-- No insert policy for regular users on purpose — notifications are
-- system-generated (via a SECURITY DEFINER RPC or the service-role edge
-- function), not user-authored, even to yourself. That write path is
-- added in the notification-service phase.
drop policy if exists "notifications_select_own" on notifications;
create policy "notifications_select_own" on notifications for select to authenticated
  using (recipient_id = auth.uid() or public.is_super_admin());

drop policy if exists "notifications_update_own" on notifications;
create policy "notifications_update_own" on notifications for update to authenticated
  using (recipient_id = auth.uid() or public.is_super_admin());

-- ============================================================================
-- Done. Next steps (see CLAUDE.md / README for the full checklist):
--   1. Deploy the `send-notification` and `create-user` edge functions.
--   2. Create your first super_admin: add a user in Supabase Auth, then
--      insert a matching row into `profiles` with role = 'super_admin'.
-- ============================================================================
