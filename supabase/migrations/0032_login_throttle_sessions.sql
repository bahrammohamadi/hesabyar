-- 0032 — کندسازی ورود ناموفق + پایه‌ی مدیریت نشست
--
-- ⚠️ چرا در سطح برنامه و نه تنظیمات Supabase؟
--   هر دو راه سمت Supabase در پلن رایگان بسته‌اند. آزمایش شد:
--
--     PATCH config/auth { sessions_timebox }
--       → "User sessions can only be configured on Pro Plans and up."
--
--     PATCH config/auth { hook_password_verification_attempt_enabled }
--       → "The following auth hooks cannot be configured for this
--          organization: HOOK_PASSWORD_VERIFICATION_ATTEMPT"
--
--   پس ورود از یک روت سمت سرور عبور می‌کند تا نقطه‌ی کنترل داشته باشیم.
--
-- 🔴 چرا «تأخیر نمایی» و نه «قفل حساب»؟
--   OWASP قفل ثابت را توصیه نمی‌کند: خودش به ابزار حمله تبدیل می‌شود.
--   مهاجم با ۵ رمز غلط می‌تواند عمداً حساب یک رقیب را قفل کند — یعنی
--   انکار سرویس رایگان. الگوی توصیه‌شده تأخیر نماییِ سقف‌دار است:
--     تلاش ۶ ام →   ۲ ثانیه صبر
--     تلاش ۷ ام →   ۴ ثانیه
--     تلاش ۸ ام →   ۸ ثانیه
--     …            سقف ۱۵ دقیقه
--   اشتباه تایپی کاربر واقعی تقریباً بی‌هزینه می‌ماند، ولی brute-force
--   عملاً غیرممکن می‌شود.

create table if not exists public.login_attempts (
  /*
    کلید بر اساس شناسه‌ی ورود است نه user_id.

    دلیل: در لحظه‌ی تلاش ناموفق هنوز نمی‌دانیم کاربر کیست — و مهم‌تر،
    نباید بدانیم. اگر فقط برای کاربران *موجود* رکورد بسازیم، تفاوت
    زمان پاسخ به مهاجم می‌گوید کدام ایمیل ثبت‌نام شده است
    (user enumeration).
  */
  login_id      text primary key,
  failed_count  int not null default 0,
  last_failed_at timestamptz,
  /* تا این لحظه تلاش تازه پذیرفته نمی‌شود. */
  blocked_until timestamptz,
  updated_at    timestamptz not null default now()
);

comment on table public.login_attempts is
  'شمارنده‌ی تلاش‌های ناموفق ورود برای کندسازی نمایی. کلید = شناسه‌ی ورود، نه user_id.';

create index if not exists idx_login_attempts_blocked
  on public.login_attempts(blocked_until)
  where blocked_until is not null;

alter table public.login_attempts enable row level security;

/*
  هیچ سیاستی تعریف نمی‌شود.

  یعنی حتی کاربر واردشده هم نمی‌تواند این جدول را بخواند. فقط
  service_role (که RLS را دور می‌زند) از روت سرور به آن دسترسی دارد.
  خواندنی‌بودنش برای کاربر عادی یعنی لو رفتن اینکه کدام حساب‌ها هدف
  حمله‌اند.
*/
revoke all on public.login_attempts from anon, authenticated;

/**
 * ثبت یک تلاش ناموفق و برگرداندن مدت انتظار بعدی.
 *
 * @returns ثانیه‌های انتظار تا تلاش بعدی (۰ یعنی بدون محدودیت)
 */
create or replace function public.record_login_failure(p_login_id text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_wait  int;
begin
  insert into public.login_attempts (login_id, failed_count, last_failed_at, updated_at)
  values (lower(trim(p_login_id)), 1, now(), now())
  on conflict (login_id) do update
    set failed_count = public.login_attempts.failed_count + 1,
        last_failed_at = now(),
        updated_at = now()
  returning failed_count into v_count;

  /*
    پنج تلاش اول کاملاً بی‌هزینه است.

    کاربری که رمزش را اشتباه تایپ می‌کند یا بین دو رمز شک دارد، نباید
    مجازات شود. آستانه از تلاش ششم شروع می‌شود.
  */
  if v_count <= 5 then
    v_wait := 0;
  else
    -- 2^(n-5) ثانیه، با سقف ۹۰۰ ثانیه (۱۵ دقیقه)
    v_wait := least(power(2, v_count - 5)::int, 900);
    update public.login_attempts
      set blocked_until = now() + make_interval(secs => v_wait)
      where login_id = lower(trim(p_login_id));
  end if;

  return v_wait;
end;
$$;

comment on function public.record_login_failure(text) is
  'ثبت تلاش ناموفق. ۵ تلاش اول آزاد، سپس تأخیر نمایی تا سقف ۱۵ دقیقه.';

/**
 * چند ثانیه تا تلاش بعدی باید صبر کرد؟
 * صفر یعنی مجاز است.
 */
create or replace function public.login_wait_seconds(p_login_id text)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    0,
    coalesce(
      ceil(extract(epoch from (blocked_until - now())))::int,
      0
    )
  )
  from public.login_attempts
  where login_id = lower(trim(p_login_id));
$$;

comment on function public.login_wait_seconds(text) is
  'ثانیه‌های باقی‌مانده تا مجاز شدن تلاش بعدی ورود.';

/**
 * پاک‌کردن شمارنده پس از ورود موفق یا تغییر رمز.
 *
 * 🔴 فراخوانی پس از *تغییر رمز* هم لازم است، نه فقط ورود موفق.
 * وگرنه کاربری که رمزش را عوض می‌کند شمارنده‌ی قبلی‌اش را نگه می‌دارد
 * و با اولین اشتباه تایپی بلافاصله به همان سطح تأخیر برمی‌گردد.
 */
create or replace function public.clear_login_failures(p_login_id text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.login_attempts where login_id = lower(trim(p_login_id));
$$;

grant execute on function public.record_login_failure(text) to service_role;
grant execute on function public.login_wait_seconds(text)  to service_role;
grant execute on function public.clear_login_failures(text) to service_role;

/*
  ⚠️ عمداً به authenticated داده نمی‌شود: این توابع فقط از روت سرور
  با کلید سرویس فراخوانی می‌شوند. دسترسی کلاینت یعنی امکان پاک‌کردن
  شمارنده توسط خود مهاجم.
*/

/**
 * نمای نشست‌های فعال هر کاربر.
 *
 * ⚠️ security_invoker عمداً false است (پیش‌فرض).
 *   جدول auth.sessions به هیچ نقشی SELECT نداده — حتی service_role.
 *   با definer، نما با مالکیت خودش می‌خواند. همان درسی که در مهاجرت
 *   ۰۰۲۸ با v_admin_users گرفتیم.
 */
create or replace view public.v_user_sessions as
select
  s.id,
  s.user_id,
  s.created_at,
  s.updated_at,
  s.refreshed_at,
  s.not_after,
  s.user_agent,
  host(s.ip) as ip
from auth.sessions s;

comment on view public.v_user_sessions is
  'نشست‌های فعال. definer است چون auth.sessions به هیچ نقشی grant ندارد.';

revoke all on public.v_user_sessions from anon, authenticated;
grant select on public.v_user_sessions to service_role;

/**
 * بستن یک نشست مشخص.
 *
 * 🔴 p_user_id اجباری است و در شرط where می‌آید.
 *   بدون آن، هر کاربری می‌توانست با حدس‌زدن یک UUID نشست کاربر دیگری
 *   را ببندد — IDOR کلاسیک. بررسی مالکیت در خود تابع انجام می‌شود نه
 *   در کد برنامه، چون تابع security definer است و مستقیماً به
 *   auth.sessions دسترسی دارد.
 *
 * حذف رکورد از auth.sessions باعث می‌شود refresh token بعدی رد شود،
 * یعنی آن دستگاه حداکثر تا انقضای access token فعلی (یک ساعت) بیرون
 * می‌افتد.
 */
create or replace function public.delete_user_session(
  p_session_id uuid,
  p_user_id uuid
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int;
begin
  if p_session_id is null or p_user_id is null then
    return 0;
  end if;

  delete from auth.sessions
   where id = p_session_id
     and user_id = p_user_id;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

comment on function public.delete_user_session(uuid, uuid) is
  'بستن نشست با بررسی مالکیت. p_user_id در where می‌آید تا IDOR ممکن نباشد.';

revoke all on function public.delete_user_session(uuid, uuid) from anon, authenticated;
grant execute on function public.delete_user_session(uuid, uuid) to service_role;
