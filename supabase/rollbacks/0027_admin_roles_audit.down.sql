-- =============================================================
-- Rollback برای 0027_admin_roles_audit.sql
--
-- ⚠️ جدول platform_audit_logs عمداً حذف نمی‌شود — لاگ ممیزی نباید
--    با یک rollback از بین برود. اگر واقعاً می‌خواهید، انتهای فایل.
-- =============================================================

drop view     if exists public.v_admin_org_detail;
drop view     if exists public.v_platform_audit;
drop function if exists public.set_organization_status(uuid, text, text, uuid);
drop function if exists public.platform_admin_can(text, uuid);
drop function if exists public.platform_admin_role(uuid);

-- بازگرداندن نقش‌ها به مدل دوتایی 0021
alter table public.platform_admins drop constraint if exists platform_admins_role_check;
update public.platform_admins set role = 'admin' where role = 'super_admin';
update public.platform_admins set role = 'admin' where role in ('finance', 'readonly');
alter table public.platform_admins
  add constraint platform_admins_role_check check (role in ('admin', 'support'));

-- approve/reject به نسخه‌ی 0022 (بدون لاگ و بدون مجوز ریزدانه)
create or replace function public.approve_organization(p_org uuid, p_actor uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_actor uuid := coalesce(p_actor, auth.uid());
begin
  if v_actor is null or not public.is_platform_admin(v_actor) then
    raise exception 'دسترسی مدیریت پلتفرم وجود ندارد';
  end if;
  update public.organizations
  set approval_status='approved', approved_at=now(), approved_by=v_actor, rejection_note=null
  where id = p_org;
end; $$;

create or replace function public.reject_organization(p_org uuid, p_reason text default null, p_actor uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_actor uuid := coalesce(p_actor, auth.uid());
begin
  if v_actor is null or not public.is_platform_admin(v_actor) then
    raise exception 'دسترسی مدیریت پلتفرم وجود ندارد';
  end if;
  update public.organizations
  set approval_status='rejected', rejection_note=p_reason, approved_at=null, approved_by=v_actor
  where id = p_org;
end; $$;

/*
  حذف کامل لاگ (فقط در صورت اطمینان کامل):

    drop function if exists public.log_platform_action(text,uuid,text,text,text,text,jsonb,text);
    drop table if exists public.platform_audit_logs;
*/
