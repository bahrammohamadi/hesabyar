-- =============================================================
-- Rollback برای 0028_admin_phase2.sql
--
-- ⚠️ جدول‌های تیکت و اعلان حاوی داده‌ی واقعی مشتریان‌اند.
--    این اسکریپت آن‌ها را حذف *نمی‌کند*؛ فقط قابلیت‌های فاز ۲ را
--    غیرفعال می‌کند. حذف کامل در انتها و به‌صورت کامنت آمده.
-- =============================================================

drop function if exists public.active_impersonation(uuid);
drop function if exists public.end_impersonation(uuid, uuid, text);
drop function if exists public.start_impersonation(uuid, text, uuid, text);
drop function if exists public.platform_stats();
drop view     if exists public.v_admin_users;

-- بازگرداندن ماتریس مجوز به نسخه‌ی 0027 (بدون مجوزهای فاز ۲)
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
  v_role text := public.platform_admin_role(coalesce(p_user, auth.uid()));
begin
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

/*
  حذف کامل داده (فقط در صورت اطمینان):

    drop table if exists public.support_messages;
    drop table if exists public.support_tickets;
    drop table if exists public.platform_announcements;
    drop table if exists public.impersonation_sessions;
*/
