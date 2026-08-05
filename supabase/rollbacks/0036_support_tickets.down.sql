-- بازگردانی 0036 — تیکت پشتیبانی
--
-- ⚠️ ستون‌های افزوده‌شده عمداً drop نمی‌شوند: اگر تیکتی ثبت شده باشد،
-- حذف ستون یعنی از دست رفتن تاریخچه. فقط رفتار جدید برداشته می‌شود.

drop view if exists public.v_support_tickets;

drop trigger if exists trg_support_message_before_insert on public.support_messages;
drop trigger if exists trg_support_message_after_insert  on public.support_messages;
drop trigger if exists trg_support_ticket_before_insert  on public.support_tickets;
drop trigger if exists trg_support_ticket_guard_update   on public.support_tickets;

drop function if exists public.support_message_before_insert();
drop function if exists public.support_message_after_insert();
drop function if exists public.support_ticket_before_insert();
drop function if exists public.support_ticket_guard_update();

drop policy if exists p_ticket_owner_update on public.support_tickets;

delete from public.platform_permissions where key in ('tickets.view', 'tickets.reply');

-- ماتریس مجوز به نسخه‌ی ۰۰۳۳ برمی‌گردد (بدون سطرهای tickets.*).
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
    else false
  end;
end;
$$;
