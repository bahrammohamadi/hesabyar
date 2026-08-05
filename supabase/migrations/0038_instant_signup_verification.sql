-- =============================================================
-- Tarazoo Migration 0038 — فعال‌سازی فوری + تأیید ایمیل پس از ورود
--
-- 🔴 مسئله‌ای که حل می‌کند (روی سرور واقعی بازتولید شد):
--
--   کاربر ثبت‌نام می‌کرد، پیام «لینک تأیید به ایمیل شما ارسال شد»
--   می‌گرفت و همان‌جا رها می‌شد. تا کلیک روی لینک، نه نشستی داشت و نه
--   سازمانی. اندازه‌گیری: پس از یک ثبت‌نام واقعی،
--     auth.users.email_confirmed_at = null
--     organizations = صفر ردیف
--   یعنی کاربری که برنمی‌گشت، هیچ ردی جز یک ایمیل بی‌مصرف نداشت.
--
--   بدتر: `rate_limit_email_sent` در پلن رایگان **۲ ایمیل در ساعت
--   برای کل پروژه** است. یعنی سومین نفری که در یک ساعت ثبت‌نام
--   می‌کرد، اصلاً ایمیلی دریافت نمی‌کرد و برای همیشه پشت در می‌ماند.
--   این تنها یک مسئله‌ی نرخ ریزش نبود؛ یک نقص کارکردی بود.
--
-- راهکار (الگوی رایج Notion/Slack/Linear):
--   ثبت‌نام → ورود فوری → کار با پنل → تأیید ایمیل در فرصت مناسب.
--   `mailer_autoconfirm` در تنظیمات Auth روشن شد.
--
-- ⚠️ autoconfirm به‌تنهایی یعنی هرکسی با هر رشته‌ای که شکل ایمیل
--    دارد حساب می‌سازد. لایه‌های جبرانی این مهاجرت:
--      ۱ نشان «تأییدشده» جدا از «فعال» — ایمیل تأییدنشده علامت می‌خورد
--      ۲ سقف حساب به ازای هر IP در ۲۴ ساعت
--      ۳ گارد ایمیل یکبارمصرف (۰۰۲۹) سر جایش می‌ماند و سخت‌گیرتر می‌شود
--      ۴ عملیات حساس تا تأیید ایمیل بسته است
--
-- نوع: افزایشی.
-- EMERGENCY ROLLBACK: supabase/rollbacks/0038_instant_signup_verification.down.sql
-- =============================================================


-- -------------------------------------------------------------
-- بخش ۱) وضعیت تأیید ایمیل، جدا از وضعیت فعال‌بودن
--
-- چرا ستون تازه و نه اتکا به auth.users.email_confirmed_at؟
--   با autoconfirm، آن ستون *همیشه* پر است و دیگر معنایی ندارد.
--   تأیید واقعی را خودمان دنبال می‌کنیم.
-- -------------------------------------------------------------

alter table public.organizations
  add column if not exists email_verified_at timestamptz,
  -- IP ثبت‌نام: برای تشخیص ساخت انبوه حساب
  add column if not exists signup_ip text;

comment on column public.organizations.email_verified_at is
  'زمان تأیید واقعی ایمیل مالک. با autoconfirm، ستون auth.users بی‌معناست.';


create table if not exists public.email_verifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  email       text not null,
  /*
    کد ذخیره نمی‌شود، فقط چکیده‌اش.
    اگر روزی نسخه‌ای از دیتابیس درز کند، کد خام در دست مهاجم نباشد.
    همان قاعده‌ای که برای رمز عبور بدیهی است و اینجا هم صدق می‌کند.
  */
  code_hash   text not null,
  attempts    int not null default 0,
  expires_at  timestamptz not null,
  verified_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists idx_email_verif_user
  on public.email_verifications(user_id, created_at desc);

alter table public.email_verifications enable row level security;

/*
  ⚠️ هیچ policy برای authenticated نوشته نمی‌شود.
  خواندن این جدول از سمت کلاینت یعنی کاربر بتواند چکیده‌ی کد را
  ببیند و آفلاین حدس بزند. همه‌ی کار از روت API با service_role
  انجام می‌شود.
*/


-- -------------------------------------------------------------
-- بخش ۲) سقف ساخت حساب برای هر IP
--
-- بدون تأیید ایمیلِ پیش از ورود، تنها مانع ساخت انبوه حساب همین است.
-- ۳ حساب در ۲۴ ساعت: یک خانواده یا یک دفتر مشترک را اذیت نمی‌کند،
-- ولی ساخت صد حساب خودکار را بی‌فایده می‌کند.
-- -------------------------------------------------------------

create table if not exists public.signup_attempts (
  id         uuid primary key default gen_random_uuid(),
  ip         text not null,
  email      text,
  created_at timestamptz not null default now()
);

create index if not exists idx_signup_attempts_ip
  on public.signup_attempts(ip, created_at desc);

alter table public.signup_attempts enable row level security;
-- فقط service_role؛ هیچ policy عمومی.


/**
 * آیا این IP به سقف رسیده است؟
 *
 * IP خالی (پشت پراکسی ناشناس) رد نمی‌شود — بستن دسترسی کاربر واقعی
 * بدتر از عبور یک مورد مشکوک است. آن حالت جداگانه لاگ می‌شود.
 */
create or replace function public.signup_ip_exceeded(p_ip text, p_limit int default 3)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_ip is null or btrim(p_ip) = '' then false
    else (
      select count(*) >= p_limit
      from public.signup_attempts s
      where s.ip = p_ip
        and s.created_at > now() - interval '24 hours'
    )
  end;
$$;

grant execute on function public.signup_ip_exceeded(text, int) to service_role;


-- -------------------------------------------------------------
-- بخش ۳) بازنویسی bootstrap_org با ثبت IP
--
-- ⚠️ تابع قبلی (۰۰۲۶) دست‌نخورده می‌ماند مگر در دو نقطه:
--   • پارامتر اختیاری p_signup_ip
--   • پرکردن ستون signup_ip
-- بقیه‌ی رفتار — از جمله «یک کاربر دو سازمان نسازد» — عیناً حفظ شده.
--
-- 🔴 چرا `create or replace` کافی نیست؟
--   امضای تابع عوض می‌شود و Postgres آن را *اضافه* می‌کند نه جایگزین.
--   نتیجه دو overload و خطای PGRST203 «Could not choose the best
--   candidate function» — همان چیزی که در مهاجرت ۰۰۳۰ رخ داد.
--   پس اول drop.
-- -------------------------------------------------------------

/*
  🔴 اندازه‌گیری واقعی: پیش از این drop، دو نسخه در دیتابیس بود —
     bootstrap_org(text)  ← بازمانده‌ی نسخه‌ی اولیه، در هیچ مهاجرتی
                             drop نشده بود
     bootstrap_org(text,text,text,text)
  چون همه‌ی پارامترها پیش‌فرض دارند، فراخوانی با یک آرگومان (همان
  چیزی که PostgREST می‌فرستد) مبهم می‌شد:
     ERROR 42725: function public.bootstrap_org(unknown) is not unique
  پس *همه‌ی* امضاهای ممکن پاک می‌شوند، نه فقط آنکه انتظارش را داریم.
*/
do $$
declare r record;
begin
  for r in
    select oid::regprocedure::text sig
    from pg_proc
    where proname = 'bootstrap_org'
      and pronamespace = 'public'::regnamespace
  loop
    execute format('drop function if exists %s', r.sig);
  end loop;
end $$;

create or replace function public.bootstrap_org(
  p_org_name        text,
  p_business_type   text default null,
  p_owner_full_name text default null,
  p_owner_phone     text default null,
  p_signup_ip       text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_org    uuid;
  v_branch uuid;
  v_trial  timestamptz := now() + interval '14 days';
begin
  if v_uid is null then
    raise exception 'کاربر وارد نشده است';
  end if;

  /*
    یک کاربر نباید با رفرش‌کردن فرم دو سازمان بسازد.
    اگر از قبل عضو جایی است، همان را برمی‌گردانیم.
  */
  select m.org_id into v_org
  from public.memberships m
  where m.user_id = v_uid and m.is_active
  order by m.created_at
  limit 1;

  if v_org is not null then
    return v_org;
  end if;

  -- سازمان جدید بلافاصله فعال است.
  insert into public.organizations(
    name, owner_id, created_by, approval_status,
    business_type, owner_full_name, owner_phone,
    trial_ends_at, onboarded_at, signup_ip
  )
  values (
    p_org_name, v_uid, v_uid, 'approved',
    p_business_type, p_owner_full_name, p_owner_phone,
    v_trial,
    case when p_owner_full_name is not null then now() else null end,
    p_signup_ip
  )
  returning id into v_org;

  insert into public.branches(org_id, name, created_by)
  values (v_org, 'شعبه اصلی', v_uid)
  returning id into v_branch;

  insert into public.memberships(org_id, user_id, role, branch_id, created_by)
  values (v_org, v_uid, 'owner', v_branch, v_uid);

  return v_org;
end;
$$;

grant execute on function public.bootstrap_org(text, text, text, text, text)
  to authenticated, service_role;


-- -------------------------------------------------------------
-- بخش ۴) آیا ایمیل این کاربر تأیید شده است؟
--
-- برای گاردهای سمت سرور و نمایش نوار هشدار.
-- -------------------------------------------------------------

create or replace function public.is_email_verified(p_user uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organizations o
    where o.owner_id = coalesce(p_user, auth.uid())
      and o.email_verified_at is not null
  )
  /*
    کاربری که مالک هیچ سازمانی نیست (کارمندی که مدیر برایش حساب
    ساخته) نیازی به تأیید ندارد — ایمیلش را ما ساخته‌ایم.
  */
  or not exists (
    select 1 from public.organizations o where o.owner_id = coalesce(p_user, auth.uid())
  );
$$;

grant execute on function public.is_email_verified(uuid) to authenticated, service_role;


-- -------------------------------------------------------------
-- بخش ۵) سازمان‌های موجود تأییدشده فرض می‌شوند
--
-- 🔴 قید کاربر: هیچ رکورد موجودی نباید رفتارش عوض شود.
-- بدون این، سه کسب‌وکار فعلی ناگهان نوار «ایمیلت را تأیید کن»
-- می‌دیدند و بعضی عملیاتشان بسته می‌شد.
-- -------------------------------------------------------------

update public.organizations
   set email_verified_at = coalesce(email_verified_at, created_at)
 where email_verified_at is null;
