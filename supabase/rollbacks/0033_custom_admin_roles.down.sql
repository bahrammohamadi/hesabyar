-- بازگردانی 0033
--
-- ⚠️ هر ادمینی که نقش 'custom' دارد پس از این بازگردانی، قید جدول را
-- نقض می‌کند. پس اول به 'readonly' تبدیل می‌شوند — کم‌خطرترین حالت.
-- تبدیل به super_admin خطرناک بود و حذفشان هم دسترسی را بی‌صدا از بین
-- می‌برد.

update public.platform_admins set role = 'readonly' where role = 'custom';

drop trigger if exists trg_validate_custom_permissions on public.platform_admins;
drop function if exists public.validate_custom_permissions();
drop function if exists public.platform_admin_permissions(uuid);

alter table public.platform_admins drop constraint if exists platform_admins_role_check;
alter table public.platform_admins add constraint platform_admins_role_check
  check (role in ('super_admin', 'support', 'finance', 'readonly'));

alter table public.platform_admins drop column if exists custom_permissions;
drop table if exists public.platform_permissions;

-- بازگردانی تابع به نسخه‌ی ۰۰۳۱
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
    when 'users.view'       then true
    when 'impersonate'      then v_role in ('super_admin', 'support')
    when 'announcements.manage' then v_role = 'super_admin'
    when 'users.password'   then v_role = 'super_admin'
    else false
  end;
end;
$$;

grant execute on function public.platform_admin_can(text, uuid) to authenticated, service_role;
