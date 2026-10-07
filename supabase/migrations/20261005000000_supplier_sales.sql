-- =============================================================================
-- Supplier sales + admin approval
--
-- * Submitters (suppliers) can mark their OWN pending accounts as Sold, with the
--   price they sold them for. The sale counts immediately.
-- * Every sale recorded by a supplier waits for an admin to approve it for the
--   records (`accounts.approved_at` / `approved_by`). Approval never changes the
--   sale itself. Sales recorded by an admin are approved on the spot.
-- * Admins keep everything they could do before (sell, reject, edit, void).
-- Requires 20261004000000_remove_unsold_approved.sql to have been applied first.
-- =============================================================================

-- `approved_at` / `approved_by` now mean "this sale was approved by an admin".
-- Every sale so far was recorded by an admin, so all of them count as approved.
update public.accounts
set approved_at = coalesce(sold_at, now()),
    approved_by = sold_by
where status = 'SOLD' and approved_at is null;

-- The approval queue: sold accounts that no admin has approved yet.
create index accounts_sale_approval_idx on public.accounts (sold_at desc)
  where status = 'SOLD' and approved_at is null;

-- Suppliers can read the sale records they created themselves (their own price).
-- Sales an admin recorded for their accounts stay admin-only, as before.
create policy "sales: suppliers read the sales they recorded"
  on public.sales for select to authenticated
  using (
    sold_by = (select auth.uid())
    and (select private.is_active_user())
    and exists (
      select 1 from public.accounts a
      where a.id = sales.account_id and a.submitter_id = (select auth.uid())
    )
  );

-- Moves one account to a new status and applies every side effect. A sale is
-- approved straight away when an admin records it and left waiting otherwise;
-- leaving Sold always clears the approval together with the voided sale.
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
  v_is_admin boolean := private.is_admin();
  v_action public.activity_action;
  v_label text := '#' || lpad(p_account_id::text, 3, '0');
  v_details jsonb;
begin
  if p_target not in ('PENDING', 'SOLD', 'REJECTED') then
    raise exception 'That status is no longer used' using errcode = 'P0001';
  end if;
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
    approved_at = case
      when p_target = 'SOLD' and v_is_admin then now()
      when p_target = 'SOLD' or v_acc.status = 'SOLD' then null
      else approved_at end,
    approved_by = case
      when p_target = 'SOLD' and v_is_admin then v_actor
      when p_target = 'SOLD' or v_acc.status = 'SOLD' then null
      else approved_by end,
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
    when p_target = 'REJECTED' then 'REJECTED'
    else 'STATUS_CHANGED'
  end;

  v_details := jsonb_build_object('from', v_acc.status, 'to', p_target);
  if p_reason is not null then
    v_details := v_details || jsonb_build_object('reason', left(p_reason, 300));
  end if;
  perform private.log_activity(v_action, v_acc.id, v_details);

  -- private.notify never notifies the caller, so a supplier selling their own
  -- account does not get a "sold" notification about themselves.
  if v_action = 'REJECTED' then
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

-- Admins can sell or reject any pending account. Suppliers can only mark their
-- own pending accounts as Sold, and must give the price. Anything else is skipped.
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
  v_profile public.profiles := private.require_active_user();
  v_is_admin boolean := v_profile.role = 'ADMIN';
  v_target public.account_status;
  v_acc record;
  v_requested int;
  v_updated int := 0;
begin
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
    when 'MARK_SOLD' then v_target := 'SOLD';
    when 'REJECT' then v_target := 'REJECTED';
    else raise exception 'Unknown action' using errcode = 'P0001';
  end case;

  if not v_is_admin then
    if v_target <> 'SOLD' then
      raise exception 'Admin access required' using errcode = '42501';
    end if;
    if p_price is null then
      raise exception 'Enter the price you sold it for' using errcode = 'P0001';
    end if;
  end if;

  for v_acc in
    select id, status, submitter_id from public.accounts where id = any(p_account_ids) order by id for update
  loop
    if v_acc.status = 'PENDING' and (v_is_admin or v_acc.submitter_id = v_profile.id) then
      perform private.apply_status(
        v_acc.id,
        v_target,
        case when v_target = 'SOLD' then round(p_price, 2) end,
        nullif(btrim(p_reason), '')
      );
      v_updated := v_updated + 1;
    end if;
  end loop;

  return jsonb_build_object('updated', v_updated, 'skipped', v_requested - v_updated);
end;
$$;

-- Admin approval of sales recorded by suppliers. Only stamps who approved the
-- sale and when; the sale, its price and its date are left untouched.
create or replace function public.approve_sales(p_account_ids bigint[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin public.profiles := private.require_admin();
  v_acc record;
  v_requested int;
  v_updated int := 0;
begin
  v_requested := coalesce(cardinality(array(select distinct unnest(p_account_ids))), 0);
  if v_requested = 0 then
    raise exception 'Select at least one account' using errcode = 'P0001';
  end if;
  if v_requested > 500 then
    raise exception 'You can approve at most 500 sales at once' using errcode = 'P0001';
  end if;

  for v_acc in
    select id, status, approved_at, submitter_id from public.accounts where id = any(p_account_ids) order by id for update
  loop
    if v_acc.status = 'SOLD' and v_acc.approved_at is null then
      update public.accounts set approved_at = now(), approved_by = v_admin.id where id = v_acc.id;
      perform private.log_activity('APPROVED', v_acc.id, jsonb_build_object('sale', true));
      perform private.notify(v_acc.submitter_id, v_acc.id, 'APPROVED',
        'Sale of #' || lpad(v_acc.id::text, 3, '0') || ' approved',
        'An admin approved the sale you recorded.');
      v_updated := v_updated + 1;
    end if;
  end loop;

  return jsonb_build_object('updated', v_updated, 'skipped', v_requested - v_updated);
end;
$$;

-- list_accounts gains an approval filter, so the old signature is dropped
-- instead of overloaded.
drop function if exists public.list_accounts(text, public.account_type, public.account_status, uuid, date, date, text, text, text, integer, integer);

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
  p_page_size integer default 20,
  p_approval text default null -- 'AWAITING' | 'APPROVED': admin approval of the sale
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
      a.id, a.type, a.status, a.notes, a.created_at, a.updated_at, a.approved_at, a.sold_at, a.sold_by,
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
      and (p_approval is null
           or (p_approval = 'AWAITING' and a.status = 'SOLD' and a.approved_at is null)
           or (p_approval = 'APPROVED' and a.status = 'SOLD' and a.approved_at is not null))
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

-- Who sold it, so the app can tell supplier sales from admin sales.
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
    'sold_by', a.sold_by,
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

-- Counts sales that still wait for an admin's approval.
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
    'sold_unapproved', count(*) filter (where status = 'SOLD' and approved_at is null),
    'rejected', count(*) filter (where status = 'REJECTED'),
    'reviewed', count(*) filter (where approved_at is not null and status in ('APPROVED', 'UNSOLD', 'SOLD')),
    'sold_this_month', count(*) filter (where status = 'SOLD' and sold_at >= date_trunc('month', now())),
    'added_this_week', count(*) filter (where created_at >= now() - interval '7 days')
  )
  from public.accounts;
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
    'available', (select count(*) from public.accounts where status = 'PENDING'),
    'awaiting_approval', (select count(*) from public.accounts where status = 'SOLD' and approved_at is null),
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

-- New / re-created functions get default privileges: lock them down again.
revoke execute on function public.approve_sales(bigint[]) from public, anon;
grant execute on function public.approve_sales(bigint[]) to authenticated;
revoke execute on function public.list_accounts(text, public.account_type, public.account_status, uuid, date, date, text, text, text, integer, integer, text) from public, anon;
grant execute on function public.list_accounts(text, public.account_type, public.account_status, uuid, date, date, text, text, text, integer, integer, text) to authenticated;
