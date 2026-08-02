-- =============================================================
-- Tarazoo Migration 0026 — فعال‌سازی فوری + تست ۱۴ روزه
--
-- چرا این تغییر:
--   migration 0021 هر ثبت‌نام جدید را 'pending' می‌ساخت تا ادمین
--   تأییدش کند. داده نشان داد این یک تله است: سازمان «Vv»
--   (yaser_rezaea@yahoo.com) در ۱ آگوست ساخته شد، کاربر ایمیلش را
--   تأیید کرد، وارد شد، صفحه‌ی «منتظر تأیید» را دید و دیگر برنگشت —
--   صفر مخاطب، صفر کالا، صفر فاکتور.
--
--   از این پس ثبت‌نام جدید بلافاصله فعال است و ۱۴ روز مهلت تست دارد.
--   کنترل ادمین حذف نمی‌شود، فقط از «دروازه‌ی ورود» به «امکان تعلیق
--   پس از ورود» منتقل می‌شود.
--
-- نوع: افزایشی. هیچ ستون/policy موجودی حذف نمی‌شود.
--
-- ⚠️ سازمان‌های موجود دست نمی‌خورند. «Vv» که الان pending است هم
--    عمداً تغییر نمی‌کند — تصمیمش با مالک محصول است.
--
-- EMERGENCY ROLLBACK: supabase/rollbacks/0026_instant_activation_trial.down.sql
-- =============================================================


-- -------------------------------------------------------------
-- بخش ۱) اطلاعات پروفایل کسب‌وکار
--
-- در فرم onboarding گرفته می‌شود. همه nullable‌اند تا سازمان‌های
-- موجود (که این داده را ندارند) نامعتبر نشوند.
-- -------------------------------------------------------------
alter table public.organizations
  add column if not exists business_type text,
  add column if not exists owner_full_name text,
  add column if not exists owner_phone text,
  add column if not exists onboarded_at timestamptz;

comment on column public.organizations.business_type is
  'صنف کسب‌وکار (پوشاک، کافه، سوپرمارکت، ...). برای تحلیل و پیشنهاد محتوا.';
comment on column public.organizations.onboarded_at is
  'زمان تکمیل فرم معارفه. null یعنی هنوز کامل نشده — برای نمایش دوباره‌ی فرم.';

-- -------------------------------------------------------------
-- بخش ۲) مهلت تست روی خود سازمان
--
-- چرا اینجا و نه فقط روی subscriptions؟
--   شمارنده‌ی هدر در هر بارگذاری صفحه خوانده می‌شود. نگه‌داشتن یک
--   ستون روی organizations یعنی همان کوئری‌ای که useOrg از قبل
--   می‌زند کافی است و join اضافه لازم نیست.
--   subscriptions همچنان منبع رسمی وضعیت اشتراک می‌ماند.
-- -------------------------------------------------------------
alter table public.organizations
  add column if not exists trial_ends_at timestamptz;

comment on column public.organizations.trial_ends_at is
  'پایان دوره‌ی تست رایگان. null یعنی سازمان قدیمی یا پولی — شمارنده نمایش داده نمی‌شود.';

create index if not exists idx_org_trial_ends_at
  on public.organizations(trial_ends_at)
  where trial_ends_at is not null;

-- طول دوره‌ی تست در یک جا، تا تغییرش بعداً یک نقطه باشد.
create or replace function public.trial_period_days()
returns int
language sql
immutable
as $$ select 14; $$;

comment on function public.trial_period_days() is
  'طول دوره‌ی تست رایگان به روز. تک‌منبع حقیقت برای bootstrap_org و پنل ادمین.';


-- -------------------------------------------------------------
-- بخش ۳) bootstrap_org — فعال‌سازی فوری
--
-- تفاوت‌ها با نسخه‌ی 0021:
--   • approval_status: 'pending' → 'approved'
--   • trial_ends_at پر می‌شود
--   • اشتراک trial با expires_at واقعی (قبلاً null بود)
--   • پارامترهای اختیاری پروفایل
--
-- پارامترهای جدید default دارند تا فراخوانی قدیمیِ
-- bootstrap_org(p_org_name) بدون تغییر کار کند.
-- -------------------------------------------------------------
create or replace function public.bootstrap_org(
  p_org_name        text,
  p_business_type   text default null,
  p_owner_full_name text default null,
  p_owner_phone     text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org    uuid;
  v_branch uuid;
  v_uid    uuid := auth.uid();
  v_trial  timestamptz := now() + (public.trial_period_days() || ' days')::interval;
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
    trial_ends_at, onboarded_at
  )
  values (
    p_org_name, v_uid, v_uid, 'approved',
    p_business_type, p_owner_full_name, p_owner_phone,
    v_trial,
    -- اگر پروفایل همین‌جا داده شده، معارفه تمام است.
    case when p_owner_full_name is not null then now() else null end
  )
  returning id into v_org;

  insert into public.branches(org_id, name, created_by)
  values (v_org, 'شعبه اصلی', v_uid)
  returning id into v_branch;

  insert into public.memberships(org_id, branch_id, user_id, role, created_by)
  values (v_org, v_branch, v_uid, 'owner', v_uid);

  insert into public.accounts(org_id, branch_id, name, type, created_by)
  values
    (v_org, v_branch, 'صندوق', 'cash', v_uid),
    (v_org, v_branch, 'حساب بانکی', 'bank', v_uid);

  -- اشتراک تست با تاریخ انقضای واقعی (قبلاً expires_at خالی می‌ماند).
  insert into public.subscriptions(org_id, plan_id, status, expires_at, created_by)
  select v_org, p.id, 'trial', v_trial, v_uid
  from public.plans p where p.code = 'free'
  on conflict do nothing;

  return v_org;
end;
$$;

grant execute on function public.bootstrap_org(text, text, text, text)
  to authenticated;


-- -------------------------------------------------------------
-- بخش ۴) تکمیل معارفه برای کاربری که سازمانش از قبل ساخته شده
--
-- لازم است چون کاربران فعلی (و هر کسی که ثبت‌نامش نیمه‌کاره مانده)
-- سازمان دارند ولی پروفایل ندارند.
--
-- فقط مالک سازمان می‌تواند این کار را بکند.
-- -------------------------------------------------------------
create or replace function public.complete_onboarding(
  p_business_type   text,
  p_owner_full_name text,
  p_owner_phone     text,
  p_org_name        text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
begin
  if v_uid is null then
    raise exception 'کاربر وارد نشده است';
  end if;

  -- فقط سازمانی که خودِ کاربر مالکش است.
  select o.id into v_org
  from public.organizations o
  join public.memberships m on m.org_id = o.id
  where m.user_id = v_uid and m.is_active and m.role = 'owner'
  order by o.created_at
  limit 1;

  if v_org is null then
    raise exception 'سازمانی برای این کاربر یافت نشد';
  end if;

  update public.organizations
  set business_type    = coalesce(p_business_type, business_type),
      owner_full_name  = coalesce(p_owner_full_name, owner_full_name),
      owner_phone      = coalesce(p_owner_phone, owner_phone),
      -- نام فقط اگر صریحاً داده شده و خالی نیست
      name             = coalesce(nullif(trim(p_org_name), ''), name),
      onboarded_at     = coalesce(onboarded_at, now())
  where id = v_org;

  return v_org;
end;
$$;

grant execute on function public.complete_onboarding(text, text, text, text)
  to authenticated;


-- -------------------------------------------------------------
-- بخش ۵) تمدید دستی تست توسط سوپرادمین
--
-- بدون این، تنها راه کمک به مشتری‌ای که تستش تمام شده UPDATE دستی
-- در دیتابیس است.
-- -------------------------------------------------------------
create or replace function public.extend_trial(
  p_org   uuid,
  p_days  int,
  p_actor uuid default null
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := coalesce(p_actor, auth.uid());
  v_new   timestamptz;
begin
  if v_actor is null or not public.is_platform_admin(v_actor) then
    raise exception 'دسترسی مدیریت پلتفرم وجود ندارد';
  end if;

  if p_days is null or p_days < 1 or p_days > 365 then
    raise exception 'تعداد روز باید بین ۱ تا ۳۶۵ باشد';
  end if;

  /*
    از «الان» تمدید می‌شود اگر تست منقضی شده، وگرنه از تاریخ فعلیِ
    انقضا. بدون این شرط، تمدید یک تستِ تمام‌شده تاریخی در گذشته
    می‌ساخت و بی‌اثر بود.
  */
  update public.organizations
  set trial_ends_at = greatest(coalesce(trial_ends_at, now()), now())
                      + (p_days || ' days')::interval
  where id = p_org
  returning trial_ends_at into v_new;

  if v_new is null then
    raise exception 'سازمان یافت نشد';
  end if;

  update public.subscriptions
  set expires_at = v_new, status = 'trial'
  where org_id = p_org
    and status in ('trial', 'expired');

  return v_new;
end;
$$;

grant execute on function public.extend_trial(uuid, int, uuid)
  to authenticated, service_role;


-- -------------------------------------------------------------
-- بخش ۶) افزودن ستون‌های جدید به نمای پنل ادمین
--
-- نما بازساخته می‌شود چون ستون اضافه می‌کنیم. تعریف قبلی از 0021
-- عیناً حفظ شده و فقط چند ستون به آن اضافه شده است.
-- -------------------------------------------------------------
drop view if exists public.v_admin_organizations;
create view public.v_admin_organizations
with (security_invoker = true)
as
select
  o.id,
  o.name,
  o.approval_status,
  o.is_demo,
  o.is_active,
  o.created_at,
  o.approved_at,
  o.approved_by,
  o.rejection_note,
  o.owner_id,
  o.business_type,
  o.owner_full_name,
  o.owner_phone,
  o.trial_ends_at,
  o.onboarded_at,
  -- روز باقی‌مانده؛ منفی یعنی منقضی شده.
  case
    when o.trial_ends_at is null then null
    else ceil(extract(epoch from (o.trial_ends_at - now())) / 86400.0)::int
  end as trial_days_left,
  (select count(*) from public.memberships m where m.org_id = o.id and m.is_active) as members_count,
  (select count(*) from public.sales s where s.org_id = o.id)                       as sales_count,
  (select p.name from public.subscriptions sub
     join public.plans p on p.id = sub.plan_id
    where sub.org_id = o.id order by sub.created_at desc limit 1)                   as current_plan
from public.organizations o;

comment on view public.v_admin_organizations is
  'خلاصه سازمان‌ها برای پنل ادمین. security_invoker=true یعنی RLS اعمال می‌شود.';


-- -------------------------------------------------------------
-- بخش ۷) سازمان‌های موجود «معارفه‌شده» علامت می‌خورند
--
-- 🔴 بدون این بخش، layout هر کاربر فعلی را به /onboarding می‌فرستاد
--    چون onboarded_at آن‌ها NULL است — یعنی قفل‌شدن کل کاربران موجود
--    پشت فرمی که برای کاربر جدید ساخته شده. این خطا در تست واقعی
--    پیش از انتشار گرفته شد.
--
-- created_at به‌عنوان زمان معارفه گذاشته می‌شود: از نظر معنایی
-- درست است (این‌ها قبل از وجود این مرحله ساخته شده‌اند) و ستون‌های
-- پروفایل خالی می‌مانند تا بعداً در تنظیمات پر شوند.
--
-- فقط ردیف‌های موجود در لحظه‌ی اجرا. ثبت‌نام‌های بعدی تحت تأثیر نیستند.
-- -------------------------------------------------------------
update public.organizations
set onboarded_at = created_at
where onboarded_at is null;
