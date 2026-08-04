-- 0031 — مجوزهای گمشده + بازنشانی رمز عبور توسط ادمین پلتفرم
--
-- 🔴 باگ جدی که حین این کار کشف شد:
--   سه مجوز که روت‌های /api/admin از آن‌ها استفاده می‌کنند، هرگز در
--   ماتریس تعریف نشده بودند و به `else false` می‌افتادند:
--
--     users.view            → app/api/admin/users/search
--     impersonate           → app/api/admin/impersonate
--     announcements.manage  → app/api/admin/announcements
--
--   یعنی روی سایت زنده، حتی super_admin هم HTTP 403 می‌گرفت و
--   «جستجوی کاربران»، «ورود به حساب کاربر» و «اعلان‌ها» کاملاً از کار
--   افتاده بودند. صفحه بدون خطا رندر می‌شد ولی همیشه خالی می‌ماند —
--   به همین دلیل تا حالا دیده نشده بود.
--
--   با فراخوانی واقعی endpoint پیدا شد، نه با خواندن SQL.
--
-- چرا یک مجوز جدا و نه استفاده از یکی از مجوزهای موجود؟
--   بازنشانی رمز یک کاربر یعنی «توانایی ورود به جای او». این خطرناک‌تر
--   از تعلیق سازمان است: تعلیق قابل بازگشت و آشکار است، ولی رمز عوض‌شده
--   یعنی دسترسی کامل و بی‌سروصدا به داده‌ی کسب‌وکار مشتری.
--
--   نگاشتنش به orgs.suspend یا admins.manage معنایش را مبهم می‌کرد.
--
-- سطح دسترسی: فقط super_admin.
--   نقش support نباید بتواند رمز عوض کند — کار پشتیبانی «دیدن مشکل»
--   است، نه «تصاحب حساب». برای دیدن پنل کاربر، امکان جعل هویت
--   (impersonation) از قبل وجود دارد که پایان‌دار و کاملاً لاگ‌شده است.

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

  /*
    🔴 این گارد در مهاجرت ۰۰۲۸ اصلاح شد و اینجا هم باید بماند:
    `v_role not in (...)` وقتی v_role برابر NULL باشد نتیجه‌اش NULL
    است نه TRUE، پس کاربر غیرادمین از گارد رد می‌شد.
  */
  if v_role is null then
    return false;
  end if;

  return case p_permission
    -- مشاهده: همه‌ی نقش‌ها
    when 'orgs.view'        then true
    when 'audit.view'       then true
    -- چرخه‌ی تأیید کسب‌وکار
    when 'orgs.approve'     then v_role in ('super_admin', 'support')
    when 'orgs.suspend'     then v_role in ('super_admin')
    -- اشتراک و مالی
    when 'trial.extend'     then v_role in ('super_admin', 'support', 'finance')
    when 'plan.change'      then v_role in ('super_admin', 'finance')
    -- داده‌ی کسب‌وکار مشتری (حساس‌ترین)
    when 'invoice.view'     then v_role in ('super_admin', 'support')
    when 'invoice.modify'   then v_role in ('super_admin')
    -- مدیریت خود ادمین‌ها
    when 'admins.manage'    then v_role = 'super_admin'

    -- ── مجوزهای گمشده که روت‌ها استفاده می‌کردند ──
    -- مشاهده‌ی فهرست کاربران: همه‌ی نقش‌ها، مثل orgs.view
    when 'users.view'       then true
    /*
      جعل هویت: super_admin و support.
      پشتیبانی باید بتواند مشکل کاربر را از چشم خودش ببیند؛ این
      عملیات پایان‌دار (سقف ۳۰ دقیقه) و کاملاً لاگ‌شده است و برای
      support فقط خواندنی است.
    */
    when 'impersonate'      then v_role in ('super_admin', 'support')
    -- اعلان‌های سراسری: پیام به همه‌ی کاربران، پس فقط بالاترین سطح
    when 'announcements.manage' then v_role = 'super_admin'

    -- بازنشانی رمز کاربر — معادل تصاحب حساب، فقط بالاترین سطح
    when 'users.password'   then v_role = 'super_admin'
    else false
  end;
end;
$$;

comment on function public.platform_admin_can(text, uuid) is
  'ماتریس مجوز ادمین پلتفرم — تک‌منبع حقیقت برای همه‌ی روت‌های /api/admin.';

grant execute on function public.platform_admin_can(text, uuid) to authenticated, service_role;
