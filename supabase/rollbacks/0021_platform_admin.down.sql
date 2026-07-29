-- =============================================================
-- ROLLBACK برای migration 0021 (پنل سوپرادمین، پلن‌ها، تأیید، دمو)
--
-- ⚠️ این اسکریپت داده حذف می‌کند (plans / subscriptions / platform_admins).
--    قبل از اجرا از دیتابیس بکاپ بگیرید.
--
-- ترتیب معکوس migration رعایت شده است.
-- =============================================================

-- ۱) بازگرداندن bootstrap_org به رفتار قبلی (بدون pending و بدون اشتراک)
create or replace function public.bootstrap_org(p_org_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_branch uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'کاربر وارد نشده است';
  end if;

  insert into public.organizations(name, owner_id, created_by)
  values (p_org_name, v_uid, v_uid)
  returning id into v_org;

  insert into public.branches(org_id, name, created_by)
  values (v_org, 'شعبه اصلی', v_uid)
  returning id into v_branch;

  insert into public.memberships(org_id, branch_id, user_id, role, created_by)
  values (v_org, v_branch, v_uid, 'owner', v_uid);

  insert into public.accounts(org_id, branch_id, name, type, created_by)
  values
    (v_org, v_branch, 'صندوق', 'cash', v_uid),
    (v_org, v_branch, 'حساب بانکی', 'bank', v_uid);

  return v_org;
end;
$$;

-- ۲) حذف view و RPCها
drop view     if exists public.v_admin_organizations;
drop function if exists public.approve_organization(uuid);
drop function if exists public.reject_organization(uuid, text);

-- ۳) حذف policyها
drop policy if exists p_org_platform_admin   on public.organizations;
drop policy if exists p_platform_admins_all  on public.platform_admins;
drop policy if exists p_subs_admin_write     on public.subscriptions;
drop policy if exists p_subs_read            on public.subscriptions;
drop policy if exists p_plans_admin_write    on public.plans;
drop policy if exists p_plans_public_read    on public.plans;

-- ۴) حذف جداول (subscriptions قبل از plans به‌خاطر FK)
drop table if exists public.subscriptions;
drop table if exists public.plans;
drop table if exists public.platform_admins;

-- ۵) حذف تابع کمکی (بعد از جداول، چون policyها به آن وابسته بودند)
drop function if exists public.is_platform_admin();

-- ۶) حذف ستون‌های افزوده‌شده روی organizations
drop index if exists idx_org_approval_status;
alter table public.organizations
  drop column if exists approval_status,
  drop column if exists approved_at,
  drop column if exists approved_by,
  drop column if exists rejection_note,
  drop column if exists is_demo;
