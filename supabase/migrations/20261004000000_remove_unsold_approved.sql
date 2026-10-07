-- =============================================================================
-- Simplified statuses: PENDING → SOLD or REJECTED
--
-- * Existing UNSOLD / APPROVED accounts become PENDING (in stock, not sold).
-- * The two statuses can no longer be stored (CHECK constraint) or produced.
-- * Admin "auto-approve" and "approve on import" no longer exist.
-- Requires 20261003000000_direct_sale.sql to have been applied first.
-- (Postgres cannot drop enum labels; the constraint makes them unusable.)
-- =============================================================================

update public.accounts set status = 'PENDING' where status in ('UNSOLD', 'APPROVED');

alter table public.accounts
  add constraint accounts_status_simplified check (status in ('PENDING', 'SOLD', 'REJECTED'));

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
    approved_at = case when p_target = 'SOLD' and approved_at is null then now() else approved_at end,
    approved_by = case when p_target = 'SOLD' and approved_at is null then v_actor else approved_by end,
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
    when 'MARK_SOLD' then v_target := 'SOLD';
    when 'REJECT' then v_target := 'REJECTED';
    else raise exception 'Unknown action' using errcode = 'P0001';
  end case;

  -- Only pending accounts can be sold or rejected; anything else is skipped.
  for v_acc in
    select id, status from public.accounts where id = any(p_account_ids) order by id for update
  loop
    if v_acc.status = 'PENDING' then
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

-- Same signature as before; p_auto_approve is kept for compatibility and ignored.
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

  return v_id;
exception
  when unique_violation then
    raise exception 'An account with this login email already exists' using errcode = 'P0001';
end;
$$;

-- Same signature as before; p_approve is kept for compatibility and ignored.
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
