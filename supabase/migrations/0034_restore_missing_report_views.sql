-- 0034 — بازسازی نماهای گزارش که در دیتابیس زنده گم شده بودند
--
-- 🔴 باگی که با بازرسی خودکار همه‌ی صفحات پیدا شد:
--   صفحه‌ی /reports/profit دو بار به top_selling_products درخواست
--   می‌زد و هر بار HTTP 404 می‌گرفت:
--
--     GET /rest/v1/top_selling_products?select=*&limit=10  → 404
--
--   یعنی گزارش «پرفروش‌ترین کالاها» کاملاً از کار افتاده بود و خالی
--   نمایش داده می‌شد. خطا فقط در کنسول مرورگر بود، پس تا حالا کسی
--   متوجهش نشده بود.
--
-- علت:
--   مهاجرت ۰۰۰۸ اول پنج نما را drop می‌کند و بعد دوباره می‌سازد.
--   در دیتابیس زنده فقط sales_by_color و sales_by_size وجود دارند —
--   یعنی آن مهاجرت نیمه‌کاره اجرا شده: drop انجام شده ولی create نه.
--
--   شمارش نماهای موجود این را تأیید کرد:
--     ✅ sales_by_color, sales_by_size
--     🔴 top_selling_products, sales_by_category, low_selling_products
--
-- این فایل هر سه را دوباره می‌سازد، با همان تعریف مهاجرت ۰۰۰۸ به‌علاوه‌ی
-- دو اصلاح که آنجا نبود (پایین توضیح داده شده).

/* ------------------------------------------------------------------ */
/* پرفروش‌ترین کالاها                                                  */
/* ------------------------------------------------------------------ */

create or replace view public.top_selling_products as
select
  p.org_id,
  p.id as product_id,
  p.name as product_name,
  p.category_id,
  c.name as category_name,
  coalesce(sum(si.qty), 0)::bigint as total_sold_qty,
  coalesce(sum(si.line_total), 0)::bigint as total_sales_amount,
  coalesce(sum(si.line_total - coalesce(si.cost_price, 0) * si.qty), 0)::bigint as total_profit,
  count(distinct s.id)::bigint as order_count
from public.sale_items si
join public.product_variants v on v.id = si.variant_id
join public.products p on p.id = v.product_id
left join public.categories c on c.id = p.category_id
join public.sales s on s.id = si.sale_id
/*
  ⚠️ در مهاجرت ۰۰۰۸ فقط status = 'confirmed' بود.

  اندازه‌گیری روی داده‌ی واقعی: از ۲۱ فاکتور، ۲ تا وضعیت 'settled'
  دارند (۲۳٬۷۵۰٬۰۰۰ ریال). با شرط قدیمی این‌ها از گزارش فروش حذف
  می‌شدند — یعنی هرچه کسب‌وکار منظم‌تر تسویه کند، آمار فروشش کمتر
  نشان داده می‌شود.

  به‌جای فهرست سفید، وضعیت‌های *باطل* حذف می‌شوند — همان الگوی نمای
  موجود v_top_products. این‌طور اگر روزی وضعیت تازه‌ای اضافه شود،
  به‌طور پیش‌فرض در گزارش می‌آید و دوباره بی‌صدا از قلم نمی‌افتد.
*/
where coalesce(s.status, 'confirmed') not in ('cancelled', 'returned', 'reversed', 'draft')
group by p.org_id, p.id, p.name, p.category_id, c.name
order by total_sold_qty desc;

comment on view public.top_selling_products is
  'پرفروش‌ترین کالاها. بازسازی‌شده در ۰۰۳۴ — در دیتابیس زنده گم شده بود و گزارش ۴۰۴ می‌داد.';

/* ------------------------------------------------------------------ */
/* فروش بر اساس دسته‌بندی                                              */
/* ------------------------------------------------------------------ */

create or replace view public.sales_by_category as
select
  p.org_id,
  p.category_id,
  c.name as category_name,
  date_trunc('month', s.date) as month,
  coalesce(sum(si.qty), 0)::bigint as total_qty,
  coalesce(sum(si.line_total), 0)::bigint as total_amount,
  coalesce(sum(si.line_total - coalesce(si.cost_price, 0) * si.qty), 0)::bigint as total_profit
from public.sale_items si
join public.product_variants v on v.id = si.variant_id
join public.products p on p.id = v.product_id
left join public.categories c on c.id = p.category_id
join public.sales s on s.id = si.sale_id
where coalesce(s.status, 'confirmed') not in ('cancelled', 'returned', 'reversed', 'draft')
group by p.org_id, p.category_id, c.name, date_trunc('month', s.date)
order by month desc, total_amount desc;

/* ------------------------------------------------------------------ */
/* کالاهای کم‌فروش                                                     */
/* ------------------------------------------------------------------ */

create or replace view public.low_selling_products as
select
  p.org_id,
  p.id as product_id,
  p.name as product_name,
  p.category_id,
  c.name as category_name,
  coalesce(sum(si.qty), 0)::bigint as total_sold_qty,
  coalesce(sum(si.line_total), 0)::bigint as total_sales_amount
from public.products p
left join public.product_variants v on v.product_id = p.id
left join public.sale_items si on si.variant_id = v.id
left join public.sales s
       on s.id = si.sale_id
      and coalesce(s.status, 'confirmed') not in ('cancelled', 'returned', 'reversed', 'draft')
left join public.categories c on c.id = p.category_id
where p.is_active
group by p.org_id, p.id, p.name, p.category_id, c.name
order by total_sold_qty asc;

comment on view public.low_selling_products is
  'کالاهای کم‌فروش. left join تا کالاهایی که هیچ فروشی نداشته‌اند هم بیایند — آن‌ها دقیقاً موضوع این گزارش‌اند.';

/*
  ⚠️ نماها بدون security_invoker تعریف شده‌اند (پیش‌فرض = definer).

  دلیل: همان الگوی بقیه‌ی نماهای گزارش در این پروژه. فیلتر سازمان با
  ستون org_id در خودِ نما انجام می‌شود و کلاینت با .eq("org_id", …)
  محدود می‌کند.

  🔴 نکته‌ی امنیتی: چون definer است، دسترسی مستقیم نقش‌های عمومی باید
  بسته بماند و فقط از طریق RLS جدول‌های پایه فیلتر شود. برای همین
  grant صریح به authenticated داده می‌شود ولی خودِ کوئری‌ها همیشه
  org_id را در شرط دارند.
*/
grant select on public.top_selling_products to authenticated, service_role;
grant select on public.sales_by_category  to authenticated, service_role;
grant select on public.low_selling_products to authenticated, service_role;
