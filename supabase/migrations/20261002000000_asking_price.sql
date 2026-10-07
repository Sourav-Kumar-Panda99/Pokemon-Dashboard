-- =============================================================================
-- Asking price for NEW ID submissions
--
-- Submitters must state an asking price when they submit a NEW ID (optional for
-- admins). Other account types never carry an asking price.
-- =============================================================================

alter table public.accounts
  add column asking_price numeric(10, 2)
  check (asking_price is null or (asking_price >= 0 and asking_price <= 1000000));

-- Signatures change, so drop the old versions instead of overloading them.
drop function if exists public.submit_account(public.account_type, text, text, text, text, text, boolean);
drop function if exists public.update_account(bigint, public.account_type, text, text, text, text, text, public.account_status);

create or replace function private.normalize_asking_price(
  p_type public.account_type,
  p_price numeric,
  p_is_admin boolean
)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_type <> 'NEW' then
    return null;
  end if;
  if p_price is not null and (p_price < 0 or p_price > 1000000) then
    raise exception 'Enter a valid asking price' using errcode = 'P0001';
  end if;
  if p_price is null and not p_is_admin then
    raise exception 'Enter your asking price for this new account' using errcode = 'P0001';
  end if;
  return round(p_price, 2);
end;
$$;

create or replace function public.submit_account(
  p_type public.account_type,
  p_login_email text,
  p_login_password_enc text,
  p_ptc_login text default null,
  p_ptc_password_enc text default null,
  p_notes text default null,
  p_auto_approve boolean default false,
  p_asking_price numeric default null
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
  v_price numeric := private.normalize_asking_price(p_type, p_asking_price, v_is_admin);
  v_id bigint;
begin
  perform private.validate_credentials(v_email, p_login_password_enc, v_ptc, v_ptc_pw, true);
  if v_ptc is not null and v_ptc_pw is null then
    raise exception 'A PTC password is required when a PTC login is provided' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.account_credentials c where lower(c.login_email) = v_email) then
    raise exception 'An account with this login email already exists' using errcode = 'P0001';
  end if;

  insert into public.accounts (submitter_id, type, notes, asking_price)
  values (v_profile.id, p_type, nullif(left(btrim(p_notes), 1000), ''), v_price)
  returning id into v_id;

  insert into public.account_credentials (account_id, login_email, login_password_enc, ptc_login, ptc_password_enc)
  values (v_id, v_email, p_login_password_enc, v_ptc, v_ptc_pw);

  perform private.log_activity(
    case when v_is_admin then 'CREATED'::public.activity_action else 'SUBMITTED'::public.activity_action end,
    v_id,
    jsonb_build_object('type', p_type) || case when v_price is not null then jsonb_build_object('asking_price', v_price) else '{}'::jsonb end
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
  p_login_password_enc text default null,
  p_ptc_login text default null,
  p_ptc_password_enc text default null,
  p_notes text default null,
  p_status public.account_status default null,
  p_asking_price numeric default null
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
  v_price numeric;
  v_changed text[] := '{}';
  v_edited text[] := '{}';
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

  v_price := private.normalize_asking_price(p_type, p_asking_price, v_is_admin);

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
    v_edited := array_append(v_edited, 'notes');
  end if;

  if v_price is distinct from v_acc.asking_price then
    update public.accounts set asking_price = v_price where id = v_acc.id;
    v_edited := array_append(v_edited, 'asking_price');
  end if;

  if cardinality(v_edited) > 0 then
    perform private.log_activity('EDITED', v_acc.id, jsonb_build_object('fields', to_jsonb(v_edited)));
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

-- Expose asking_price in the read functions.
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
      a.asking_price,
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
        case when x.sort_key = 'asking_price' and x.asc_dir then f.asking_price end asc nulls last,
        case when x.sort_key = 'asking_price' and not x.asc_dir then f.asking_price end desc nulls last,
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
    'asking_price', a.asking_price,
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
        'asking_price', a.asking_price,
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

-- Re-apply function privileges (dropped/recreated functions get defaults).
revoke execute on function public.submit_account(public.account_type, text, text, text, text, text, boolean, numeric) from public, anon;
revoke execute on function public.update_account(bigint, public.account_type, text, text, text, text, text, public.account_status, numeric) from public, anon;
grant execute on function public.submit_account(public.account_type, text, text, text, text, text, boolean, numeric) to authenticated;
grant execute on function public.update_account(bigint, public.account_type, text, text, text, text, text, public.account_status, numeric) to authenticated;
revoke execute on function private.normalize_asking_price(public.account_type, numeric, boolean) from public, anon, authenticated;
