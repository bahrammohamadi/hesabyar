-- =============================================================
-- Hesabyar ERP - Fix report view joins
-- نسخه: 0008 | بعد از 0007 اجرا شود
-- هدف: رفع join اشتباه در گزارش‌ها
--
-- باگ: در migration 0005 جدول products مستقیماً روی sale_items.variant_id
-- join شده بود (p.id = si.variant_id)، در حالی که variant_id به
-- product_variants.id اشاره دارد نه products.id. در نتیجه گزارش‌های
-- پرفروش‌ترین کالا، فروش بر اساس دسته و کم‌فروش داده غلط/خالی می‌دادند.
-- =============================================================

-- الف) کالاهای پرفروش (اصلاح join)
create or replace view public.top_selling_products as
select
  p.id as product_id,
  p.name as product_name,
  p.category_id,
  c.name as category_name,
  sum(si.qty) as total_sold_qty,
  sum(si.line_total) as total_sales_amount,
  sum(si.line_total - si.cost_price * si.qty) as total_profit,
  count(distinct s.id) as order_count
from public.sale_items si
join public.product_variants pv on pv.id = si.variant_id
join public.products p on p.id = pv.product_id
left join public.categories c on c.id = p.category_id
join public.sales s on s.id = si.sale_id
where s.status = 'confirmed'
group by p.id, p.name, p.category_id, c.name
order by total_sold_qty desc;

-- ب) فروش بر اساس دسته‌بندی (اصلاح join)
create or replace view public.sales_by_category as
select
  p.category_id,
  c.name as category_name,
  date_trunc('month', s.date) as month,
  sum(si.qty) as total_qty,
  sum(si.line_total) as total_amount,
  sum(si.line_total - si.cost_price * si.qty) as total_profit
from public.sale_items si
join public.product_variants pv on pv.id = si.variant_id
join public.products p on p.id = pv.product_id
left join public.categories c on c.id = p.category_id
join public.sales s on s.id = si.sale_id
where s.status = 'confirmed'
group by p.category_id, c.name, date_trunc('month', s.date)
order by month desc, total_amount desc;

-- ج) کالاهای کم‌فروش (اصلاح join از طریق product_variants)
create or replace view public.low_selling_products as
select
  p.id as product_id,
  p.name as product_name,
  p.category_id,
  c.name as category_name,
  coalesce(sum(si.qty), 0) as total_sold_qty,
  coalesce(sum(si.line_total), 0) as total_sales_amount
from public.products p
left join public.categories c on c.id = p.category_id
left join public.product_variants pv on pv.product_id = p.id
left join public.sale_items si on si.variant_id = pv.id
left join public.sales s on s.id = si.sale_id and s.status = 'confirmed'
group by p.id, p.name, p.category_id, c.name
having coalesce(sum(si.qty), 0) < 5
order by total_sold_qty asc;

-- =============================================================
-- پایان migration 0008
-- =============================================================
