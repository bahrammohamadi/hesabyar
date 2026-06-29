-- =============================================================
-- Hesabyar ERP - Fix Report Joins
-- نسخه: 0008
-- هدف: اصلاح viewهای گزارش که variant_id را اشتباه به products.id وصل می‌کردند
-- =============================================================

-- پرفروش‌ترین محصولات
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
where s.status = 'confirmed'
group by p.org_id, p.id, p.name, p.category_id, c.name
order by total_sold_qty desc;

-- فروش بر اساس دسته‌بندی
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
where s.status = 'confirmed'
group by p.org_id, p.category_id, c.name, date_trunc('month', s.date)
order by month desc, total_amount desc;

-- فروش بر اساس رنگ
create or replace view public.sales_by_color as
select
  p.org_id,
  v.color,
  coalesce(sum(si.qty), 0)::bigint as total_sold_qty,
  coalesce(sum(si.line_total), 0)::bigint as total_amount
from public.sale_items si
join public.product_variants v on v.id = si.variant_id
join public.products p on p.id = v.product_id
join public.sales s on s.id = si.sale_id
where s.status = 'confirmed' and v.color is not null
group by p.org_id, v.color
order by total_sold_qty desc;

-- فروش بر اساس سایز
create or replace view public.sales_by_size as
select
  p.org_id,
  v.size,
  coalesce(sum(si.qty), 0)::bigint as total_sold_qty,
  coalesce(sum(si.line_total), 0)::bigint as total_amount
from public.sale_items si
join public.product_variants v on v.id = si.variant_id
join public.products p on p.id = v.product_id
join public.sales s on s.id = si.sale_id
where s.status = 'confirmed' and v.size is not null
group by p.org_id, v.size
order by total_sold_qty desc;

-- کالاهای کم‌فروش
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
left join public.categories c on c.id = p.category_id
left join public.product_variants v on v.product_id = p.id
left join public.sale_items si on si.variant_id = v.id
left join public.sales s on s.id = si.sale_id and s.status = 'confirmed'
where p.is_active = true
  and (s.id is null or s.status = 'confirmed')
group by p.org_id, p.id, p.name, p.category_id, c.name
having coalesce(sum(si.qty), 0) < 5
order by total_sold_qty asc, p.name;
