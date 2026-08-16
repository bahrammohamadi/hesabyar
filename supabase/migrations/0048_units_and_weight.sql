-- 0048 — واحد شمارش و کالای وزنی
--
-- 🔴 مشکلی که حل می‌کند:
--   ستون `qty` در همه‌ی جدول‌های سند از نوع **`integer`** بود. یعنی
--   «۱٫۵ کیلو گوشت» یا «۲۵۰ گرم آرد» اصلاً قابل ثبت نبود — سوپرمارکت
--   و نانوایی و قنادی عملاً نمی‌توانستند از برنامه استفاده کنند.
--
--   این سه شکاف را هم‌زمان می‌بندد:
--     • «ترازو و کالای وزنی» (سوپرمارکت)
--     • «قیمت‌گذاری بر اساس واحد فرعی بسته/کارتن» (ابزار)
--     • «فروش عمده با واحد بسته» (لوازم‌التحریر)
--
-- ⚠️ چرا numeric(14,3) و نه float؟
--   ممیز شناور برای پول و مقدار سم است: 0.1 + 0.2 = 0.30000000000000004
--   و جمع موجودی بعد از هزار حرکت با واقعیت فرق می‌کند. numeric دقیق
--   است. سه رقم اعشار یعنی تا گرم دقت دارد.
--
-- ⚠️ چرا این مهاجرت پرریسک است:
--   ۱۱ نما به این ستون‌ها وابسته‌اند و باید drop و بازساخته شوند.
--   چهارتاشان `security_invoker = true` دارند — اگر آن گزینه از دست
--   برود، RLS دور زده می‌شود و هر کاربر داده‌ی سازمان‌های دیگر را
--   می‌بیند. تعاریف عیناً از pg_get_viewdef گرفته شده‌اند نه دستی.
--
-- ⚠️ داده‌ی موجود: ۷۵۹ حرکت انبار واقعی. تبدیل int به numeric
--   بی‌خطر است (۵ می‌شود ۵٫۰۰۰) و هیچ مقداری گرد یا حذف نمی‌شود.

-- =============================================================
-- ۱) واحد شمارش روی کالا
-- =============================================================
--
-- چرا روی products و نه product_variants؟
--   واحد خاصیت خود کالاست نه تنوعش. «برنج» کیلویی است، چه قرمز باشد
--   چه سفید. اگر روی تنوع می‌گذاشتیم، کاربر باید برای هر رنگ و سایز
--   دوباره واحد را انتخاب می‌کرد.
alter table public.products
  add column if not exists unit text not null default 'count',
  add column if not exists unit_label text,
  -- واحد فرعی: «کارتن ۱۲ عددی». ضریب تبدیل به واحد اصلی.
  add column if not exists pack_label text,
  add column if not exists pack_size numeric(14,3)
    check (pack_size is null or pack_size > 0);

comment on column public.products.unit is
  'واحد شمارش: count شمارشی، weight وزنی، volume حجمی، length طولی.';
comment on column public.products.unit_label is
  'برچسب دلخواه واحد مثل کیلوگرم یا متر. خالی یعنی برچسب پیش‌فرض همان unit.';
comment on column public.products.pack_size is
  'چند واحد اصلی در هر بسته. برای کارتن ۱۲ عددی مقدارش ۱۲ است.';

-- مقدار مجاز unit با چک، نه با enum: افزودن مقدار جدید به enum در
-- Postgres قفل جدول می‌گیرد؛ چک را می‌شود ساده جایگزین کرد.
alter table public.products drop constraint if exists products_unit_check;
alter table public.products add constraint products_unit_check
  check (unit in ('count','weight','volume','length'));

-- =============================================================
-- ۲) نماهای وابسته موقتاً حذف می‌شوند
-- =============================================================
-- ⚠️ همه در بخش ۴ عیناً بازساخته می‌شوند.
drop view if exists public.v_product_profitability cascade;
drop view if exists public.v_monthly_profit cascade;
drop view if exists public.v_document_lines cascade;
drop view if exists public.low_selling_products cascade;
drop view if exists public.top_selling_products cascade;
drop view if exists public.sales_by_category cascade;
drop view if exists public.sales_by_size cascade;
drop view if exists public.sales_by_color cascade;
drop view if exists public.v_admin_invoice_items cascade;
drop view if exists public.v_product_stock cascade;
drop view if exists public.low_stock_variants cascade;

-- =============================================================
-- ۳) تغییر نوع ستون‌های مقدار
-- =============================================================
--
-- ترتیب مهم است: اول جدول‌های سند، آخر product_variants.stock_qty
-- چون تریگر guard_stock_qty_update روی آن نشسته است.

alter table public.stock_movements      alter column qty type numeric(14,3);
alter table public.sale_items           alter column qty type numeric(14,3);
alter table public.purchase_items       alter column qty type numeric(14,3);
alter table public.sales_return_items   alter column qty type numeric(14,3);
alter table public.purchase_return_items alter column qty type numeric(14,3);
alter table public.sales_order_items    alter column qty type numeric(14,3);
alter table public.purchase_order_items alter column qty type numeric(14,3);

-- 🔴 stock_qty هم باید numeric شود وگرنه جمع حرکت‌های اعشاری هنگام
-- نوشتن روی آن گرد می‌شود و موجودی با کاردکس نمی‌خواند.
--
-- ⚠️ Postgres اجازه‌ی تغییر نوع ستونی که در تعریف تریگر آمده نمی‌دهد:
--     cannot alter type of a column used in a trigger definition
--
-- تریگر `trg_guard_stock_qty` روی `update of stock_qty` تعریف شده و
-- همان محافظی است که نمی‌گذارد کسی موجودی را مستقیم دستکاری کند.
-- موقتاً حذف و **عیناً** بازساخته می‌شود. تعریفش از pg_get_triggerdef
-- گرفته شده نه از حافظه.
drop trigger if exists trg_guard_stock_qty on public.product_variants;

alter table public.product_variants     alter column stock_qty type numeric(14,3);

create trigger trg_guard_stock_qty
  before update of stock_qty on public.product_variants
  for each row execute function public.guard_stock_qty_update();

-- =============================================================
-- ۴) بازساخت نماها — عیناً همان تعریف قبلی
-- =============================================================
create view public.low_stock_variants as
SELECT v.id AS variant_id,
    v.org_id,
    p.name AS product_name,
    v.color,
    v.size,
    v.sku,
    v.stock_qty,
    p.low_stock_threshold
   FROM product_variants v
     JOIN products p ON p.id = v.product_id
  WHERE v.is_active = true AND v.stock_qty <= p.low_stock_threshold;

create view public.v_product_stock
with (security_invoker = true) as
SELECT p.id AS product_id,
    pv.id AS product_variant_id,
    COALESCE(sum(sm.qty), 0::bigint)::numeric AS current_stock,
    max(sm.created_at) AS last_movement_at
   FROM product_variants pv
     JOIN products p ON p.id = pv.product_id
     LEFT JOIN stock_movements sm ON sm.variant_id = pv.id
  GROUP BY p.id, pv.id;

create view public.v_admin_invoice_items as
SELECT si.id,
    si.sale_id,
    si.org_id,
    si.qty,
    si.unit_price,
    si.discount,
    si.line_total,
    si.variant_id,
    p.name AS product_name,
    p.code AS product_code,
    v.sku,
    v.color,
    v.size
   FROM sale_items si
     LEFT JOIN product_variants v ON v.id = si.variant_id
     LEFT JOIN products p ON p.id = v.product_id;

create view public.sales_by_color as
SELECT p.org_id,
    v.color,
    COALESCE(sum(si.qty), 0::bigint) AS total_sold_qty,
    COALESCE(sum(si.line_total), 0::numeric)::bigint AS total_amount
   FROM sale_items si
     JOIN product_variants v ON v.id = si.variant_id
     JOIN products p ON p.id = v.product_id
     JOIN sales s ON s.id = si.sale_id
  WHERE s.status = 'confirmed'::text AND v.color IS NOT NULL
  GROUP BY p.org_id, v.color
  ORDER BY (COALESCE(sum(si.qty), 0::bigint)) DESC;

create view public.sales_by_size as
SELECT p.org_id,
    v.size,
    COALESCE(sum(si.qty), 0::bigint) AS total_sold_qty,
    COALESCE(sum(si.line_total), 0::numeric)::bigint AS total_amount
   FROM sale_items si
     JOIN product_variants v ON v.id = si.variant_id
     JOIN products p ON p.id = v.product_id
     JOIN sales s ON s.id = si.sale_id
  WHERE s.status = 'confirmed'::text AND v.size IS NOT NULL
  GROUP BY p.org_id, v.size
  ORDER BY (COALESCE(sum(si.qty), 0::bigint)) DESC;

create view public.sales_by_category as
SELECT p.org_id,
    p.category_id,
    c.name AS category_name,
    date_trunc('month'::text, s.date) AS month,
    COALESCE(sum(si.qty), 0::bigint) AS total_qty,
    COALESCE(sum(si.line_total), 0::numeric)::bigint AS total_amount,
    COALESCE(sum(si.line_total - COALESCE(si.cost_price, 0::bigint) * si.qty), 0::numeric)::bigint AS total_profit
   FROM sale_items si
     JOIN product_variants v ON v.id = si.variant_id
     JOIN products p ON p.id = v.product_id
     LEFT JOIN categories c ON c.id = p.category_id
     JOIN sales s ON s.id = si.sale_id
  WHERE COALESCE(s.status, 'confirmed'::text) <> ALL (ARRAY['cancelled'::text, 'returned'::text, 'reversed'::text, 'draft'::text])
  GROUP BY p.org_id, p.category_id, c.name, (date_trunc('month'::text, s.date))
  ORDER BY (date_trunc('month'::text, s.date)) DESC, (COALESCE(sum(si.line_total), 0::numeric)::bigint) DESC;

create view public.top_selling_products as
SELECT p.org_id,
    p.id AS product_id,
    p.name AS product_name,
    p.category_id,
    c.name AS category_name,
    COALESCE(sum(si.qty), 0::bigint) AS total_sold_qty,
    COALESCE(sum(si.line_total), 0::numeric)::bigint AS total_sales_amount,
    COALESCE(sum(si.line_total - COALESCE(si.cost_price, 0::bigint) * si.qty), 0::numeric)::bigint AS total_profit,
    count(DISTINCT s.id) AS order_count
   FROM sale_items si
     JOIN product_variants v ON v.id = si.variant_id
     JOIN products p ON p.id = v.product_id
     LEFT JOIN categories c ON c.id = p.category_id
     JOIN sales s ON s.id = si.sale_id
  WHERE COALESCE(s.status, 'confirmed'::text) <> ALL (ARRAY['cancelled'::text, 'returned'::text, 'reversed'::text, 'draft'::text])
  GROUP BY p.org_id, p.id, p.name, p.category_id, c.name
  ORDER BY (COALESCE(sum(si.qty), 0::bigint)) DESC;

create view public.low_selling_products as
SELECT p.org_id,
    p.id AS product_id,
    p.name AS product_name,
    p.category_id,
    c.name AS category_name,
    COALESCE(sum(si.qty), 0::bigint) AS total_sold_qty,
    COALESCE(sum(si.line_total), 0::numeric)::bigint AS total_sales_amount
   FROM products p
     LEFT JOIN product_variants v ON v.product_id = p.id
     LEFT JOIN sale_items si ON si.variant_id = v.id
     LEFT JOIN sales s ON s.id = si.sale_id AND (COALESCE(s.status, 'confirmed'::text) <> ALL (ARRAY['cancelled'::text, 'returned'::text, 'reversed'::text, 'draft'::text]))
     LEFT JOIN categories c ON c.id = p.category_id
  WHERE p.is_active
  GROUP BY p.org_id, p.id, p.name, p.category_id, c.name
  ORDER BY (COALESCE(sum(si.qty), 0::bigint));

create view public.v_document_lines
with (security_invoker = true) as
SELECT si.id AS line_id,
    si.sale_id AS doc_id,
    'sale'::text AS doc_type,
    pv.product_id,
    si.variant_id AS product_variant_id,
    COALESCE(si.qty, 0)::numeric AS qty,
    COALESCE(si.unit_price, 0::bigint) AS unit_price,
    COALESCE(si.discount, 0::bigint) AS discount,
    COALESCE(si.line_total, 0::bigint) AS line_total
   FROM sale_items si
     LEFT JOIN product_variants pv ON pv.id = si.variant_id
UNION ALL
 SELECT pi.id AS line_id,
    pi.purchase_id AS doc_id,
    'purchase'::text AS doc_type,
    pv.product_id,
    pi.variant_id AS product_variant_id,
    COALESCE(pi.qty, 0)::numeric AS qty,
    COALESCE(pi.unit_price, 0::bigint) AS unit_price,
    0::bigint AS discount,
    COALESCE(pi.line_total, 0::bigint) AS line_total
   FROM purchase_items pi
     LEFT JOIN product_variants pv ON pv.id = pi.variant_id;

create view public.v_monthly_profit
with (security_invoker = true) as
WITH avg_purchase AS (
         SELECT purchase_items.variant_id,
            avg(NULLIF(purchase_items.unit_price, 0)) AS avg_purchase_price
           FROM purchase_items
          GROUP BY purchase_items.variant_id
        ), lines AS (
         SELECT s.org_id,
            date_trunc('month'::text, s.date)::date AS month_start,
            (si.unit_price * si.qty - COALESCE(si.discount, 0::bigint))::numeric AS revenue,
            COALESCE(NULLIF(si.cost_price, 0)::numeric, NULLIF(pv.purchase_price, 0)::numeric, NULLIF(p.base_purchase_price, 0)::numeric, ap.avg_purchase_price, 0::numeric) * si.qty::numeric AS cost
           FROM sale_items si
             JOIN sales s ON s.id = si.sale_id
             JOIN product_variants pv ON pv.id = si.variant_id
             JOIN products p ON p.id = pv.product_id
             LEFT JOIN avg_purchase ap ON ap.variant_id = si.variant_id
          WHERE COALESCE(s.status, 'confirmed'::text) <> ALL (ARRAY['cancelled'::text, 'returned'::text, 'reversed'::text])
        )
 SELECT org_id,
    month_start,
    sum(revenue) AS sales_amount,
    sum(cost) AS cost_amount,
    sum(revenue) - sum(cost) AS gross_profit
   FROM lines
  GROUP BY org_id, month_start;

create view public.v_product_profitability
with (security_invoker = true) as
WITH avg_purchase AS (
         SELECT purchase_items.variant_id,
            avg(NULLIF(purchase_items.unit_price, 0)) AS avg_purchase_price
           FROM purchase_items
          GROUP BY purchase_items.variant_id
        ), sale_profit AS (
         SELECT s.org_id,
            p.id AS product_id,
            pv.id AS product_variant_id,
            p.name AS product_name,
            p.code AS product_code,
            pv.sku,
            pv.barcode,
            sum(si.qty)::numeric AS qty_sold,
            sum(si.unit_price * si.qty - COALESCE(si.discount, 0::bigint)) AS sales_amount,
            sum(COALESCE(NULLIF(si.cost_price, 0)::numeric, NULLIF(pv.purchase_price, 0)::numeric, NULLIF(p.base_purchase_price, 0)::numeric, ap.avg_purchase_price, 0::numeric) * si.qty::numeric) AS cost_amount
           FROM sale_items si
             JOIN sales s ON s.id = si.sale_id
             JOIN product_variants pv ON pv.id = si.variant_id
             JOIN products p ON p.id = pv.product_id
             LEFT JOIN avg_purchase ap ON ap.variant_id = si.variant_id
          WHERE COALESCE(s.status, 'confirmed'::text) <> ALL (ARRAY['cancelled'::text, 'returned'::text, 'reversed'::text])
          GROUP BY s.org_id, p.id, pv.id, p.name, p.code, pv.sku, pv.barcode
        )
 SELECT org_id,
    product_id,
    product_variant_id,
    product_name,
    product_code,
    sku,
    barcode,
    qty_sold,
    sales_amount,
    cost_amount,
    sales_amount - cost_amount AS gross_profit,
        CASE
            WHEN sales_amount <> 0::numeric THEN round((sales_amount - cost_amount) / sales_amount * 100::numeric, 2)
            ELSE 0::numeric
        END AS gross_margin_percent
   FROM sale_profit;

-- =============================================================
-- ۵) تبدیل مقدار بین واحد اصلی و بسته
-- =============================================================
--
-- کاربر «۳ کارتن» وارد می‌کند و انبار باید «۳۶ عدد» ببیند. این تابع
-- تنها جای این محاسبه است تا کلاینت و سرور از هم جدا نیفتند.
create or replace function public.pack_to_base(
  p_product uuid,
  p_packs numeric
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_size numeric;
begin
  select pack_size into v_size from public.products where id = p_product;
  -- بسته تعریف نشده ⇒ همان عدد برمی‌گردد، نه صفر و نه خطا.
  if v_size is null or v_size <= 0 then
    return coalesce(p_packs, 0);
  end if;
  return round(coalesce(p_packs, 0) * v_size, 3);
end;
$$;

comment on function public.pack_to_base(uuid, numeric) is
  'تبدیل تعداد بسته به تعداد واحد اصلی. بسته تعریف‌نشده یعنی ضریب یک.';
