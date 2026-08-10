-- =============================================================
-- ROLLBACK مهاجرت 0040 — دسته‌بندی کالا
--
-- ⚠️ این فایل ستون org_id را حذف می‌کند، پس **دسته‌بندی‌های
-- ساخته‌شده پس از مهاجرت، مالکشان را از دست می‌دهند** و دوباره
-- بین همه‌ی کسب‌وکارها مشترک می‌شوند.
--
-- پیش از اجرا، اگر می‌خواهید نگه دارید:
--   create table categories_backup_0040 as select * from public.categories;
--
-- توجه: با برگشتن به policy قدیمی (`true`)، نشت داده بین
-- کسب‌وکارها هم برمی‌گردد. این rollback فقط برای وضعیت اضطراری است.
-- =============================================================

-- ۱) بازگرداندن bootstrap_org به نسخه‌ی ۰۰۳۸ (بدون seed دسته‌ها)
create or replace function public.bootstrap_org(
  p_org_name        text,
  p_business_type   text default null,
  p_owner_full_name text default null,
  p_owner_phone     text default null,
  p_signup_ip       text default null
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
    trial_ends_at, onboarded_at, signup_ip
  )
  values (
    p_org_name, v_uid, v_uid, 'approved',
    p_business_type, p_owner_full_name, p_owner_phone,
    v_trial,
    case when p_owner_full_name is not null then now() else null end,
    p_signup_ip
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

grant execute on function public.bootstrap_org(text, text, text, text, text) to authenticated, service_role;

drop function if exists public.seed_default_categories(uuid, text);

-- ۲) policy: بازگشت به حالت قبلی
drop policy if exists p_categories_select on public.categories;
drop policy if exists p_categories_write  on public.categories;

create policy "Public read categories" on public.categories
  for select using (true);

-- ۳) تریگر و ایندکس‌ها
drop trigger if exists trg_updated_categories on public.categories;
drop index if exists public.uq_categories_org_name;
drop index if exists public.idx_categories_org;

-- ۴) ستون‌ها
alter table public.categories
  drop column if exists org_id,
  drop column if exists branch_id,
  drop column if exists is_active,
  drop column if exists updated_at,
  drop column if exists created_by;
