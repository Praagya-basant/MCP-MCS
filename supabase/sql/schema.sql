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
  p_notes text,
  p_photo_url text default null,
  p_signature_url text default null,
  p_purchaser_name text default null,
  p_supplier_name text default null,
  p_movement_id uuid default null
)
returns movements
language plpgsql security definer set search_path = public as $$
declare
  v_hall_id uuid;
  v_current_status text;
  v_dest_hall_id uuid;
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

  -- Resolves the destination hall id from its name when the picked
  -- destination is an actual hall (not Supplier/Other/Mandore) — purely
  -- additive data for the multi-hop chain phase later; the free-text
  -- `destination` column stays the source of truth for display.
  select id into v_dest_hall_id from halls where name = p_destination;

  update samples set status = 'checked_out' where id = p_sample_id;

  -- `p_movement_id` lets the caller pre-generate the id client-side so a
  -- photo/signature can be uploaded to storage under
  -- movements/{movement_id}/ BEFORE this call, then passed in as URLs
  -- below — there's no id to build that path from until after the insert
  -- otherwise.
  insert into movements (
    id, sample_id, picked_by_name, picked_by_email, destination, reason,
    reason_other, notes, logged_by, status, from_hall_id, destination_hall_id,
    photo_url, signature_url, purchaser_name, supplier_name
  ) values (
    coalesce(p_movement_id, gen_random_uuid()), p_sample_id, p_picked_by_name, p_picked_by_email,
    p_destination, p_reason, nullif(p_reason_other, ''), nullif(p_notes, ''), auth.uid(), 'out',
    v_hall_id, v_dest_hall_id, p_photo_url, p_signature_url,
    nullif(p_purchaser_name, ''), nullif(p_supplier_name, '')
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
  admin_note text,
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
-- 8. MCS DEPTH (Phase 2) — validity management + the daily expiry-alert job.
-- checkout_sample() above was already extended (section 5) to accept
-- photo/signature/purchaser/supplier fields — this section is the
-- validity side: an audit log, two admin RPCs, and a pg_cron job.
-- ============================================================================

-- validity_requests already exists from the Phase 1 migration (its
-- `create table if not exists` above is a no-op against the live DB) —
-- add the column review_validity_request() below needs.
alter table validity_requests add column if not exists admin_note text;

-- Audit trail for every expiry-date change, whichever of the two paths
-- caused it (admin_update_validity below, or an approved
-- validity_requests row via review_validity_request). Panels aren't
-- built yet (MCP module phase) but the shape is item_type/item_id
-- generic so this table doesn't need to change when that phase lands.
create table if not exists validity_changes (
  id uuid primary key default gen_random_uuid(),
  item_type text not null check (item_type in ('sample','panel')),
  item_id uuid not null,
  changed_by uuid references profiles(id) not null,
  old_expiry_date date,
  new_expiry_date date,
  reason text,
  created_at timestamptz default now()
);

create index if not exists idx_validity_changes_item_id on validity_changes(item_id);

alter table validity_changes enable row level security;

-- Admin reads (drawer's "Validity History"); no direct write policy —
-- rows are only ever inserted by the two SECURITY DEFINER RPCs below,
-- which check is_super_admin() themselves.
drop policy if exists "validity_changes_select_admin" on validity_changes;
create policy "validity_changes_select_admin" on validity_changes for select to authenticated
  using (public.is_super_admin());

-- Direct admin edit — "Manage Validity" in the sample drawer. Extending
-- (add months / set a new date) and pre-expiring are the same operation
-- here (just a new expiry_date), the frontend just frames the UI
-- differently depending on whether the new date is later or earlier than
-- today.
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

  insert into validity_changes (item_type, item_id, changed_by, old_expiry_date, new_expiry_date, reason)
  values (p_item_type, p_item_id, auth.uid(), v_old_expiry, p_new_expiry_date, nullif(p_reason, ''));
end;
$$;

grant execute on function public.admin_update_validity to authenticated;

-- Approve/reject a merchant's validity_requests row. On approval, applies
-- requested_expiry_date if given, otherwise adds requested_months to the
-- item's current expiry (or today, if it had none set) — and logs it the
-- same as a direct admin edit.
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
begin
  if not public.is_super_admin() then
    raise exception 'Only admins can review validity requests';
  end if;

  select * into v_request from validity_requests where id = p_request_id and status = 'pending';
  if not found then
    raise exception 'Request not found or already reviewed';
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

    insert into validity_changes (item_type, item_id, changed_by, old_expiry_date, new_expiry_date, reason)
    values (v_request.item_type, v_request.item_id, auth.uid(), v_old_expiry, v_new_expiry,
            'Approved request: ' || coalesce(v_request.reason, 'no reason given'));
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

grant execute on function public.review_validity_request to authenticated;

-- ----------------------------------------------------------------------------
-- 8b. Daily validity-expiry alert job (pg_cron + pg_net)
-- Writes a `notifications` row for every admin/hall-manager/merchant tied
-- to a sample expiring in exactly 30 or 15 days, then calls the
-- send-notification edge function (case 'validity_alert') for email.
-- `app.settings.supabase_anon_key` is intentionally NOT hardcoded here —
-- it's a per-project value that doesn't belong baked into a version-
-- controlled file. Run once, separately (not part of this script):
--   alter database postgres set app.settings.supabase_anon_key = '<your anon key from .env>';
-- If pg_cron/pg_net aren't already enabled on the project, enable them
-- first via the Supabase dashboard's Database -> Extensions page (the
-- `create extension` calls below need that even from the SQL editor on
-- some plans).
-- ----------------------------------------------------------------------------

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.send_validity_alerts()
returns void
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_recipient_ids uuid[];
  v_anon_key text := current_setting('app.settings.supabase_anon_key', true);
begin
  for r in
    select s.id, s.bt_code, s.product_name, s.expiry_date, s.buyer_id, s.hall_id,
           (s.expiry_date - current_date)::int as days_left
    from samples s
    where s.expiry_date in (current_date + 30, current_date + 15)
  loop
    select array_agg(distinct p.id) into v_recipient_ids
    from profiles p
    left join merchant_buyers mb on mb.profile_id = p.id
    where p.role = 'super_admin'
       or (p.role = 'merchant' and (p.buyer_id = r.buyer_id or mb.buyer_id = r.buyer_id))
       or (p.role = 'hall_manager' and p.hall_id = r.hall_id);

    insert into notifications (recipient_id, title, message, type, item_type, item_id)
    select uid,
           'Sample expiring in ' || r.days_left || ' days',
           r.bt_code || ' — ' || r.product_name || ' expires on ' || to_char(r.expiry_date, 'DD Mon YYYY'),
           'validity_expiring', 'sample', r.id
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
            'btCode', r.bt_code,
            'productName', r.product_name,
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

grant execute on function public.send_validity_alerts to postgres;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'validity-alerts-daily') then
    perform cron.unschedule('validity-alerts-daily');
  end if;
  perform cron.schedule('validity-alerts-daily', '0 9 * * *', $cron$select public.send_validity_alerts();$cron$);
end $$;

-- ============================================================================
-- 9. MOVEMENT CHAIN (Phase 3) — multi-hop forwarding.
-- A "Forward" is a hall-to-hall (or hall-to-supplier/other) hop while a
-- sample is already checked out, distinct from Issue (in_hall ->
-- checked_out) and Return (checked_out -> in_hall). Modeled as closing
-- the active movement leg ("returned", green in the history timeline)
-- and opening a new one ("out", amber) in the same transaction — no
-- third movement "type" needed, matching the issue/return color legend.
-- `samples.hall_id` is treated as "current physical location": Forward
-- updates it (to whichever hall receives the sample), Issue/Return never
-- touch it — so a forwarded sample becomes visible to its NEW hall's
-- manager (current_hall_id() scoping) going forward, and Return always
-- lands it back in whatever hall it's currently sitting in.
-- ============================================================================

alter table movements add column if not exists hop_number integer not null default 1;

-- Only admin, or the hall_manager of the sample's CURRENT hall (i.e. the
-- one who currently "has" it), may forward it onward — same authorization
-- shape as checkout_sample/return_sample above. `p_movement_id` is the
-- active ('out') leg being closed; `p_new_movement_id` lets the caller
-- pre-generate the new leg's id client-side for photo/signature upload
-- paths, same as checkout_sample's p_movement_id.
create or replace function public.forward_sample(
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
  p_new_movement_id uuid default null
)
returns movements
language plpgsql security definer set search_path = public as $$
declare
  v_sample samples;
  v_old_movement movements;
  v_old_hall_id uuid;
  v_dest_hall_id uuid;
  v_new_movement movements;
begin
  select s.* into v_sample
  from movements m join samples s on s.id = m.sample_id
  where m.id = p_movement_id;

  if v_sample.id is null then
    raise exception 'Movement not found';
  end if;

  if v_sample.status <> 'checked_out' then
    raise exception 'Sample is not currently checked out';
  end if;

  if not public.is_super_admin() and v_sample.hall_id <> public.current_hall_id() then
    raise exception 'Not authorized to forward this sample';
  end if;

  update movements
  set status = 'returned', returned_at = now()
  where id = p_movement_id and status = 'out'
  returning * into v_old_movement;

  if v_old_movement.id is null then
    raise exception 'Movement already closed or not found';
  end if;

  v_old_hall_id := v_sample.hall_id;
  select id into v_dest_hall_id from halls where name = p_destination;

  if v_dest_hall_id is not null then
    update samples set hall_id = v_dest_hall_id where id = v_sample.id;
  end if;

  insert into movements (
    id, sample_id, picked_by_name, picked_by_email, destination, reason,
    reason_other, notes, logged_by, status, from_hall_id, destination_hall_id,
    photo_url, signature_url, purchaser_name, supplier_name, hop_number
  ) values (
    coalesce(p_new_movement_id, gen_random_uuid()), v_sample.id, p_picked_by_name, p_picked_by_email,
    p_destination, p_reason, nullif(p_reason_other, ''), nullif(p_notes, ''), auth.uid(), 'out',
    v_old_hall_id, v_dest_hall_id, p_photo_url, p_signature_url,
    nullif(p_purchaser_name, ''), nullif(p_supplier_name, ''), v_old_movement.hop_number + 1
  ) returning * into v_new_movement;

  return v_new_movement;
end;
$$;

grant execute on function public.forward_sample to authenticated;

-- ============================================================================
-- 10. WEB PUSH (Phase 4b) — one row per browser/device a user has
-- enabled push on (a user can have several: phone + desktop). The
-- send-notification edge function reads these with the service-role key
-- (bypasses RLS below) after writing each event's in-app notifications
-- row, so RLS here only needs to cover the frontend's own
-- subscribe/unsubscribe calls.
-- ============================================================================

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);

create index if not exists idx_push_subscriptions_profile_id on push_subscriptions(profile_id);

alter table push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_select_own" on push_subscriptions;
create policy "push_subscriptions_select_own" on push_subscriptions for select to authenticated
  using (profile_id = auth.uid());

-- insert + update (not just insert) so `.upsert()` on `endpoint` works —
-- browsers can return the same subscription/endpoint on a repeat
-- `PushManager.subscribe()` call (e.g. after a service worker update),
-- and Postgres upsert evaluates both policies for that path.
drop policy if exists "push_subscriptions_insert_own" on push_subscriptions;
create policy "push_subscriptions_insert_own" on push_subscriptions for insert to authenticated
  with check (profile_id = auth.uid());

drop policy if exists "push_subscriptions_update_own" on push_subscriptions;
create policy "push_subscriptions_update_own" on push_subscriptions for update to authenticated
  using (profile_id = auth.uid());

drop policy if exists "push_subscriptions_delete_own" on push_subscriptions;
create policy "push_subscriptions_delete_own" on push_subscriptions for delete to authenticated
  using (profile_id = auth.uid());

-- ============================================================================
-- 11. HALL SHIFT REQUESTS (Phase 5) — reassigning a sample's home hall
-- while it's sitting in_hall (distinct from forward_sample, which moves
-- an already-checked-out sample onward). Raised by the current hall's
-- manager or the sample's buyer's merchant, admin-approved, and on
-- approval both updates samples.hall_id and logs one already-closed
-- "Hall Shift" movement (status inserted straight as 'returned' — the
-- sample was never actually checked out, so there's no 'out' leg to
-- close first) so the journey timeline shows it happened.
-- ============================================================================

-- shift_requests already exists from the Phase 1 migration — add the
-- requester's own optional note (distinct from admin_note, which is only
-- set at approval/rejection time).
alter table shift_requests add column if not exists note text;

-- Broadens shift_requests_select from the Phase 1 placeholder
-- ("requester sees their own; admin sees all") to also cover the *other*
-- party — the current hall's manager and the sample's buyer's merchant
-- both need to see a request even if they didn't raise it themselves,
-- since both get notified either way (see the notification matrix).
drop policy if exists "shift_requests_select" on shift_requests;
create policy "shift_requests_select" on shift_requests for select to authenticated
  using (
    public.is_super_admin()
    or requested_by = auth.uid()
    or public.current_hall_id() in (from_hall_id, to_hall_id)
    or (
      item_type = 'sample'
      and exists (select 1 from samples s where s.id = item_id and public.is_merchant_buyer(s.buyer_id))
    )
  );

-- Replaces the Phase 1 placeholder ("requested_by = auth.uid()" only,
-- with no check that the requester is actually entitled to move THIS
-- sample) with the real authorization: from_hall_id must match the
-- sample's actual current hall (can't be spoofed), the sample must
-- currently be in_hall (a checked-out sample goes through
-- forward_sample, not this), and the caller must be admin, the manager
-- of that hall, or the merchant who owns the sample's buyer.
drop policy if exists "shift_requests_insert" on shift_requests;
create policy "shift_requests_insert" on shift_requests for insert to authenticated
  with check (
    requested_by = auth.uid()
    and item_type = 'sample'
    and exists (
      select 1 from samples s
      where s.id = item_id
      and s.status = 'in_hall'
      and s.hall_id = from_hall_id
      and (
        public.is_super_admin()
        or (public.current_role() = 'hall_manager' and s.hall_id = public.current_hall_id())
        or (public.current_role() = 'merchant' and public.is_merchant_buyer(s.buyer_id))
      )
    )
  );

-- Approve/reject — admin only. On approve: moves the sample to its new
-- hall and logs a single completed "Hall Shift" movement (from_hall_id ->
-- destination_hall_id, status 'returned' from the start, reason fixed to
-- 'Hall Shift' so the frontend's journey timeline can color it separately
-- from Issue/Return per the spec's issue=amber/return=green/shift=blue
-- legend without a new movements column).
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
    select * into v_sample from samples where id = v_request.item_id;
    if v_sample.id is null then
      raise exception 'Sample not found';
    end if;
    if v_sample.status <> 'in_hall' or v_sample.hall_id <> v_request.from_hall_id then
      raise exception 'Sample has moved since this request was raised';
    end if;

    select name into v_to_hall_name from halls where id = v_request.to_hall_id;

    update samples set hall_id = v_request.to_hall_id where id = v_sample.id;

    insert into movements (
      sample_id, picked_by_name, picked_by_email, destination, reason, notes,
      logged_by, status, picked_at, returned_at, from_hall_id, destination_hall_id, hop_number
    ) values (
      v_sample.id, 'Hall Shift', '', coalesce(v_to_hall_name, ''), 'Hall Shift', nullif(v_request.note, ''),
      auth.uid(), 'returned', now(), now(), v_request.from_hall_id, v_request.to_hall_id, 1
    );
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

grant execute on function public.review_shift_request to authenticated;

-- ============================================================================
-- 12. MCP MODULE FOUNDATION (Phase 6a) — panels/panel_movements tables
-- already exist from the Phase 1 migration (unused until now, so these
-- are safe to apply against zero existing rows). This pass only builds
-- Add Panel + list views + a read-only drawer; issue/return/forward/
-- retire land in a later pass once this foundation is confirmed working.
-- ============================================================================

-- panel_code was left nullable/non-unique in the Phase 1 stub — bringing
-- it in line with samples.bt_code (required, unique) now, before any
-- panel rows exist to conflict with the new constraint.
alter table panels alter column panel_code set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'panels_panel_code_key') then
    alter table panels add constraint panels_panel_code_key unique (panel_code);
  end if;
end $$;

-- Mirrors movements.hop_number (Phase 3) ahead of the forward_panel RPC
-- that will use it — added now so it doesn't need a second migration
-- once that lands.
alter table panel_movements add column if not exists hop_number integer not null default 1;

-- Fills in the Phase 1 policy's deferred "is_shared cross-buyer
-- visibility" — a shared panel isn't tied to one buyer's collection, so
-- every merchant can see it, not just is_merchant_buyer(buyer_id)'s
-- match. Non-shared panels are unchanged (still scoped to their own
-- buyer).
drop policy if exists "panels_select" on panels;
create policy "panels_select" on panels for select to authenticated
  using (
    public.is_super_admin()
    or (public.current_role() = 'hall_manager' and hall_id = public.current_hall_id())
    or (public.current_role() = 'merchant' and (is_shared or public.is_merchant_buyer(buyer_id)))
  );

-- ============================================================================
-- 13. MCP MOVEMENT CHAIN (Phase 6b) — checkout/return/forward for panels,
-- line-for-line the same shape as checkout_sample/return_sample/
-- forward_sample (section 5 / section 9) with panels/panel_movements/
-- panel_id/'issued' substituted for samples/movements/sample_id/
-- 'checked_out'. Deliberately not a shared/parameterized function
-- between the two — same reasoning as MCS/MCP staying separate modules
-- in the frontend: panels evolving its own status set (adding 'retired'
-- later) shouldn't risk samples' RPC, and vice versa.
-- ============================================================================

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
  p_movement_id uuid default null
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

  if not public.is_super_admin() and v_hall_id <> public.current_hall_id() then
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
    photo_url, signature_url, purchaser_name, supplier_name
  ) values (
    coalesce(p_movement_id, gen_random_uuid()), p_panel_id, p_picked_by_name, p_picked_by_email,
    p_destination, p_reason, nullif(p_reason_other, ''), nullif(p_notes, ''), auth.uid(), 'out',
    v_hall_id, v_dest_hall_id, p_photo_url, p_signature_url,
    nullif(p_purchaser_name, ''), nullif(p_supplier_name, '')
  ) returning * into v_movement;

  return v_movement;
end;
$$;

create or replace function public.return_panel(p_movement_id uuid)
returns panel_movements
language plpgsql security definer set search_path = public as $$
declare
  v_hall_id uuid;
  v_movement panel_movements;
begin
  select p.hall_id into v_hall_id
  from panel_movements m join panels p on p.id = m.panel_id
  where m.id = p_movement_id;

  if v_hall_id is null then
    raise exception 'Movement not found';
  end if;

  if not public.is_super_admin() and v_hall_id <> public.current_hall_id() then
    raise exception 'Not authorized to return this panel';
  end if;

  update panel_movements
  set status = 'returned', returned_at = now()
  where id = p_movement_id and status = 'out'
  returning * into v_movement;

  if v_movement.id is null then
    raise exception 'Movement already returned or not found';
  end if;

  update panels set status = 'in_hall' where id = v_movement.panel_id;

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
  p_new_movement_id uuid default null
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

  if not public.is_super_admin() and v_panel.hall_id <> public.current_hall_id() then
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
    photo_url, signature_url, purchaser_name, supplier_name, hop_number
  ) values (
    coalesce(p_new_movement_id, gen_random_uuid()), v_panel.id, p_picked_by_name, p_picked_by_email,
    p_destination, p_reason, nullif(p_reason_other, ''), nullif(p_notes, ''), auth.uid(), 'out',
    v_old_hall_id, v_dest_hall_id, p_photo_url, p_signature_url,
    nullif(p_purchaser_name, ''), nullif(p_supplier_name, ''), v_old_movement.hop_number + 1
  ) returning * into v_new_movement;

  return v_new_movement;
end;
$$;

grant execute on function public.checkout_panel to authenticated;
grant execute on function public.return_panel to authenticated;
grant execute on function public.forward_panel to authenticated;

-- ============================================================================
-- Done. Next steps (see CLAUDE.md / README for the full checklist):
--   1. Deploy the `send-notification` and `create-user` edge functions.
--   2. Create your first super_admin: add a user in Supabase Auth, then
--      insert a matching row into `profiles` with role = 'super_admin'.
-- ============================================================================
