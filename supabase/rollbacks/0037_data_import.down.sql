-- بازگردانی 0037 — ورود داده از اکسل
--
-- ⚠️ ستون import_job_id عمداً drop نمی‌شود مگر اینکه هیچ داده‌ای
-- به آن وصل نباشد: حذفش یعنی از دست رفتن منشأ رکوردهای واردشده.

drop function if exists public.rollback_import(uuid);

drop policy if exists p_import_read on public.import_jobs;

-- فقط اگر هیچ ورودی ثبت نشده باشد، جدول و ستون‌ها برداشته می‌شوند.
do $$
begin
  if not exists (select 1 from public.import_jobs) then
    alter table public.products         drop column if exists import_job_id;
    alter table public.product_variants drop column if exists import_job_id;
    alter table public.contacts         drop column if exists import_job_id;
    drop table if exists public.import_jobs;
  else
    raise notice 'import_jobs داده دارد — جدول و ستون‌ها دست‌نخورده ماندند.';
  end if;
end $$;

delete from public.platform_permissions where key = 'data.import';

-- ماتریس مجوز به نسخه‌ی ۰۰۳۶ برمی‌گردد (بدون data.import).
create or replace function public.platform_admin_can(
  p_permission text,
  p_user uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid    uuid := coalesce(p_user, auth.uid());
  v_role   text;
  v_custom text[];
begin
  select role, custom_permissions into v_role, v_custom
  from public.platform_admins
  where user_id = v_uid;

  if v_role is null then
    return false;
  end if;

  if v_role = 'custom' then
    return p_permission = any(coalesce(v_custom, '{}'));
  end if;

  return case p_permission
    when 'orgs.view'        then true
    when 'audit.view'       then true
    when 'orgs.approve'     then v_role in ('super_admin', 'support')
    when 'orgs.suspend'     then v_role in ('super_admin')
    when 'trial.extend'     then v_role in ('super_admin', 'support', 'finance')
    when 'plan.change'      then v_role in ('super_admin', 'finance')
    when 'invoice.view'     then v_role in ('super_admin', 'support')
    when 'invoice.modify'   then v_role in ('super_admin')
    when 'admins.manage'    then v_role = 'super_admin'
    when 'users.view'       then true
    when 'impersonate'      then v_role in ('super_admin', 'support')
    when 'announcements.manage' then v_role = 'super_admin'
    when 'users.password'   then v_role = 'super_admin'
    when 'tickets.view'     then true
    when 'tickets.reply'    then v_role in ('super_admin', 'support')
    else false
  end;
end;
$$;
