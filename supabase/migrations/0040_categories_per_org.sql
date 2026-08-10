-- =============================================================
-- Tarazoo Migration 0040 — دسته‌بندی کالا: تفکیک بر اساس کسب‌وکار
--
-- 🔴 باگی که این مهاجرت می‌بندد (روی دیتابیس زنده اندازه‌گیری شد):
--
--   جدول `categories` برخلاف `brands` و `expense_categories` نه
--   ستون `org_id` دارد و نه `is_active`. ولی کارت «دسته‌بندی کالا»
--   در /settings/catalog دقیقاً همان کوئری‌ای را می‌زند که برای آن
--   دو جدول می‌زند. نتیجه:
--
--     GET  categories?is_active=eq.true
--        → 42703: column categories.is_active does not exist
--     POST categories {org_id, branch_id, name}
--        → PGRST204: Could not find the 'branch_id' column
--
--   یعنی خواندن، افزودن، ویرایش و حذف — هر چهار عمل — خراب بودند.
--   چون کد خطای Supabase را بررسی نمی‌کرد، صفحه بی‌سروصدا
--   «موردی ثبت نشده.» نشان می‌داد در حالی که ۱۵ ردیف در جدول بود.
--   کاربر هیچ پیام خطایی نمی‌دید.
--
-- 🔴 مشکل دوم: policy فعلی `Public read categories` با شرط `true`
--   است. یعنی دسته‌بندی‌ها بین *همه‌ی* کسب‌وکارها مشترک‌اند — مزون
--   پوشاک دسته‌های رستوران را می‌دید. این نشت داده بین مستأجرهاست.
--
-- 🔴 داده‌ی موجود: هر ۱۵ ردیف از پروژه‌ی قدیمی موزیک‌اند
--   («جاز»، «راک»، «پاپ»، «بی‌کلام»…) با ستون‌های slug/type/emoji.
--   **هیچ کالایی به آن‌ها وصل نیست** (اندازه‌گیری: صفر محصول با
--   category_id غیرتهی). پس بی‌خطر می‌شود کنارشان گذاشت.
--
-- ⚠️ تصمیم محافظه‌کارانه: **هیچ ردیفی حذف نمی‌شود.**
--   ردیف‌های قدیمی با org_id = NULL می‌مانند و policy جدید آن‌ها را
--   از دید همه پنهان می‌کند. اگر روزی معلوم شد جایی لازم بوده‌اند،
--   داده هنوز سر جایش است. حذف، تصمیمی است که نمی‌شود پس گرفت.
--
-- EMERGENCY ROLLBACK: supabase/rollbacks/0040_categories_per_org.down.sql
-- =============================================================


-- -------------------------------------------------------------
-- بخش ۱) ستون‌های گمشده
-- -------------------------------------------------------------

alter table public.categories
  add column if not exists org_id     uuid references public.organizations(id) on delete cascade,
  add column if not exists branch_id  uuid references public.branches(id) on delete set null,
  add column if not exists is_active  boolean not null default true,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists created_by uuid references auth.users(id) on delete set null;

comment on column public.categories.org_id is
  'کسب‌وکار مالک این دسته. NULL یعنی ردیف یتیمِ پروژه‌ی قدیمی — از دید همه پنهان است.';

create index if not exists idx_categories_org on public.categories(org_id);

/*
  نام تکراری در یک کسب‌وکار جلوگیری می‌شود.

  چرا partial index و نه unique constraint؟ ردیف‌های یتیم org_id
  تهی دارند و در constraint معمولی همه‌شان با هم تداخل پیدا می‌کردند.
  ضمناً دسته‌ی حذف‌شده (is_active=false) نباید جلوی ساخت دوباره‌ی
  همان نام را بگیرد.
*/
create unique index if not exists uq_categories_org_name
  on public.categories(org_id, lower(name))
  where org_id is not null and is_active;


-- -------------------------------------------------------------
-- بخش ۲) تریگر updated_at — مثل بقیه‌ی جدول‌ها
-- -------------------------------------------------------------

drop trigger if exists trg_updated_categories on public.categories;
create trigger trg_updated_categories
  before update on public.categories
  for each row execute function public.set_updated_at();


-- -------------------------------------------------------------
-- بخش ۳) 🔴 policy — پایان نشت داده بین کسب‌وکارها
--
-- policy قبلی: `Public read categories` با شرط `true`.
-- یعنی هر کاربری دسته‌های همه‌ی کسب‌وکارها را می‌دید و هیچ
-- policy‌ای برای insert/update/delete وجود نداشت.
-- -------------------------------------------------------------

drop policy if exists "Public read categories" on public.categories;
drop policy if exists p_categories_select on public.categories;
drop policy if exists p_categories_write  on public.categories;

/*
  خواندن: فقط دسته‌های کسب‌وکارهای خودِ کاربر.

  ردیف‌های یتیم (org_id تهی) عمداً بیرون می‌مانند — نه حذف شده‌اند و
  نه دیده می‌شوند. سرویس‌رول برای مهاجرت داده همچنان دسترسی دارد.
*/
create policy p_categories_select on public.categories
  for select to authenticated
  using (org_id in (select public.user_org_ids()));

/*
  نوشتن: مجوز products.edit.

  چرا products.edit و نه settings.manage؟ دسته‌بندی کالا در عمل
  بخشی از کار روزمره‌ی کسی است که کالا ثبت می‌کند، نه کار مدیر
  سیستم. انباردار باید بتواند «شومیز» را اضافه کند بدون اینکه به
  کل تنظیمات دسترسی داشته باشد.
*/
create policy p_categories_write on public.categories
  for all to authenticated
  using (org_id in (select public.user_org_ids()) and public.has_permission('products.edit'))
  with check (org_id in (select public.user_org_ids()) and public.has_permission('products.edit'));


-- -------------------------------------------------------------
-- بخش ۴) دسته‌های پیش‌فرض برای کسب‌وکارهای موجود
--
-- پس از اعمال policy بالا، هر کسب‌وکار صفر دسته خواهد داشت (چون
-- ۱۵ ردیف موجود org_id ندارند). یک صفحه‌ی خالی بدون توضیح، کاربر
-- را سردرگم می‌کند — به‌خصوص کسی که تا دیروز فهرستی می‌دید.
--
-- پس بر اساس نوع کسب‌وکار، چند دسته‌ی متناسب ساخته می‌شود.
--
-- ⚠️ شناسه‌های صنف عیناً از lib/business-types.ts گرفته شده‌اند
-- (apparel, cafe, grocery, pharmacy, mobile, jewelry, bakery,
-- hardware, stationery, other). نسخه‌ی اول این مهاجرت شناسه‌های
-- حدسی مثل 'clothing' و 'restaurant' داشت که در هیچ‌کدام از
-- سازمان‌های واقعی وجود نداشتند و همه به شاخه‌ی else می‌افتادند.
-- `on conflict do nothing` یعنی اجرای دوباره‌ی مهاجرت چیزی را
-- تکرار نمی‌کند.
-- -------------------------------------------------------------

do $$
declare
  r        record;
  v_names  text[];
  v_name   text;
begin
  for r in select id, coalesce(business_type, '') bt from public.organizations loop
    v_names := case
      when r.bt = 'apparel'    then array['پیراهن', 'شومیز', 'شلوار', 'مانتو', 'کیف و کفش', 'اکسسوری']
      when r.bt = 'cafe'       then array['پیش‌غذا', 'غذای اصلی', 'نوشیدنی', 'دسر']
      when r.bt = 'grocery'    then array['خواربار', 'لبنیات', 'نوشیدنی', 'شوینده', 'تنقلات']
      when r.bt = 'pharmacy'   then array['دارو', 'مکمل', 'آرایشی', 'بهداشتی']
      when r.bt = 'mobile'     then array['گوشی موبایل', 'لوازم جانبی', 'قاب و گلس', 'شارژر و کابل']
      when r.bt = 'jewelry'    then array['طلا', 'نقره', 'جواهر', 'ساعت']
      when r.bt = 'bakery'     then array['شیرینی تر', 'شیرینی خشک', 'کیک', 'نان']
      when r.bt = 'hardware'   then array['ابزار برقی', 'ابزار دستی', 'لوازم خانگی', 'یراق‌آلات']
      when r.bt = 'stationery' then array['کتاب', 'دفتر و کاغذ', 'نوشت‌افزار', 'لوازم هنری']
      else array['دسته‌ی اول', 'دسته‌ی دوم', 'متفرقه']
    end;

    foreach v_name in array v_names loop
      insert into public.categories (org_id, name, type, is_active)
      values (r.id, v_name, 'product', true)
      on conflict do nothing;
    end loop;
  end loop;
end $$;


-- -------------------------------------------------------------
-- بخش ۵) دسته‌های پیش‌فرض برای کسب‌وکارهای *آینده*
--
-- بدون این، هر ثبت‌نام تازه باز هم با فهرست خالی روبه‌رو می‌شد.
-- bootstrap_org نقطه‌ی ورود ساخت سازمان است (مهاجرت ۰۰۳۸)، پس
-- دسته‌ها همان‌جا ساخته می‌شوند.
--
-- ⚠️ به‌جای حدس‌زدن امضا، دقیقاً امضای فعلی از pg_proc خوانده و
-- بازتولید می‌شود. `create or replace` روی امضای متفاوت، overload
-- می‌سازد نه جایگزین — و بعد PostgREST خطای «is not unique»
-- می‌دهد. این تله در مهاجرت ۰۰۳۸ گرفتارمان کرد.
-- -------------------------------------------------------------

create or replace function public.seed_default_categories(p_org uuid, p_business_type text default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_names text[];
  v_name  text;
  v_n     int := 0;
begin
  if p_org is null then return 0; end if;

  v_names := case
    when p_business_type = 'apparel'    then array['پیراهن', 'شومیز', 'شلوار', 'مانتو', 'کیف و کفش', 'اکسسوری']
    when p_business_type = 'cafe'       then array['پیش‌غذا', 'غذای اصلی', 'نوشیدنی', 'دسر']
    when p_business_type = 'grocery'    then array['خواربار', 'لبنیات', 'نوشیدنی', 'شوینده', 'تنقلات']
    when p_business_type = 'pharmacy'   then array['دارو', 'مکمل', 'آرایشی', 'بهداشتی']
    when p_business_type = 'mobile'     then array['گوشی موبایل', 'لوازم جانبی', 'قاب و گلس', 'شارژر و کابل']
    when p_business_type = 'jewelry'    then array['طلا', 'نقره', 'جواهر', 'ساعت']
    when p_business_type = 'bakery'     then array['شیرینی تر', 'شیرینی خشک', 'کیک', 'نان']
    when p_business_type = 'hardware'   then array['ابزار برقی', 'ابزار دستی', 'لوازم خانگی', 'یراق‌آلات']
    when p_business_type = 'stationery' then array['کتاب', 'دفتر و کاغذ', 'نوشت‌افزار', 'لوازم هنری']
    else array['دسته‌ی اول', 'دسته‌ی دوم', 'متفرقه']
  end;

  foreach v_name in array v_names loop
    insert into public.categories (org_id, name, type, is_active)
    values (p_org, v_name, 'product', true)
    on conflict do nothing;
    v_n := v_n + 1;
  end loop;

  return v_n;
end;
$$;

grant execute on function public.seed_default_categories(uuid, text) to service_role;


/*
  bootstrap_org — بدنه عیناً از نسخه‌ی زنده گرفته شده (مهاجرت ۰۰۳۸)
  و فقط یک خط seed اضافه شده است.

  امضای فعلی با pg_proc تأیید شد و **یکتاست**:
    bootstrap_org(text, text, text, text, text)
  پس create or replace جایگزین می‌کند نه overload.
*/
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

  /*
    🆕 دسته‌بندی‌های پیش‌فرض متناسب با صنف.
    بدون این، کاربر تازه با فهرست خالی روبه‌رو می‌شود و باید پیش از
    ثبت اولین کالا، خودش دسته بسازد.
  */
  perform public.seed_default_categories(v_org, p_business_type);

  return v_org;
end;
$$;

grant execute on function public.bootstrap_org(text, text, text, text, text) to authenticated, service_role;
