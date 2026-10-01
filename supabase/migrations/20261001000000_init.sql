-- =============================================================================
-- GO Account Manager — initial schema
--
-- Security model
--   * Every table has Row Level Security enabled.
--   * Clients (anon / authenticated) can never write to tables directly. All
--     mutations go through SECURITY DEFINER functions below, which check the
--     caller's role, validate input, and write an audit trail atomically.
--   * Reads go through SECURITY INVOKER functions, so RLS decides what each
--     caller can see: admins see everything, submitters only their own rows.
--   * Account passwords are encrypted by the application (AES-256-GCM) before
--     they reach the database. The ciphertext columns are not readable by the
--     `authenticated` role at all (column privileges); admins fetch them one at
--     a time through `admin_get_account_secret`, which is audited.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
-- RLS policies run as the caller, so the caller needs to reach the helpers.
grant usage on schema private to authenticated;

-- -----------------------------------------------------------------------------
-- Types
-- -----------------------------------------------------------------------------
create type public.user_role as enum ('ADMIN', 'SUBMITTER');
create type public.account_type as enum ('NEW', 'BOT', 'OLD');
create type public.account_status as enum ('PENDING', 'APPROVED', 'UNSOLD', 'SOLD', 'REJECTED');
create type public.activity_action as enum (
  'CREATED', 'SUBMITTED', 'EDITED', 'TYPE_CHANGED', 'STATUS_CHANGED',
  'APPROVED', 'REJECTED', 'MARKED_SOLD', 'MARKED_UNSOLD', 'DELETED',
  'CREDENTIALS_UPDATED', 'CREDENTIALS_REVEALED', 'IMPORTED', 'EXPORTED',
  'USER_REGISTERED', 'USER_ROLE_CHANGED', 'USER_DISABLED', 'USER_ENABLED'
);

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

-- Application users (1:1 with auth.users).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '' check (char_length(full_name) <= 80),
  role public.user_role not null default 'SUBMITTER',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Account metadata. Credentials live in account_credentials.
create table public.accounts (
  id bigint generated always as identity primary key,
  submitter_id uuid references public.profiles (id) on delete set null,
  type public.account_type not null default 'NEW',
  status public.account_status not null default 'PENDING',
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  rejected_at timestamptz,
  rejected_by uuid references public.profiles (id) on delete set null,
  sold_at timestamptz,
  sold_by uuid references public.profiles (id) on delete set null
);

-- Credentials, stored separately from metadata. *_enc columns hold
-- application-encrypted ciphertext ("v1:<iv>:<tag>:<data>", base64url).
create table public.account_credentials (
  account_id bigint primary key references public.accounts (id) on delete cascade,
  login_email text not null check (char_length(login_email) between 3 and 254),
  login_password_enc text not null check (login_password_enc ~ '^v1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$'),
  ptc_login text check (ptc_login is null or char_length(ptc_login) between 1 and 64),
  ptc_password_enc text check (ptc_password_enc is null or ptc_password_enc ~ '^v1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_credentials_ptc_pair check ((ptc_login is null) = (ptc_password_enc is null))
);

-- Append-only audit trail. Never contains passwords or other secrets.
create table public.account_activity (
  id bigint generated always as identity primary key,
  account_id bigint references public.accounts (id) on delete set null,
  account_ref bigint, -- survives account deletion so the log stays readable
  actor_id uuid references public.profiles (id) on delete set null,
  target_user_id uuid references public.profiles (id) on delete set null,
  action public.activity_action not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.sales (
  id bigint generated always as identity primary key,
  account_id bigint not null references public.accounts (id) on delete cascade,
  sold_by uuid references public.profiles (id) on delete set null,
  sold_at timestamptz not null default now(),
  price numeric(10, 2) check (price is null or price >= 0),
  voided_at timestamptz,
  voided_by uuid references public.profiles (id) on delete set null
);

create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  account_id bigint references public.accounts (id) on delete set null,
  kind text not null,
  title text not null,
  body text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------
create index profiles_email_trgm_idx on public.profiles using gin (email extensions.gin_trgm_ops);
create index profiles_full_name_trgm_idx on public.profiles using gin (full_name extensions.gin_trgm_ops);
create index profiles_role_idx on public.profiles (role) where is_active;

create index accounts_status_idx on public.accounts (status);
create index accounts_type_status_idx on public.accounts (type, status);
create index accounts_submitter_idx on public.accounts (submitter_id, created_at desc);
create index accounts_created_at_idx on public.accounts (created_at desc);
create index accounts_sold_at_idx on public.accounts (sold_at desc) where sold_at is not null;

create unique index account_credentials_login_email_key on public.account_credentials (lower(login_email));
create index account_credentials_login_email_trgm_idx on public.account_credentials using gin (login_email extensions.gin_trgm_ops);
create index account_credentials_ptc_login_trgm_idx on public.account_credentials using gin (ptc_login extensions.gin_trgm_ops);

create index account_activity_created_at_idx on public.account_activity (created_at desc);
create index account_activity_account_idx on public.account_activity (account_id, created_at desc);
create index account_activity_actor_idx on public.account_activity (actor_id);

create unique index sales_one_active_per_account on public.sales (account_id) where voided_at is null;
create index sales_sold_at_idx on public.sales (sold_at desc) where voided_at is null;

create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Private helpers
-- -----------------------------------------------------------------------------
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'ADMIN' and p.is_active
  );
$$;

create or replace function private.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_active
  );
$$;

create or replace function private.require_active_user()
returns public.profiles
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.id is null then
    raise exception 'You must be signed in' using errcode = '28000';
  end if;
  if not v_profile.is_active then
    raise exception 'Your account has been disabled' using errcode = '42501';
  end if;
  return v_profile;
end;
$$;

create or replace function private.require_admin()
returns public.profiles
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles := private.require_active_user();
begin
  if v_profile.role <> 'ADMIN' then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  return v_profile;
end;
$$;

create or replace function private.is_ciphertext(p_value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_value ~ '^v1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$';
$$;

-- Validates normalised credential input. Passwords must already be encrypted.
create or replace function private.validate_credentials(
  p_login_email text,
  p_login_password_enc text,
  p_ptc_login text,
  p_ptc_password_enc text,
  p_require_password boolean
)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_login_email is null
     or char_length(p_login_email) > 254
     or p_login_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid login email' using errcode = 'P0001';
  end if;
  if p_require_password and p_login_password_enc is null then
    raise exception 'A password is required' using errcode = 'P0001';
  end if;
  if p_login_password_enc is not null and not private.is_ciphertext(p_login_password_enc) then
    raise exception 'Credentials must be encrypted before storage' using errcode = 'P0001';
  end if;
  if p_ptc_login is not null and (char_length(p_ptc_login) > 64 or p_ptc_login ~ '\s') then
    raise exception 'Enter a valid PTC login' using errcode = 'P0001';
  end if;
  if p_ptc_password_enc is not null and not private.is_ciphertext(p_ptc_password_enc) then
    raise exception 'Credentials must be encrypted before storage' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function private.log_activity(
  p_action public.activity_action,
  p_account_id bigint default null,
  p_details jsonb default '{}'::jsonb,
  p_target_user uuid default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.account_activity (account_id, account_ref, actor_id, target_user_id, action, details)
  values (p_account_id, p_account_id, auth.uid(), p_target_user, p_action, coalesce(p_details, '{}'::jsonb));
$$;

create or replace function private.notify(
  p_user uuid,
  p_account_id bigint,
  p_kind text,
  p_title text,
  p_body text
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, account_id, kind, title, body)
  select p_user, p_account_id, p_kind, p_title, p_body
  where p_user is not null and p_user is distinct from auth.uid();
$$;

-- Moves one account to a new status and applies every side effect:
-- review stamps, sale records, audit log and submitter notification.
create or replace function private.apply_status(
  p_account_id bigint,
  p_target public.account_status,
  p_price numeric default null,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acc public.accounts;
  v_actor uuid := auth.uid();
  v_action public.activity_action;
  v_label text := '#' || lpad(p_account_id::text, 3, '0');
  v_details jsonb;
begin
  select * into v_acc from public.accounts where id = p_account_id for update;
  if v_acc.id is null then
    raise exception 'Account not found' using errcode = 'P0002';
  end if;
  if v_acc.status = p_target then
    return;
  end if;

  if v_acc.status = 'SOLD' then
    update public.sales set voided_at = now(), voided_by = v_actor
    where account_id = v_acc.id and voided_at is null;
  end if;

  update public.accounts set
    status = p_target,
    approved_at = case when p_target in ('APPROVED', 'UNSOLD', 'SOLD') and approved_at is null then now() else approved_at end,
    approved_by = case when p_target in ('APPROVED', 'UNSOLD', 'SOLD') and approved_at is null then v_actor else approved_by end,
    rejected_at = case when p_target = 'REJECTED' then now() else rejected_at end,
    rejected_by = case when p_target = 'REJECTED' then v_actor else rejected_by end,
    sold_at = case when p_target = 'SOLD' then now() end,
    sold_by = case when p_target = 'SOLD' then v_actor end
  where id = v_acc.id;

  if p_target = 'SOLD' then
    insert into public.sales (account_id, sold_by, price) values (v_acc.id, v_actor, p_price);
  end if;

  v_action := case
    when p_target = 'SOLD' then 'MARKED_SOLD'
    when p_target = 'UNSOLD' and v_acc.status = 'SOLD' then 'MARKED_UNSOLD'
    when p_target in ('APPROVED', 'UNSOLD') and v_acc.status in ('PENDING', 'REJECTED') then 'APPROVED'
    when p_target = 'REJECTED' then 'REJECTED'
    else 'STATUS_CHANGED'
  end;

  v_details := jsonb_build_object('from', v_acc.status, 'to', p_target);
  if p_reason is not null then
    v_details := v_details || jsonb_build_object('reason', left(p_reason, 300));
  end if;
  perform private.log_activity(v_action, v_acc.id, v_details);

  if v_action = 'APPROVED' then
    perform private.notify(v_acc.submitter_id, v_acc.id, 'APPROVED',
      'Account ' || v_label || ' approved',
      'Your submission passed review and is now in the inventory.');
  elsif v_action = 'REJECTED' then
    perform private.notify(v_acc.submitter_id, v_acc.id, 'REJECTED',
      'Account ' || v_label || ' rejected',
      coalesce('Reason: ' || left(p_reason, 300), 'Your submission did not pass review.'));
  elsif v_action = 'MARKED_SOLD' then
    perform private.notify(v_acc.submitter_id, v_acc.id, 'SOLD',
      'Account ' || v_label || ' sold',
      'An account you submitted has been marked as sold.');
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger accounts_touch_updated_at
  before update on public.accounts
  for each row execute function private.touch_updated_at();

create trigger account_credentials_touch_updated_at
  before update on public.account_credentials
  for each row execute function private.touch_updated_at();

-- Never allow the last active admin to disappear (demotion, disable or delete).
create or replace function private.guard_profiles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.updated_at := now();
    if old.role = 'ADMIN' and old.is_active and not (new.role = 'ADMIN' and new.is_active) then
      perform pg_advisory_xact_lock(7316001);
      if not exists (
        select 1 from public.profiles p
        where p.id <> old.id and p.role = 'ADMIN' and p.is_active
      ) then
        raise exception 'At least one active admin is required' using errcode = 'P0001';
      end if;
    end if;
    return new;
  end if;

  if old.role = 'ADMIN' and old.is_active then
    perform pg_advisory_xact_lock(7316001);
    if not exists (
      select 1 from public.profiles p
      where p.id <> old.id and p.role = 'ADMIN' and p.is_active
    ) then
      raise exception 'At least one active admin is required' using errcode = 'P0001';
    end if;
  end if;
  return old;
end;
$$;

create trigger profiles_guard
  before update or delete on public.profiles
  for each row execute function private.guard_profiles();

-- Every new auth user gets a SUBMITTER profile. Roles are never taken from
-- user-supplied metadata; admins are promoted explicitly.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    left(btrim(coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(new.email, ''), '@', 1))), 80)
  );
  insert into public.account_activity (actor_id, target_user_id, action)
  values (new.id, new.id, 'USER_REGISTERED');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, email) where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function private.handle_user_email_change();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.account_credentials enable row level security;
alter table public.account_activity enable row level security;
alter table public.sales enable row level security;
alter table public.notifications enable row level security;

create policy "profiles: self or admin can read"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));

create policy "accounts: admins read all, submitters read their own"
  on public.accounts for select to authenticated
  using (
    (select private.is_admin())
    or (submitter_id = (select auth.uid()) and (select private.is_active_user()))
  );

create policy "account_credentials: follows account visibility"
  on public.account_credentials for select to authenticated
  using (
    (select private.is_admin())
    or exists (
      select 1 from public.accounts a
      where a.id = account_credentials.account_id
        and a.submitter_id = (select auth.uid())
        and (select private.is_active_user())
    )
  );

create policy "account_activity: admins read all, submitters read their account history"
  on public.account_activity for select to authenticated
  using (
    (select private.is_admin())
    or (
      action in ('CREATED', 'SUBMITTED', 'EDITED', 'TYPE_CHANGED', 'STATUS_CHANGED', 'APPROVED',
                 'REJECTED', 'MARKED_SOLD', 'MARKED_UNSOLD', 'CREDENTIALS_UPDATED')
      and (select private.is_active_user())
      and exists (
        select 1 from public.accounts a
        where a.id = account_activity.account_id and a.submitter_id = (select auth.uid())
      )
    )
  );

create policy "sales: admins only"
  on public.sales for select to authenticated
  using ((select private.is_admin()));

create policy "notifications: owner only"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

-- =============================================================================
-- Mutations (SECURITY DEFINER — each one authorises the caller explicitly)
-- =============================================================================

create or replace function public.submit_account(
  p_type public.account_type,
  p_login_email text,
  p_login_password_enc text,
  p_ptc_login text default null,
  p_ptc_password_enc text default null,
  p_notes text default null,
  p_auto_approve boolean default false
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles := private.require_active_user();
  v_is_admin boolean := v_profile.role = 'ADMIN';
  v_email text := lower(btrim(p_login_email));
  v_ptc text := nullif(btrim(p_ptc_login), '');
  v_ptc_pw text := case when nullif(btrim(p_ptc_login), '') is null then null else p_ptc_password_enc end;
  v_id bigint;
begin
  perform private.validate_credentials(v_email, p_login_password_enc, v_ptc, v_ptc_pw, true);
  if v_ptc is not null and v_ptc_pw is null then
    raise exception 'A PTC password is required when a PTC login is provided' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.account_credentials c where lower(c.login_email) = v_email) then
    raise exception 'An account with this login email already exists' using errcode = 'P0001';
  end if;

  insert into public.accounts (submitter_id, type, notes)
  values (v_profile.id, p_type, nullif(left(btrim(p_notes), 1000), ''))
  returning id into v_id;

  insert into public.account_credentials (account_id, login_email, login_password_enc, ptc_login, ptc_password_enc)
  values (v_id, v_email, p_login_password_enc, v_ptc, v_ptc_pw);

  perform private.log_activity(
    case when v_is_admin then 'CREATED'::public.activity_action else 'SUBMITTED'::public.activity_action end,
    v_id,
    jsonb_build_object('type', p_type)
  );

  if v_is_admin and coalesce(p_auto_approve, false) then
    perform private.apply_status(v_id, 'UNSOLD');
  end if;

  return v_id;
exception
  when unique_violation then
    raise exception 'An account with this login email already exists' using errcode = 'P0001';
end;
$$;

create or replace function public.update_account(
  p_account_id bigint,
  p_type public.account_type,
  p_login_email text,
  p_login_password_enc text default null, -- null keeps the stored password
  p_ptc_login text default null,          -- null/empty removes PTC credentials
  p_ptc_password_enc text default null,   -- null keeps the stored PTC password
  p_notes text default null,
  p_status public.account_status default null -- admin only; null keeps status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles := private.require_active_user();
  v_is_admin boolean := v_profile.role = 'ADMIN';
  v_acc public.accounts;
  v_cred public.account_credentials;
  v_email text := lower(btrim(p_login_email));
  v_ptc text := nullif(btrim(p_ptc_login), '');
  v_ptc_pw text;
  v_notes text := nullif(left(btrim(p_notes), 1000), '');
  v_changed text[] := '{}';
  v_touched boolean := false;
begin
  select * into v_acc from public.accounts where id = p_account_id for update;
  if v_acc.id is null or (not v_is_admin and v_acc.submitter_id is distinct from v_profile.id) then
    raise exception 'Account not found' using errcode = 'P0002';
  end if;
  if not v_is_admin and v_acc.status <> 'PENDING' then
    raise exception 'Only pending submissions can be edited' using errcode = 'P0001';
  end if;
  if not v_is_admin and p_status is not null and p_status <> v_acc.status then
    raise exception 'Only admins can change the account status' using errcode = '42501';
  end if;

  select * into v_cred from public.account_credentials where account_id = v_acc.id for update;

  v_ptc_pw := case when v_ptc is null then null else coalesce(p_ptc_password_enc, v_cred.ptc_password_enc) end;
  perform private.validate_credentials(v_email, p_login_password_enc, v_ptc, v_ptc_pw, false);
  if v_ptc is not null and v_ptc_pw is null then
    raise exception 'A PTC password is required when a PTC login is provided' using errcode = 'P0001';
  end if;
  if v_email is distinct from lower(v_cred.login_email) and exists (
    select 1 from public.account_credentials c
    where lower(c.login_email) = v_email and c.account_id <> v_acc.id
  ) then
    raise exception 'Another account already uses this login email' using errcode = 'P0001';
  end if;

  if v_email is distinct from v_cred.login_email then v_changed := array_append(v_changed, 'login_email'); end if;
  if p_login_password_enc is not null then v_changed := array_append(v_changed, 'login_password'); end if;
  if v_ptc is distinct from v_cred.ptc_login then v_changed := array_append(v_changed, 'ptc_login'); end if;
  if v_ptc_pw is distinct from v_cred.ptc_password_enc then v_changed := array_append(v_changed, 'ptc_password'); end if;

  if cardinality(v_changed) > 0 then
    update public.account_credentials set
      login_email = v_email,
      login_password_enc = coalesce(p_login_password_enc, login_password_enc),
      ptc_login = v_ptc,
      ptc_password_enc = v_ptc_pw
    where account_id = v_acc.id;
    perform private.log_activity('CREDENTIALS_UPDATED', v_acc.id, jsonb_build_object('fields', to_jsonb(v_changed)));
    v_touched := true;
  end if;

  if p_type is distinct from v_acc.type then
    update public.accounts set type = p_type where id = v_acc.id;
    perform private.log_activity('TYPE_CHANGED', v_acc.id, jsonb_build_object('from', v_acc.type, 'to', p_type));
    v_touched := true;
  end if;

  if v_notes is distinct from v_acc.notes then
    update public.accounts set notes = v_notes where id = v_acc.id;
    perform private.log_activity('EDITED', v_acc.id, jsonb_build_object('fields', jsonb_build_array('notes')));
    v_touched := true;
  end if;

  if v_is_admin and p_status is not null and p_status <> v_acc.status then
    perform private.apply_status(v_acc.id, p_status);
    v_touched := true;
  end if;

  if v_touched then
    update public.accounts set updated_at = now() where id = v_acc.id;
  end if;
exception
  when unique_violation then
    raise exception 'Another account already uses this login email' using errcode = 'P0001';
end;
$$;

create or replace function public.set_account_status(
  p_account_ids bigint[],
  p_action text,
  p_price numeric default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.account_status;
  v_allowed public.account_status[];
  v_acc record;
  v_requested int;
  v_updated int := 0;
begin
  perform private.require_admin();
  v_requested := coalesce(cardinality(array(select distinct unnest(p_account_ids))), 0);
  if v_requested = 0 then
    raise exception 'Select at least one account' using errcode = 'P0001';
  end if;
  if v_requested > 500 then
    raise exception 'You can update at most 500 accounts at once' using errcode = 'P0001';
  end if;
  if p_price is not null and (p_price < 0 or p_price > 1000000) then
    raise exception 'Enter a valid sale price' using errcode = 'P0001';
  end if;

  case p_action
    when 'APPROVE' then
      v_target := 'UNSOLD';
      v_allowed := array['PENDING', 'REJECTED']::public.account_status[];
    when 'REJECT' then
      v_target := 'REJECTED';
      v_allowed := array['PENDING', 'APPROVED', 'UNSOLD']::public.account_status[];
    when 'MARK_SOLD' then
      v_target := 'SOLD';
      v_allowed := array['APPROVED', 'UNSOLD']::public.account_status[];
    when 'MARK_UNSOLD' then
      v_target := 'UNSOLD';
      v_allowed := array['APPROVED', 'SOLD']::public.account_status[];
    else
      raise exception 'Unknown action' using errcode = 'P0001';
  end case;

  for v_acc in
    select id, status from public.accounts where id = any(p_account_ids) order by id for update
  loop
    if v_acc.status = any(v_allowed) then
      perform private.apply_status(
        v_acc.id,
        v_target,
        case when v_target = 'SOLD' then p_price end,
        nullif(btrim(p_reason), '')
      );
      v_updated := v_updated + 1;
    end if;
  end loop;

  return jsonb_build_object('updated', v_updated, 'skipped', v_requested - v_updated);
end;
$$;

create or replace function public.set_account_type(p_account_ids bigint[], p_type public.account_type)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acc record;
  v_updated int := 0;
begin
  perform private.require_admin();
  if coalesce(cardinality(p_account_ids), 0) = 0 then
    raise exception 'Select at least one account' using errcode = 'P0001';
  end if;
  if cardinality(p_account_ids) > 500 then
    raise exception 'You can update at most 500 accounts at once' using errcode = 'P0001';
  end if;
  for v_acc in
    select id, type from public.accounts where id = any(p_account_ids) and type <> p_type order by id for update
  loop
    update public.accounts set type = p_type where id = v_acc.id;
    perform private.log_activity('TYPE_CHANGED', v_acc.id, jsonb_build_object('from', v_acc.type, 'to', p_type));
    v_updated := v_updated + 1;
  end loop;
  return jsonb_build_object('updated', v_updated);
end;
$$;

-- Admins can delete anything; submitters can withdraw their own pending submissions.
create or replace function public.delete_accounts(p_account_ids bigint[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles := private.require_active_user();
  v_acc public.accounts;
  v_deleted int := 0;
begin
  if coalesce(cardinality(p_account_ids), 0) = 0 then
    raise exception 'Select at least one account' using errcode = 'P0001';
  end if;
  if cardinality(p_account_ids) > 500 then
    raise exception 'You can delete at most 500 accounts at once' using errcode = 'P0001';
  end if;
  for v_acc in
    select * from public.accounts where id = any(p_account_ids) order by id for update
  loop
    if v_profile.role = 'ADMIN' or (v_acc.submitter_id = v_profile.id and v_acc.status = 'PENDING') then
      perform private.log_activity('DELETED', v_acc.id, jsonb_build_object('type', v_acc.type, 'status', v_acc.status));
      delete from public.accounts where id = v_acc.id;
      v_deleted := v_deleted + 1;
    end if;
  end loop;
  if v_deleted = 0 then
    raise exception 'No accounts could be deleted' using errcode = 'P0001';
  end if;
  return jsonb_build_object('deleted', v_deleted);
end;
$$;

-- Returns ONE encrypted secret to an admin and records that it was revealed.
-- Decryption happens in the application server; the key never touches the DB.
create or replace function public.admin_get_account_secret(p_account_id bigint, p_field text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enc text;
begin
  perform private.require_admin();
  if p_field not in ('login_password', 'ptc_password') then
    raise exception 'Unknown credential field' using errcode = 'P0001';
  end if;
  select case when p_field = 'login_password' then c.login_password_enc else c.ptc_password_enc end
    into v_enc
  from public.account_credentials c
  where c.account_id = p_account_id;
  if not found then
    raise exception 'Account not found' using errcode = 'P0002';
  end if;
  perform private.log_activity('CREDENTIALS_REVEALED', p_account_id, jsonb_build_object('field', p_field));
  return v_enc;
end;
$$;

create or replace function public.admin_export_accounts(p_account_ids bigint[], p_include_secrets boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows jsonb;
begin
  perform private.require_admin();
  if coalesce(cardinality(p_account_ids), 0) > 5000 then
    raise exception 'You can export at most 5000 accounts at once' using errcode = 'P0001';
  end if;
  select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'type', a.type,
        'status', a.status,
        'login_email', c.login_email,
        'ptc_login', c.ptc_login,
        'submitter_name', p.full_name,
        'submitter_email', p.email,
        'notes', a.notes,
        'created_at', a.created_at,
        'approved_at', a.approved_at,
        'sold_at', a.sold_at
      ) || case when coalesce(p_include_secrets, false) then jsonb_build_object(
        'login_password_enc', c.login_password_enc,
        'ptc_password_enc', c.ptc_password_enc
      ) else '{}'::jsonb end
      order by a.id
    ), '[]'::jsonb)
    into v_rows
  from public.accounts a
  join public.account_credentials c on c.account_id = a.id
  left join public.profiles p on p.id = a.submitter_id
  where a.id = any(coalesce(p_account_ids, '{}'));

  perform private.log_activity('EXPORTED', null, jsonb_build_object(
    'count', jsonb_array_length(v_rows),
    'with_passwords', coalesce(p_include_secrets, false)
  ));
  return v_rows;
end;
$$;

-- Bulk import. Each row: { type, login_email, login_password_enc, ptc_login, ptc_password_enc, notes }.
create or replace function public.admin_import_accounts(p_rows jsonb, p_approve boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin public.profiles := private.require_admin();
  v_row jsonb;
  v_i int;
  v_id bigint;
  v_email text;
  v_ptc text;
  v_ptc_pw text;
  v_inserted int := 0;
  v_errors jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'Invalid import payload' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_rows) > 1000 then
    raise exception 'You can import at most 1000 accounts at once' using errcode = 'P0001';
  end if;

  for v_i in 0 .. jsonb_array_length(p_rows) - 1 loop
    v_row := p_rows -> v_i;
    begin
      v_email := lower(btrim(v_row ->> 'login_email'));
      v_ptc := nullif(btrim(v_row ->> 'ptc_login'), '');
      v_ptc_pw := case when v_ptc is null then null else nullif(v_row ->> 'ptc_password_enc', '') end;
      perform private.validate_credentials(v_email, nullif(v_row ->> 'login_password_enc', ''), v_ptc, v_ptc_pw, true);
      if v_ptc is not null and v_ptc_pw is null then
        raise exception 'PTC password missing' using errcode = 'P0001';
      end if;
      if exists (select 1 from public.account_credentials c where lower(c.login_email) = v_email) then
        raise exception 'Duplicate login email' using errcode = 'P0001';
      end if;

      insert into public.accounts (submitter_id, type, notes)
      values (v_admin.id, coalesce(nullif(v_row ->> 'type', ''), 'NEW')::public.account_type,
              nullif(left(btrim(v_row ->> 'notes'), 1000), ''))
      returning id into v_id;
      insert into public.account_credentials (account_id, login_email, login_password_enc, ptc_login, ptc_password_enc)
      values (v_id, v_email, v_row ->> 'login_password_enc', v_ptc, v_ptc_pw);
      perform private.log_activity('IMPORTED', v_id, jsonb_build_object('type', v_row ->> 'type'));
      if coalesce(p_approve, false) then
        perform private.apply_status(v_id, 'UNSOLD');
      end if;
      v_inserted := v_inserted + 1;
    exception
      when others then
        if jsonb_array_length(v_errors) < 50 then
          v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_i + 1, 'message', sqlerrm));
        end if;
    end;
  end loop;

  return jsonb_build_object(
    'inserted', v_inserted,
    'failed', jsonb_array_length(p_rows) - v_inserted,
    'errors', v_errors
  );
end;
$$;

create or replace function public.admin_set_user_role(p_user_id uuid, p_role public.user_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.profiles;
begin
  perform private.require_admin();
  select * into v_target from public.profiles where id = p_user_id for update;
  if v_target.id is null then
    raise exception 'User not found' using errcode = 'P0002';
  end if;
  if v_target.role = p_role then
    return;
  end if;
  update public.profiles set role = p_role where id = p_user_id;
  perform private.log_activity('USER_ROLE_CHANGED', null,
    jsonb_build_object('from', v_target.role, 'to', p_role), p_user_id);
end;
$$;

create or replace function public.admin_set_user_active(p_user_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin public.profiles := private.require_admin();
  v_target public.profiles;
begin
  if p_user_id = v_admin.id and not p_active then
    raise exception 'You cannot disable your own account' using errcode = 'P0001';
  end if;
  select * into v_target from public.profiles where id = p_user_id for update;
  if v_target.id is null then
    raise exception 'User not found' using errcode = 'P0002';
  end if;
  if v_target.is_active = p_active then
    return;
  end if;
  update public.profiles set is_active = p_active where id = p_user_id;
  perform private.log_activity(
    case when p_active then 'USER_ENABLED'::public.activity_action else 'USER_DISABLED'::public.activity_action end,
    null, '{}'::jsonb, p_user_id);
end;
$$;

create or replace function public.update_my_profile(p_full_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles := private.require_active_user();
  v_name text := btrim(p_full_name);
begin
  if v_name is null or char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'Name must be between 2 and 80 characters' using errcode = 'P0001';
  end if;
  update public.profiles set full_name = v_name where id = v_profile.id;
end;
$$;

create or replace function public.mark_notifications_read(p_ids bigint[] default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_active_user();
  update public.notifications set read_at = now()
  where user_id = auth.uid() and read_at is null and (p_ids is null or id = any(p_ids));
end;
$$;

-- =============================================================================
-- Queries (SECURITY INVOKER — RLS scopes every result to the caller)
-- =============================================================================

create or replace function public.get_my_profile()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select to_jsonb(p) from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.list_accounts(
  p_search text default null,
  p_type public.account_type default null,
  p_status public.account_status default null,
  p_submitter_id uuid default null,
  p_date_from date default null,
  p_date_to date default null,
  p_date_field text default 'created_at',
  p_sort text default 'created_at',
  p_dir text default 'desc',
  p_page integer default 1,
  p_page_size integer default 20
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select
      nullif(btrim(p_search), '') as q,
      case when btrim(coalesce(p_search, '')) ~ '^#?[0-9]{1,15}$'
           then ltrim(btrim(p_search), '#')::bigint end as q_id,
      '%' || replace(replace(replace(btrim(coalesce(p_search, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%' as q_like,
      least(greatest(coalesce(p_page_size, 20), 1), 5000) as lim,
      greatest(coalesce(p_page, 1), 1) as pg,
      p_date_field = 'sold_at' as by_sold,
      lower(coalesce(p_dir, 'desc')) = 'asc' as asc_dir,
      coalesce(p_sort, 'created_at') as sort_key
  ),
  filtered as (
    select
      a.id, a.type, a.status, a.notes, a.created_at, a.updated_at, a.approved_at, a.sold_at,
      a.submitter_id, p.full_name as submitter_name, p.email as submitter_email,
      c.login_email, c.ptc_login, s.price as sale_price
    from public.accounts a
    cross join params x
    left join public.account_credentials c on c.account_id = a.id
    left join public.profiles p on p.id = a.submitter_id
    left join public.sales s on s.account_id = a.id and s.voided_at is null
    where (p_type is null or a.type = p_type)
      and (p_status is null or a.status = p_status)
      and (p_submitter_id is null or a.submitter_id = p_submitter_id)
      and (p_date_from is null
           or (case when x.by_sold then a.sold_at else a.created_at end) >= p_date_from::timestamptz)
      and (p_date_to is null
           or (case when x.by_sold then a.sold_at else a.created_at end) < (p_date_to + 1)::timestamptz)
      and (x.q is null
           or a.id = x.q_id
           or c.login_email ilike x.q_like
           or c.ptc_login ilike x.q_like
           or p.full_name ilike x.q_like
           or p.email ilike x.q_like)
  ),
  ranked as (
    select f.*, row_number() over (
      order by
        case when x.sort_key = 'id' and x.asc_dir then f.id end asc,
        case when x.sort_key = 'id' and not x.asc_dir then f.id end desc,
        case when x.sort_key = 'created_at' and x.asc_dir then f.created_at end asc,
        case when x.sort_key = 'created_at' and not x.asc_dir then f.created_at end desc,
        case when x.sort_key = 'updated_at' and x.asc_dir then f.updated_at end asc,
        case when x.sort_key = 'updated_at' and not x.asc_dir then f.updated_at end desc,
        case when x.sort_key = 'sold_at' and x.asc_dir then f.sold_at end asc nulls last,
        case when x.sort_key = 'sold_at' and not x.asc_dir then f.sold_at end desc nulls last,
        case when x.sort_key = 'type' and x.asc_dir then f.type end asc,
        case when x.sort_key = 'type' and not x.asc_dir then f.type end desc,
        case when x.sort_key = 'status' and x.asc_dir then f.status end asc,
        case when x.sort_key = 'status' and not x.asc_dir then f.status end desc,
        case when x.sort_key = 'login_email' and x.asc_dir then lower(f.login_email) end asc,
        case when x.sort_key = 'login_email' and not x.asc_dir then lower(f.login_email) end desc,
        case when x.sort_key = 'submitter' and x.asc_dir then lower(f.submitter_name) end asc,
        case when x.sort_key = 'submitter' and not x.asc_dir then lower(f.submitter_name) end desc,
        f.id desc
    ) as rn
    from filtered f
    cross join params x
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'page', x.pg,
    'page_size', x.lim,
    'rows', coalesce((
      select jsonb_agg(to_jsonb(r) - 'rn' order by r.rn)
      from ranked r
      where r.rn > (x.pg - 1) * x.lim and r.rn <= x.pg * x.lim
    ), '[]'::jsonb)
  )
  from params x;
$$;

create or replace function public.account_stats()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'total', count(*),
    'new', count(*) filter (where type = 'NEW'),
    'bot', count(*) filter (where type = 'BOT'),
    'old', count(*) filter (where type = 'OLD'),
    'pending', count(*) filter (where status = 'PENDING'),
    'approved', count(*) filter (where status = 'APPROVED'),
    'unsold', count(*) filter (where status = 'UNSOLD'),
    'sold', count(*) filter (where status = 'SOLD'),
    'rejected', count(*) filter (where status = 'REJECTED'),
    'reviewed', count(*) filter (where approved_at is not null and status in ('APPROVED', 'UNSOLD', 'SOLD')),
    'sold_this_month', count(*) filter (where status = 'SOLD' and sold_at >= date_trunc('month', now())),
    'added_this_week', count(*) filter (where created_at >= now() - interval '7 days')
  )
  from public.accounts;
$$;

create or replace function public.get_account_detail(p_account_id bigint)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'id', a.id,
    'type', a.type,
    'status', a.status,
    'notes', a.notes,
    'created_at', a.created_at,
    'updated_at', a.updated_at,
    'approved_at', a.approved_at,
    'rejected_at', a.rejected_at,
    'sold_at', a.sold_at,
    'submitter_id', a.submitter_id,
    'submitter_name', sp.full_name,
    'submitter_email', sp.email,
    'approved_by_name', ab.full_name,
    'rejected_by_name', rb.full_name,
    'sold_by_name', sb.full_name,
    'login_email', c.login_email,
    'ptc_login', c.ptc_login,
    'credentials_updated_at', c.updated_at,
    'sale_price', (select s.price from public.sales s where s.account_id = a.id and s.voided_at is null limit 1),
    'activity', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', e.id,
          'action', e.action,
          'details', e.details,
          'created_at', e.created_at,
          'actor_id', e.actor_id,
          'actor_name', ap.full_name,
          'actor_role', ap.role
        ) order by e.created_at desc, e.id desc)
      from public.account_activity e
      left join public.profiles ap on ap.id = e.actor_id
      where e.account_id = a.id
    ), '[]'::jsonb)
  )
  from public.accounts a
  left join public.account_credentials c on c.account_id = a.id
  left join public.profiles sp on sp.id = a.submitter_id
  left join public.profiles ab on ab.id = a.approved_by
  left join public.profiles rb on rb.id = a.rejected_by
  left join public.profiles sb on sb.id = a.sold_by
  where a.id = p_account_id;
$$;

create or replace function public.list_activity(
  p_search text default null,
  p_action public.activity_action default null,
  p_date_from date default null,
  p_date_to date default null,
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_q text := nullif(btrim(p_search), '');
  v_q_id bigint := case when btrim(coalesce(p_search, '')) ~ '^#?[0-9]{1,15}$' then ltrim(btrim(p_search), '#')::bigint end;
  v_like text := '%' || replace(replace(replace(btrim(coalesce(p_search, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  v_lim int := least(greatest(coalesce(p_page_size, 25), 1), 200);
  v_pg int := greatest(coalesce(p_page, 1), 1);
begin
  if not private.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  return (
    with filtered as (
      select e.*, ap.full_name as actor_name, ap.email as actor_email, ap.role as actor_role,
             tp.full_name as target_name, tp.email as target_email
      from public.account_activity e
      left join public.profiles ap on ap.id = e.actor_id
      left join public.profiles tp on tp.id = e.target_user_id
      where (p_action is null or e.action = p_action)
        and (p_date_from is null or e.created_at >= p_date_from::timestamptz)
        and (p_date_to is null or e.created_at < (p_date_to + 1)::timestamptz)
        and (v_q is null
             or e.account_ref = v_q_id
             or ap.full_name ilike v_like or ap.email ilike v_like
             or tp.full_name ilike v_like or tp.email ilike v_like)
    )
    select jsonb_build_object(
      'total', (select count(*) from filtered),
      'page', v_pg,
      'page_size', v_lim,
      'rows', coalesce((
        select jsonb_agg(jsonb_build_object(
            'id', f.id,
            'action', f.action,
            'details', f.details,
            'created_at', f.created_at,
            'account_ref', f.account_ref,
            'account_exists', f.account_id is not null,
            'actor_id', f.actor_id,
            'actor_name', f.actor_name,
            'actor_email', f.actor_email,
            'actor_role', f.actor_role,
            'target_user_id', f.target_user_id,
            'target_name', f.target_name,
            'target_email', f.target_email
          ) order by f.created_at desc, f.id desc)
        from (
          select * from filtered
          order by created_at desc, id desc
          limit v_lim offset (v_pg - 1) * v_lim
        ) f
      ), '[]'::jsonb)
    )
  );
end;
$$;

-- A submitter's own submission history (RLS hides admin-only events).
create or replace function public.list_my_activity(p_page integer default 1, p_page_size integer default 25)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select least(greatest(coalesce(p_page_size, 25), 1), 200) as lim, greatest(coalesce(p_page, 1), 1) as pg
  ),
  filtered as (
    select e.*, ap.full_name as actor_name
    from public.account_activity e
    join public.accounts a on a.id = e.account_id
    left join public.profiles ap on ap.id = e.actor_id
    where a.submitter_id = auth.uid()
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'page', x.pg,
    'page_size', x.lim,
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', f.id,
          'action', f.action,
          'details', f.details,
          'created_at', f.created_at,
          'account_ref', f.account_ref,
          'account_exists', true,
          'actor_id', f.actor_id,
          'actor_name', f.actor_name
        ) order by f.created_at desc, f.id desc)
      from (
        select * from filtered order by created_at desc, id desc
        limit x.lim offset (x.pg - 1) * x.lim
      ) f
    ), '[]'::jsonb)
  )
  from params x;
$$;

create or replace function public.list_users(
  p_search text default null,
  p_role public.user_role default null,
  p_active boolean default null,
  p_page integer default 1,
  p_page_size integer default 20
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_q text := nullif(btrim(p_search), '');
  v_like text := '%' || replace(replace(replace(btrim(coalesce(p_search, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  v_lim int := least(greatest(coalesce(p_page_size, 20), 1), 200);
  v_pg int := greatest(coalesce(p_page, 1), 1);
begin
  if not private.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  return (
    with filtered as (
      select p.*
      from public.profiles p
      where (p_role is null or p.role = p_role)
        and (p_active is null or p.is_active = p_active)
        and (v_q is null or p.full_name ilike v_like or p.email ilike v_like)
    )
    select jsonb_build_object(
      'total', (select count(*) from filtered),
      'page', v_pg,
      'page_size', v_lim,
      'active_admins', (select count(*) from public.profiles where role = 'ADMIN' and is_active),
      'rows', coalesce((
        select jsonb_agg(jsonb_build_object(
            'id', u.id,
            'email', u.email,
            'full_name', u.full_name,
            'role', u.role,
            'is_active', u.is_active,
            'created_at', u.created_at,
            'accounts_total', coalesce(st.total, 0),
            'accounts_pending', coalesce(st.pending, 0),
            'accounts_sold', coalesce(st.sold, 0),
            'last_submission_at', st.last_at
          ) order by u.created_at desc, u.id)
        from (
          select * from filtered order by created_at desc, id
          limit v_lim offset (v_pg - 1) * v_lim
        ) u
        left join lateral (
          select count(*) as total,
                 count(*) filter (where a.status = 'PENDING') as pending,
                 count(*) filter (where a.status = 'SOLD') as sold,
                 max(a.created_at) as last_at
          from public.accounts a where a.submitter_id = u.id
        ) st on true
      ), '[]'::jsonb)
    )
  );
end;
$$;

create or replace function public.get_user_summary(p_user_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'id', p.id,
      'email', p.email,
      'full_name', p.full_name,
      'role', p.role,
      'is_active', p.is_active,
      'created_at', p.created_at,
      'accounts_total', (select count(*) from public.accounts a where a.submitter_id = p.id),
      'accounts_pending', (select count(*) from public.accounts a where a.submitter_id = p.id and a.status = 'PENDING'),
      'accounts_unsold', (select count(*) from public.accounts a where a.submitter_id = p.id and a.status = 'UNSOLD'),
      'accounts_sold', (select count(*) from public.accounts a where a.submitter_id = p.id and a.status = 'SOLD'),
      'accounts_rejected', (select count(*) from public.accounts a where a.submitter_id = p.id and a.status = 'REJECTED')
    )
    from public.profiles p
    where p.id = p_user_id
  );
end;
$$;

create or replace function public.list_submitters()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name, 'email', p.email, 'role', p.role)
                     order by lower(p.full_name), p.email)
    from public.profiles p
    where exists (select 1 from public.accounts a where a.submitter_id = p.id) or p.role = 'SUBMITTER'
  ), '[]'::jsonb);
end;
$$;

create or replace function public.sales_overview(p_date_from date default null, p_date_to date default null)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'total_sold', (select count(*) from public.accounts where status = 'SOLD'),
    'total_unsold', (select count(*) from public.accounts where status = 'UNSOLD'),
    'available', (select count(*) from public.accounts where status in ('UNSOLD', 'APPROVED')),
    'sold_this_month', (select count(*) from public.accounts where status = 'SOLD' and sold_at >= date_trunc('month', now())),
    'sold_in_range', (
      select count(*) from public.accounts
      where status = 'SOLD'
        and (p_date_from is null or sold_at >= p_date_from::timestamptz)
        and (p_date_to is null or sold_at < (p_date_to + 1)::timestamptz)
    ),
    'revenue_total', (select coalesce(sum(price), 0) from public.sales where voided_at is null),
    'revenue_this_month', (
      select coalesce(sum(price), 0) from public.sales
      where voided_at is null and sold_at >= date_trunc('month', now())
    ),
    'sold_by_type', jsonb_build_object(
      'NEW', (select count(*) from public.accounts where status = 'SOLD' and type = 'NEW'),
      'BOT', (select count(*) from public.accounts where status = 'SOLD' and type = 'BOT'),
      'OLD', (select count(*) from public.accounts where status = 'SOLD' and type = 'OLD')
    ),
    'monthly', (
      select jsonb_agg(jsonb_build_object(
          'month', to_char(m.month, 'YYYY-MM'),
          'count', coalesce(agg.cnt, 0),
          'revenue', coalesce(agg.revenue, 0)
        ) order by m.month)
      from generate_series(
        date_trunc('month', now()) - interval '11 months',
        date_trunc('month', now()),
        interval '1 month'
      ) as m(month)
      left join (
        select date_trunc('month', s.sold_at) as month, count(*) as cnt, sum(s.price) as revenue
        from public.sales s
        where s.voided_at is null
        group by 1
      ) agg on agg.month = m.month
    )
  );
end;
$$;

create or replace function public.list_notifications(p_limit integer default 10)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'unread', (select count(*) from public.notifications n where n.user_id = auth.uid() and n.read_at is null),
    'rows', coalesce((
      select jsonb_agg(to_jsonb(n) order by n.created_at desc)
      from (
        select id, account_id, kind, title, body, read_at, created_at
        from public.notifications
        where user_id = auth.uid()
        order by created_at desc
        limit least(greatest(coalesce(p_limit, 10), 1), 50)
      ) n
    ), '[]'::jsonb)
  );
$$;

-- =============================================================================
-- Privileges
-- =============================================================================

-- Tables: read-only for signed-in users (RLS filters rows), nothing for anon.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles, public.accounts, public.account_activity, public.sales, public.notifications
  to authenticated;
-- Credential ciphertext is never selectable by API users — only these columns.
grant select (account_id, login_email, ptc_login, created_at, updated_at)
  on public.account_credentials to authenticated;

-- Functions: callable by signed-in users only. Each one re-checks the role.
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;

revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_active_user() to authenticated;
