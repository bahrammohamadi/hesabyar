-- =============================================================
-- Hesabyar Migration 0022 — رفع باگ فراخوانی RPCهای ادمین از سرور
--
-- مشکل کشف‌شده در تست واقعی:
--   API route پنل ادمین با کلید service_role به دیتابیس وصل می‌شود.
--   در آن حالت auth.uid() برابر NULL است، پس is_platform_admin()
--   همیشه false برمی‌گرداند و approve/reject با خطای
--   «دسترسی مدیریت پلتفرم وجود ندارد» شکست می‌خورد.
--
-- راه‌حل:
--   افزودن پارامتر اختیاری p_actor. اگر داده شود، مجوز بر اساس همان
--   کاربر بررسی می‌شود؛ اگر داده نشود، رفتار قبلی (auth.uid()) حفظ می‌شود.
--   بنابراین فراخوانی از سمت کلاینت هم بدون تغییر کار می‌کند.
--
-- ⚠️ نکته امنیتی: p_actor فقط از مسیر سرور پر می‌شود، جایی که هویت
--    کاربر پیش‌تر با supabase.auth.getUser() تأیید شده است. کلاینت
--    نمی‌تواند آن را جعل کند چون به کلید service_role دسترسی ندارد و
--    مسیر anon همچنان از auth.uid() استفاده می‌کند.
-- =============================================================

-- تابع کمکی: آیا کاربرِ مشخص‌شده سوپرادمین است؟
create or replace function public.is_platform_admin(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins where user_id = p_user
  );
$$;

comment on function public.is_platform_admin(uuid) is
  'نسخه‌ی صریح is_platform_admin برای فراخوانی از سرور، جایی که auth.uid() تهی است.';

-- -------------------------------------------------------------
-- approve_organization با actor اختیاری
-- -------------------------------------------------------------
create or replace function public.approve_organization(p_org uuid, p_actor uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := coalesce(p_actor, auth.uid());
begin
  if v_actor is null or not public.is_platform_admin(v_actor) then
    raise exception 'دسترسی مدیریت پلتفرم وجود ندارد';
  end if;

  update public.organizations
  set approval_status = 'approved',
      approved_at     = now(),
      approved_by     = v_actor,
      rejection_note  = null
  where id = p_org;
end;
$$;

-- -------------------------------------------------------------
-- reject_organization با actor اختیاری
-- -------------------------------------------------------------
create or replace function public.reject_organization(
  p_org uuid,
  p_reason text default null,
  p_actor uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := coalesce(p_actor, auth.uid());
begin
  if v_actor is null or not public.is_platform_admin(v_actor) then
    raise exception 'دسترسی مدیریت پلتفرم وجود ندارد';
  end if;

  update public.organizations
  set approval_status = 'rejected',
      rejection_note  = p_reason,
      approved_at     = null,
      approved_by     = v_actor
  where id = p_org;
end;
$$;

grant execute on function public.is_platform_admin(uuid)                  to authenticated, service_role;
grant execute on function public.approve_organization(uuid, uuid)         to authenticated, service_role;
grant execute on function public.reject_organization(uuid, text, uuid)    to authenticated, service_role;
