-- =============================================================
-- Tarazoo Migration 0025 — ابزار امن افزودن/حذف سوپرادمین
--
-- نوع: افزایشی و غیرمخرب. هیچ ردیف، ستون یا policy موجودی حذف
-- یا تغییر نمی‌کند. هیچ کاربری هم به‌صورت خودکار سوپرادمین نمی‌شود.
--
-- ⚠️ این migration عمداً هیچ seed خودکاری ندارد.
--    بخش ۵ در migration 0021 کاربر bahram@hesabyar.app را خودکار درج
--    می‌کرد. اینجا آن الگو تکرار *نمی‌شود*: هر سوپرادمین جدید باید با
--    اجرای دستی و آگاهانه‌ی یکی از دستورهای بخش «راهنما» اضافه شود.
--
-- EMERGENCY ROLLBACK: supabase/rollbacks/0025_platform_admin_grant_helper.down.sql
-- =============================================================


-- -------------------------------------------------------------
-- بخش ۱) تابع اعطای دسترسی سوپرادمین
--
-- چرا تابع، و نه صرفاً یک INSERT دستی؟
--   INSERT خام سه مشکل دارد که هر سه اینجا حل شده‌اند:
--     • اگر user_id را اشتباه تایپ کنید، خطای foreign key مبهم می‌گیرید.
--     • ثبت نمی‌شود چه کسی این دسترسی را داده است.
--     • اجرای دوباره خطا می‌دهد یا note قبلی را بی‌سروصدا از بین می‌برد.
--
-- security invoker است (پیش‌فرض)، نه definer: یعنی مجوز اجراکننده
-- اعمال می‌شود. از SQL Editor سوپابیس با نقش postgres کار می‌کند، اما
-- یک کاربر عادی با نقش authenticated نمی‌تواند با آن خودش را ادمین کند
-- چون RLS جدول جلویش را می‌گیرد. این تفاوت اصلی با توابع 0021 است.
-- -------------------------------------------------------------
--
-- ⚠️ نام ستون‌های خروجی عمداً پیشوند admin_ دارند.
--    اگر ستون خروجی را user_id بنامیم، PL/pgSQL آن را یک متغیر محلی
--    می‌شناسد و عبارت `on conflict (user_id)` با خطای
--    «column reference "user_id" is ambiguous» شکست می‌خورد.
--    این باگ در تست واقعیِ درج موفق پیدا شد؛ مسیرهای خطا آن را نشان
--    نمی‌دادند چون اصلاً به دستور INSERT نمی‌رسیدند.
--
-- DROP لازم است چون CREATE OR REPLACE اجازه‌ی تغییر نوع خروجی را
-- نمی‌دهد؛ بدون آن، اجرای دوباره‌ی migration روی دیتابیسی که نسخه‌ی
-- قبلی را دارد با خطا متوقف می‌شود.
drop function if exists public.grant_platform_admin(uuid, text, text);

create or replace function public.grant_platform_admin(
  p_user_id uuid,
  p_role    text default 'admin',
  p_note    text default null
)
returns table (
  admin_user_id    uuid,
  admin_email      text,
  admin_role       text,
  admin_note       text,
  admin_created_at timestamptz
)
language plpgsql
volatile
set search_path = public
as $$
declare
  v_email text;
begin
  if p_user_id is null then
    raise exception 'p_user_id الزامی است';
  end if;

  -- وجود کاربر را صریح بررسی می‌کنیم تا پیام خطا قابل‌فهم باشد،
  -- نه «violates foreign key constraint».
  select u.email into v_email from auth.users u where u.id = p_user_id;
  if v_email is null then
    raise exception 'کاربری با شناسه % در auth.users وجود ندارد', p_user_id;
  end if;

  if p_role not in ('admin', 'support') then
    raise exception 'نقش نامعتبر: %. مقادیر مجاز: admin یا support', p_role;
  end if;

  insert into public.platform_admins (user_id, role, note, created_by)
  values (
    p_user_id,
    p_role,
    coalesce(p_note, 'افزوده‌شده به‌صورت دستی در ' || to_char(now(), 'YYYY-MM-DD')),
    auth.uid()   -- در SQL Editor برابر NULL است؛ اشکالی ندارد، ستون nullable است.
  )
  -- اجرای دوباره بی‌خطر است: نقش و یادداشت به‌روز می‌شوند.
  on conflict (user_id) do update
    set role = excluded.role,
        note = excluded.note;

  return query
    select pa.user_id, v_email, pa.role, pa.note, pa.created_at
    from public.platform_admins pa
    where pa.user_id = p_user_id;
end;
$$;

comment on function public.grant_platform_admin(uuid, text, text) is
  'افزودن امن کاربر به platform_admins. فقط برای اجرای دستی در SQL Editor؛ به authenticated گرant نشده است.';


-- -------------------------------------------------------------
-- بخش ۲) تابع سلب دسترسی
--
-- محافظ مهم: اجازه نمی‌دهد آخرین سوپرادمین حذف شود.
-- بدون این شرط، یک اشتباه ساده کل پلتفرم را بدون هیچ ادمینی رها
-- می‌کرد و راه برگشتی جز دسترسی مستقیم به دیتابیس نمی‌ماند.
-- -------------------------------------------------------------
create or replace function public.revoke_platform_admin(p_user_id uuid)
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  v_remaining int;
begin
  if not exists (select 1 from public.platform_admins where user_id = p_user_id) then
    return 'این کاربر از قبل سوپرادمین نبود؛ تغییری اعمال نشد.';
  end if;

  select count(*) into v_remaining from public.platform_admins;
  if v_remaining <= 1 then
    raise exception 'حذف آخرین سوپرادمین مجاز نیست — پلتفرم بدون مدیر می‌ماند';
  end if;

  delete from public.platform_admins where user_id = p_user_id;
  return 'دسترسی سوپرادمین سلب شد.';
end;
$$;

comment on function public.revoke_platform_admin(uuid) is
  'سلب دسترسی سوپرادمین. از حذف آخرین ادمین جلوگیری می‌کند.';


-- -------------------------------------------------------------
-- بخش ۳) نمای فقط-خواندنی برای دیدن ادمین‌های فعلی همراه با ایمیل
--
-- جدول platform_admins فقط user_id دارد و برای فهمیدن اینکه هر
-- سطر مال کیست باید هربار به auth.users جوین بزنید.
--
-- security_invoker = true یعنی RLS اعمال می‌شود: کاربر عادی از طریق
-- API چیزی نمی‌بیند. (در SQL Editor با نقش postgres همه را می‌بینید.)
-- -------------------------------------------------------------
create or replace view public.v_platform_admins
with (security_invoker = true)
as
select
  pa.user_id,
  u.email,
  pa.role,
  pa.note,
  pa.created_at
from public.platform_admins pa
join auth.users u on u.id = pa.user_id;

comment on view public.v_platform_admins is
  'فهرست سوپرادمین‌ها همراه ایمیل. فقط برای بازبینی دستی.';


-- -------------------------------------------------------------
-- بخش ۴) کنترل دسترسی به خود توابع
--
-- 🔴 این بخش حیاتی است.
--    اگر grant_platform_admin به نقش authenticated داده شود، هر کاربر
--    واردشده‌ای می‌تواند با یک درخواست REST خودش را سوپرادمین کند.
--    پس EXECUTE را صریح از public/anon/authenticated می‌گیریم.
--
--    توجه: چون تابع security definer نیست، حتی اگر کسی بتواند صدایش
--    بزند، RLS جدول جلوی درج را می‌گیرد. این revoke لایه‌ی دوم است.
-- -------------------------------------------------------------
revoke all on function public.grant_platform_admin(uuid, text, text)  from public, anon, authenticated;
revoke all on function public.revoke_platform_admin(uuid)             from public, anon, authenticated;

revoke all on public.v_platform_admins from anon;


-- =============================================================
-- راهنمای استفاده — این بخش اجرا نمی‌شود، فقط برای کپی‌کردن است.
--
-- در Supabase Dashboard → SQL Editor یکی از حالت‌های زیر را اجرا کنید.
-- =============================================================

/*
  ─── گام ۰: ببینید الان چه کسی سوپرادمین است ───────────────────

    select * from public.v_platform_admins;


  ─── گام ۱: شناسه‌ی کاربر خودتان را پیدا کنید ──────────────────

  ایمیل را با ایمیل واقعی حساب خودتان عوض کنید. اگر با نام کاربری
  وارد می‌شوید، دامنه‌ی داخلی @hesabyar.app به آن اضافه می‌شود —
  یعنی کاربری «bahram» ایمیلش «bahram@hesabyar.app» است.

    select id, email, created_at
    from auth.users
    where email = 'YOUR_EMAIL_HERE@hesabyar.app';

  اگر ایمیل دقیق را به یاد ندارید، همه را ببینید:

    select id, email, created_at from auth.users order by created_at;


  ─── گام ۲: دسترسی را بدهید ────────────────────────────────────

  حالت الف) اگر user_id را از گام ۱ دارید (روش پیشنهادی — صریح است):

    select * from public.grant_platform_admin(
      '00000000-0000-0000-0000-000000000000'::uuid,   -- ← id از گام ۱
      'admin',
      'مالک پلتفرم'
    );

  حالت ب) بدون کپی‌کردن دستی uuid، مستقیم با ایمیل.
  اگر ایمیل پیدا نشود، هیچ سطری برنمی‌گردد و هیچ تغییری هم نمی‌دهد
  (پس یک غلط تایپی، کاربر اشتباهی را ادمین نمی‌کند):

    select g.*
    from auth.users u
    cross join lateral public.grant_platform_admin(
      u.id, 'admin', 'مالک پلتفرم'
    ) g
    where u.email = 'YOUR_EMAIL_HERE@hesabyar.app';


  ─── گام ۳: تأیید کنید ─────────────────────────────────────────

    select * from public.v_platform_admins;
    select public.is_platform_admin('YOUR_USER_ID_HERE'::uuid);   -- باید true باشد

  سپس در مرورگر یک‌بار خارج و دوباره وارد شوید (یا صفحه را رفرش
  کنید) تا آیتم «مدیریت کسب‌وکارها» در انتهای نوار کناری ظاهر شود.


  ─── سلب دسترسی (در صورت نیاز) ─────────────────────────────────

    select public.revoke_platform_admin('USER_ID_HERE'::uuid);

  اگر آخرین ادمین باشد، عمداً خطا می‌دهد و انجام نمی‌شود.


  ─── نقش 'support' ────────────────────────────────────────────

  جدول 0021 دو نقش تعریف کرده: 'admin' و 'support'. توجه کنید که
  در وضعیت فعلی کد، is_platform_admin() بین این دو تفاوتی نمی‌گذارد —
  هر دو دسترسی کامل به پنل ادمین دارند. اگر روزی دسترسی فقط-خواندنی
  خواستید، باید در همان تابع تفکیک شود.
*/
