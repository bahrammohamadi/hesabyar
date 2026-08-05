-- بازگردانی 0038
-- ⚠️ ستون‌ها فقط اگر خالی باشند حذف می‌شوند.

drop function if exists public.is_email_verified(uuid);
drop function if exists public.signup_ip_exceeded(text, int);
drop table if exists public.email_verifications;
drop table if exists public.signup_attempts;

-- bootstrap_org به امضای ۰۰۲۶ برمی‌گردد.
drop function if exists public.bootstrap_org(text, text, text, text, text);

create or replace function public.bootstrap_org(
  p_org_name        text,
  p_business_type   text default null,
  p_owner_full_name text default null,
  p_owner_phone     text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_org    uuid;
  v_branch uuid;
  v_trial  timestamptz := now() + interval '14 days';
begin
  if v_uid is null then
    raise exception 'کاربر وارد نشده است';
  end if;

  select m.org_id into v_org
  from public.memberships m
  where m.user_id = v_uid and m.is_active
  order by m.created_at
  limit 1;

  if v_org is not null then
    return v_org;
  end if;

  insert into public.organizations(
    name, owner_id, created_by, approval_status,
    business_type, owner_full_name, owner_phone,
    trial_ends_at, onboarded_at
  )
  values (
    p_org_name, v_uid, v_uid, 'approved',
    p_business_type, p_owner_full_name, p_owner_phone,
    v_trial,
    case when p_owner_full_name is not null then now() else null end
  )
  returning id into v_org;

  insert into public.branches(org_id, name, created_by)
  values (v_org, 'شعبه اصلی', v_uid)
  returning id into v_branch;

  insert into public.memberships(org_id, user_id, role, branch_id, created_by)
  values (v_org, v_uid, 'owner', v_branch, v_uid);

  return v_org;
end;
$$;

grant execute on function public.bootstrap_org(text, text, text, text) to authenticated, service_role;

alter table public.organizations drop column if exists email_verified_at;
alter table public.organizations drop column if exists signup_ip;
