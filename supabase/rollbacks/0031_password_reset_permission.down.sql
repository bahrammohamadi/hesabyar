-- بازگردانی 0031
--
-- ⚠️ این بازگردانی سه مجوز users.view / impersonate /
-- announcements.manage را هم برمی‌دارد، که یعنی جستجوی کاربران، جعل
-- هویت و اعلان‌ها دوباره 403 می‌دهند — همان حالت معیوبی که ۰۰۳۱ درست
-- کرد. فقط در صورتی اجرا کنید که واقعاً می‌خواهید به وضعیت قبل
-- برگردید.
--
-- امضای تابع عوض نشده (همان دو پارامتر)، پس create or replace کافی
-- است و نیازی به drop نیست. فقط شاخه‌ی users.password برداشته می‌شود.

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
  v_role text;
begin
  v_role := public.platform_admin_role(coalesce(p_user, auth.uid()));
  if v_role is null then
    return false;
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
    else false
  end;
end;
$$;

grant execute on function public.platform_admin_can(text, uuid) to authenticated, service_role;
