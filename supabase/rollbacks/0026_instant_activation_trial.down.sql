-- =============================================================
-- Rollback برای 0026_instant_activation_trial.sql
--
-- ⚠️ ستون‌های داده‌ای (business_type، owner_phone، trial_ends_at و ...)
--    عمداً حذف نمی‌شوند تا اطلاعات مشتریان از بین نرود.
--    اگر واقعاً می‌خواهید حذف شوند، بخش انتهایی را دستی اجرا کنید.
--
-- این اسکریپت فقط رفتار را به حالت 0021 برمی‌گرداند:
-- ثبت‌نام جدید دوباره 'pending' می‌شود.
-- =============================================================

drop function if exists public.extend_trial(uuid, int, uuid);
drop function if exists public.complete_onboarding(text, text, text, text);
drop function if exists public.bootstrap_org(text, text, text, text);
drop function if exists public.trial_period_days();

-- بازگرداندن نسخه‌ی 0021 (سازمان جدید = در انتظار تأیید)
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

  insert into public.organizations(name, owner_id, created_by, approval_status)
  values (p_org_name, v_uid, v_uid, 'pending')
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

  insert into public.subscriptions(org_id, plan_id, status, created_by)
  select v_org, p.id, 'trial', v_uid
  from public.plans p where p.code = 'free'
  on conflict do nothing;

  return v_org;
end;
$$;

-- بازگرداندن نمای 0021 بدون ستون‌های جدید
drop view if exists public.v_admin_organizations;
create view public.v_admin_organizations
with (security_invoker = true)
as
select
  o.id, o.name, o.approval_status, o.is_demo, o.is_active,
  o.created_at, o.approved_at, o.approved_by, o.rejection_note, o.owner_id,
  (select count(*) from public.memberships m where m.org_id = o.id and m.is_active) as members_count,
  (select count(*) from public.sales s where s.org_id = o.id)                       as sales_count,
  (select p.name from public.subscriptions sub
     join public.plans p on p.id = sub.plan_id
    where sub.org_id = o.id order by sub.created_at desc limit 1)                   as current_plan
from public.organizations o;

/*
  حذف کامل ستون‌ها (فقط در صورت اطمینان):

    alter table public.organizations
      drop column if exists business_type,
      drop column if exists owner_full_name,
      drop column if exists owner_phone,
      drop column if exists onboarded_at,
      drop column if exists trial_ends_at;
*/
