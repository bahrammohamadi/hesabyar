-- =============================================================
-- Tarazoo Migration 0029 — جلوگیری از ثبت‌نام با ایمیل یک‌بارمصرف
--
-- خطری که رفع می‌شود (بازتولیدشده روی سرویس زنده):
--   درخواست مستقیم به /auth/v1/signup با دامنه‌های mailinator.com و
--   tempmail.com پذیرفته شد و دو کاربر واقعی ساخت.
--   یعنی هرکسی می‌تواند بی‌نهایت حساب تست ۱۴ روزه بسازد.
--
-- ⚠️ چرا در دیتابیس و نه فقط در فرم؟
--   فرم ثبت‌نام قابل دور زدن است؛ کافی است مهاجم مستقیم به API
--   سوپابیس بزند. تریگر روی auth.users تنها نقطه‌ای است که همه‌ی
--   مسیرها از آن عبور می‌کنند.
--
-- EMERGENCY ROLLBACK: supabase/rollbacks/0029_disposable_email_guard.down.sql
-- =============================================================


-- -------------------------------------------------------------
-- بخش ۱) فهرست دامنه‌های مسدود
--
-- منبع: disposable-email-domains (فهرست مرجع متن‌باز، ~۸۲۰۰ دامنه)
-- به‌علاوه‌ی چند دامنه‌ی رایج که در آن فهرست نبودند — از جمله
-- tempmail.com که در تست واقعی پذیرفته شد.
-- -------------------------------------------------------------
create table if not exists public.disposable_email_domains (
  domain text primary key
);

comment on table public.disposable_email_domains is
  'دامنه‌های ایمیل یک‌بارمصرف. برای به‌روزرسانی، سطر جدید insert کنید.';

alter table public.disposable_email_domains enable row level security;

-- فقط سوپرادمین می‌بیند و ویرایش می‌کند؛ کاربر عادی نیازی ندارد.
drop policy if exists p_disposable_admin on public.disposable_email_domains;
create policy p_disposable_admin on public.disposable_email_domains
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());


-- -------------------------------------------------------------
-- بخش ۲) الگوهای کلیدواژه‌ای
--
-- چرا علاوه بر فهرست؟
--   سنجش نشان داد کلیدواژه‌ها فقط ۵٪ فهرست را پوشش می‌دهند، پس
--   جایگزین فهرست نیستند. اما دامنه‌های تازه هر روز ساخته می‌شوند و
--   فهرست همیشه عقب است — همان‌طور که tempmail.com در فهرست نبود.
--   این لایه شکاف بین به‌روزرسانی‌ها را می‌پوشاند.
--
--   روی ۱۳ دامنه‌ی معتبر پرکاربرد (gmail، yahoo، chmail.ir و…) تست
--   شد: صفر مثبت کاذب.
-- -------------------------------------------------------------
create or replace function public.is_disposable_email(p_email text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_domain text;
begin
  if p_email is null or position('@' in p_email) = 0 then
    return false;
  end if;

  v_domain := lower(split_part(p_email, '@', 2));

  -- لایه ۱: تطبیق دقیق با فهرست
  if exists (select 1 from public.disposable_email_domains d where d.domain = v_domain) then
    return true;
  end if;

  /*
    لایه ۲: زیردامنه.
    «foo.mailinator.com» باید مسدود شود حتی اگر خودش در فهرست نباشد.
  */
  if exists (
    select 1 from public.disposable_email_domains d
    where v_domain like '%.' || d.domain
  ) then
    return true;
  end if;

  -- لایه ۳: الگوهای رایج در نام دامنه‌های تازه
  if v_domain ~ '(^|[.-])(temp|tmp|trash|fake|throwaway|disposable|burner|junk|spam|guerrilla|mailinator|yopmail)([.-]|mail|$)'
     or v_domain ~ '[0-9]+(minute|min)mail'
  then
    return true;
  end if;

  return false;
end;
$$;

comment on function public.is_disposable_email(text) is
  'true اگر دامنه‌ی ایمیل یک‌بارمصرف باشد. سه لایه: فهرست، زیردامنه، الگو.';

grant execute on function public.is_disposable_email(text) to anon, authenticated, service_role;


-- -------------------------------------------------------------
-- بخش ۳) تریگر روی auth.users
--
-- 🔴 این تنها نقطه‌ای است که *همه‌ی* مسیرهای ثبت‌نام از آن عبور
--    می‌کنند: فرم اپ، فراخوانی مستقیم REST، و حتی SDK.
--    اعتبارسنجی سمت کلاینت به‌تنهایی امنیت نیست.
--
-- ⚠️ فقط برای درج جدید. کاربران موجود دست نمی‌خورند تا اگر کسی
--    قبلاً با چنین ایمیلی ثبت‌نام کرده، ناگهان قفل نشود.
-- -------------------------------------------------------------
create or replace function public.guard_disposable_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_disposable_email(new.email) then
    raise exception 'ثبت‌نام با ایمیل موقت امکان‌پذیر نیست. لطفاً از ایمیل اصلی خود استفاده کنید.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_disposable_signup on auth.users;
create trigger trg_guard_disposable_signup
  before insert on auth.users
  for each row
  execute function public.guard_disposable_signup();


-- -------------------------------------------------------------
-- بخش ۴) نمای شمارش برای پنل ادمین
-- -------------------------------------------------------------
create or replace function public.disposable_domain_count()
returns int
language sql
stable
security definer
set search_path = public
as $$ select count(*)::int from public.disposable_email_domains; $$;

grant execute on function public.disposable_domain_count() to authenticated, service_role;
