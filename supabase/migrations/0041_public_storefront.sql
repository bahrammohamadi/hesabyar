-- =============================================================
-- Tarazoo Migration 0041 — صفحه‌ی عمومی فروشگاه
--
-- کاربر (پس از بررسی kamixapp) تأیید کرد:
--   «صفحه‌ی عمومی فروشگاه — آدرس، تلفن، ساعت کاری، چند کالا؛
--    لینکش را در اینستاگرام می‌گذارند»
--
-- 🔴 مهم‌ترین تصمیم امنیتی این مهاجرت:
--
--   وسوسه‌ی ساده این بود که به جدول‌های `organizations` و `products`
--   یک policy عمومی اضافه کنیم تا کاربر ناشناس بتواند بخواند. این
--   کار **فاجعه** می‌بود: همان جدول‌ها قیمت خرید، حاشیه‌ی سود،
--   موجودی واقعی و شماره تلفن مالک را دارند. یک policy اشتباه یا
--   یک `select *` در آینده، همه را لو می‌داد.
--
--   به‌جایش:
--     • هیچ policy عمومی روی جدول‌های موجود اضافه نمی‌شود
--     • یک جدول جدا `storefronts` برای تنظیمات عمومی
--     • یک تابع `security definer` که *فقط* فیلدهای بی‌خطر را
--       برمی‌گرداند و خودش بررسی می‌کند فروشگاه منتشر شده باشد
--     • صفحه سمت سرور رندر می‌شود؛ مرورگر هرگز مستقیم به دیتابیس
--       وصل نمی‌شود
--
-- 🔴 پیش‌فرض: **خاموش**. هیچ کسب‌وکاری بدون اقدام صریح خودش عمومی
--   نمی‌شود. انتشار ناخواسته‌ی داده‌ی مشتری، خطایی است که نمی‌شود
--   پس گرفت.
--
-- EMERGENCY ROLLBACK: supabase/rollbacks/0041_public_storefront.down.sql
-- =============================================================


-- -------------------------------------------------------------
-- بخش ۱) جدول تنظیمات فروشگاه عمومی
-- -------------------------------------------------------------

create table if not exists public.storefronts (
  org_id       uuid primary key references public.organizations(id) on delete cascade,

  /*
    نشانی یکتای صفحه: /shop/<slug>

    چرا slug و نه خود org_id در URL؟
      آدرس اینستاگرام باید قابل تایپ و به‌یادماندنی باشد. یک UUID
      ۳۶ نویسه‌ای در بیو اینستاگرام بی‌فایده است.

    ⚠️ فقط حروف کوچک لاتین، رقم و خط تیره. حروف فارسی عمداً مجاز
    نیست: در URL به percent-encoding تبدیل می‌شوند و لینک کپی‌شده
    زشت و شکننده می‌شود.
  */
  slug         text not null unique,

  is_published boolean not null default false,

  -- فیلدهای نمایشی. هیچ‌کدام اجباری نیست جز عنوان.
  title        text not null,
  tagline      text,
  about        text,
  address      text,
  phone        text,
  instagram    text,
  telegram     text,
  whatsapp     text,
  hours        text,

  /*
    آیا قیمت کالاها نمایش داده شود؟

    جدا از is_published است چون تصمیم متفاوتی است: خیلی از
    بوتیک‌ها می‌خواهند کالا دیده شود ولی قیمت را در دایرکت بدهند.
    پیش‌فرض خاموش — محافظه‌کارانه‌ترین حالت.
  */
  show_prices  boolean not null default false,

  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.storefronts is
  'تنظیمات صفحه‌ی عمومی هر کسب‌وکار. پیش‌فرض منتشرنشده.';

/*
  قید slug در سطح دیتابیس، نه فقط در فرم.

  اعتبارسنجی سمت کلاینت با یک درخواست curl دور زده می‌شود. اگر
  slug بتواند `../admin` یا نویسه‌ی یونیکد داشته باشد، مسیریابی
  Next.js رفتار پیش‌بینی‌نشده پیدا می‌کند.
*/
alter table public.storefronts drop constraint if exists storefronts_slug_format;
alter table public.storefronts add constraint storefronts_slug_format
  check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$');

create index if not exists idx_storefronts_published
  on public.storefronts(slug) where is_published;

drop trigger if exists trg_updated_storefronts on public.storefronts;
create trigger trg_updated_storefronts
  before update on public.storefronts
  for each row execute function public.set_updated_at();


-- -------------------------------------------------------------
-- بخش ۲) RLS — فقط صاحب کسب‌وکار
--
-- توجه: هیچ policy عمومی (anon) اینجا نیست. خواندنِ عمومی فقط از
-- راه تابع security definer پایین انجام می‌شود که ستون‌های
-- برگشتی‌اش صریح و محدود است.
-- -------------------------------------------------------------

alter table public.storefronts enable row level security;

drop policy if exists p_storefronts_owner on public.storefronts;
create policy p_storefronts_owner on public.storefronts
  for all to authenticated
  using (org_id in (select public.user_org_ids()) and public.has_permission('settings.manage'))
  with check (org_id in (select public.user_org_ids()) and public.has_permission('settings.manage'));

drop policy if exists p_storefronts_admin on public.storefronts;
create policy p_storefronts_admin on public.storefronts
  for select to authenticated
  using (public.is_platform_admin());


-- -------------------------------------------------------------
-- بخش ۳) خواندن عمومی — تابع با ستون‌های صریح
--
-- 🔴 چرا تابع و نه نما؟
--   نما با `grant select to anon` یعنی هر ستونی که فردا به جدول
--   اضافه شود، خودکار عمومی می‌شود. تابع با فهرست صریح
--   `returns table (...)` این ریسک را ندارد: ستون تازه تا وقتی
--   کسی عمداً اضافه‌اش نکند بیرون نمی‌رود.
-- -------------------------------------------------------------

create or replace function public.get_public_storefront(p_slug text)
returns table (
  org_id      uuid,
  title       text,
  tagline     text,
  about       text,
  address     text,
  phone       text,
  instagram   text,
  telegram    text,
  whatsapp    text,
  hours       text,
  show_prices boolean,
  org_name    text,
  logo_url    text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.org_id, s.title, s.tagline, s.about, s.address, s.phone,
    s.instagram, s.telegram, s.whatsapp, s.hours, s.show_prices,
    o.name, o.logo_url
  from public.storefronts s
  join public.organizations o on o.id = s.org_id
  where s.slug = lower(trim(p_slug))
    and s.is_published
    /*
      کسب‌وکار معلق یا ردشده نباید صفحه‌ی زنده داشته باشد.
      بدون این، تعلیق یک حساب فقط دسترسی *خودش* را می‌بست و
      ویترین عمومی‌اش همچنان بالا می‌ماند.
    */
    and o.approval_status = 'approved'
    and o.is_active;
$$;

comment on function public.get_public_storefront(text) is
  'اطلاعات عمومی یک فروشگاه منتشرشده. ستون‌ها صریح‌اند؛ چیزی جز این‌ها بیرون نمی‌رود.';

grant execute on function public.get_public_storefront(text) to anon, authenticated, service_role;


/**
 * کالاهای قابل نمایش یک فروشگاه.
 *
 * 🔴 ستون‌های عمداً *غایب*:
 *     purchase_price   — قیمت خرید، محرمانه‌ترین عدد یک فروشگاه
 *     stock_qty        — موجودی دقیق؛ رقیب نباید بداند
 *     cost_price, code — داده‌ی داخلی
 *
 *   فقط نام، دسته، تصویر و (در صورت اجازه) قیمت فروش.
 *
 * موجودی به‌صورت *بولین* برمی‌گردد نه عدد: مشتری باید بداند «هست یا
 * نیست»، نه اینکه «۳ تا مانده».
 */
create or replace function public.get_public_storefront_products(
  p_slug  text,
  p_limit int default 60
)
returns table (
  product_id uuid,
  name       text,
  category   text,
  image_url  text,
  price      bigint,
  in_stock   boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with sf as (
    select s.org_id, s.show_prices
    from public.storefronts s
    join public.organizations o on o.id = s.org_id
    where s.slug = lower(trim(p_slug))
      and s.is_published
      and o.approval_status = 'approved'
      and o.is_active
  )
  select
    p.id,
    p.name,
    c.name,
    p.image_url,
    /*
      قیمت فقط وقتی برمی‌گردد که فروشگاه اجازه داده باشد. NULL یعنی
      «نمایش نده» — تصمیم در دیتابیس گرفته می‌شود نه در UI، تا
      حتی اگر صفحه‌ای اشتباه بنویسیم قیمت لو نرود.

      قیمت مؤثر: قیمت تنوع مقدم بر قیمت پایه — همان قاعده‌ای که
      lib/pricing.ts در برنامه اعمال می‌کند.
    */
    case when sf.show_prices
      then coalesce(min(v.sale_price), p.base_sale_price)
      else null
    end,
    coalesce(sum(v.stock_qty), 0) > 0
  from sf
  join public.products p on p.org_id = sf.org_id and p.is_active
  left join public.product_variants v on v.product_id = p.id and v.is_active
  left join public.categories c on c.id = p.category_id
  group by p.id, p.name, c.name, p.image_url, p.base_sale_price, sf.show_prices
  -- موجودها اول؛ ویترینی که با کالای ناموجود شروع شود بی‌فایده است.
  order by (coalesce(sum(v.stock_qty), 0) > 0) desc, p.name
  limit least(greatest(coalesce(p_limit, 60), 1), 200);
$$;

comment on function public.get_public_storefront_products(text, int) is
  'کالاهای عمومی یک فروشگاه. قیمت خرید و موجودی عددی هرگز برنمی‌گردد.';

grant execute on function public.get_public_storefront_products(text, int)
  to anon, authenticated, service_role;


-- -------------------------------------------------------------
-- بخش ۴) بررسی در دسترس بودن slug
--
-- بدون این، کاربر فرم را پر می‌کند و فقط هنگام ذخیره می‌فهمد
-- نشانی گرفته شده است.
-- -------------------------------------------------------------

create or replace function public.is_storefront_slug_available(p_slug text, p_org uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.storefronts
    where slug = lower(trim(p_slug))
      and (p_org is null or org_id <> p_org)
  );
$$;

grant execute on function public.is_storefront_slug_available(text, uuid)
  to authenticated, service_role;
