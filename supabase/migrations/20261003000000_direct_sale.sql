-- =============================================================================
-- Direct sale workflow
--
-- * Pending submissions can be marked Sold directly (no approve step).
-- * Admins can record / correct the sold price from the edit form.
-- Requires 20261002000000_asking_price.sql to have been applied first.
-- =============================================================================

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
      v_allowed := array['PENDING', 'APPROVED', 'UNSOLD']::public.account_status[];
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

drop function if exists public.update_account(bigint, public.account_type, text, text, text, text, text, public.account_status, numeric);

create or replace function public.update_account(
  p_account_id bigint,
  p_type public.account_type,
  p_login_email text,
  p_login_password_enc text default null,
  p_ptc_login text default null,
  p_ptc_password_enc text default null,
  p_notes text default null,
  p_status public.account_status default null,
  p_asking_price numeric default null,
  p_sale_price numeric default null -- admin only: price of the (new or existing) sale
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
  v_sale numeric := case when v_profile.role = 'ADMIN' then round(p_sale_price, 2) end;
  v_target public.account_status;
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
  if v_sale is not null and (v_sale < 0 or v_sale > 1000000) then
    raise exception 'Enter a valid sale price' using errcode = 'P0001';
  end if;

  v_price := private.normalize_asking_price(p_type, p_asking_price, v_is_admin);
  v_target := coalesce(case when v_is_admin then p_status end, v_acc.status);

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

  -- Correcting the price of an account that stays Sold.
  if v_sale is not null and v_acc.status = 'SOLD' and v_target = 'SOLD' then
    update public.sales set price = v_sale
    where account_id = v_acc.id and voided_at is null and price is distinct from v_sale;
    if found then
      v_edited := array_append(v_edited, 'sale_price');
    end if;
  end if;

  if cardinality(v_edited) > 0 then
    perform private.log_activity('EDITED', v_acc.id, jsonb_build_object('fields', to_jsonb(v_edited)));
    v_touched := true;
  end if;

  if v_target <> v_acc.status then
    perform private.apply_status(v_acc.id, v_target, case when v_target = 'SOLD' then v_sale end);
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

revoke execute on function public.update_account(bigint, public.account_type, text, text, text, text, text, public.account_status, numeric, numeric) from public, anon;
grant execute on function public.update_account(bigint, public.account_type, text, text, text, text, text, public.account_status, numeric, numeric) to authenticated;
