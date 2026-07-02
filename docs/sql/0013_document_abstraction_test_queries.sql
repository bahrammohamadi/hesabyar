-- =============================================================
-- تست‌های فقط-خواندنی برای Migration 0013 - Document Abstraction
-- این فایل هیچ داده‌ای تغییر نمی‌دهد.
-- =============================================================

-- -------------------------------------------------------------
-- ۱) بررسی وجود document_registry و داده‌های اولیه
-- -------------------------------------------------------------
select
  doc_type,
  physical_table,
  lines_table,
  direction,
  stock_effect,
  is_active
from public.document_registry
where doc_type in ('sale', 'purchase')
order by doc_type;

-- -------------------------------------------------------------
-- ۲) بررسی وجود Viewها
-- -------------------------------------------------------------
select
  table_schema,
  table_name
from information_schema.views
where table_schema = 'public'
  and table_name in ('v_documents', 'v_document_lines')
order by table_name;

-- -------------------------------------------------------------
-- ۳) مقایسه تعداد سندها در source و v_documents
-- باید تعداد sale در view برابر sales و تعداد purchase برابر purchases باشد.
-- -------------------------------------------------------------
select 'sales_source' as source_name, count(*)::bigint as rows_count from public.sales
union all
select 'v_documents_sale' as source_name, count(*)::bigint as rows_count from public.v_documents where doc_type = 'sale'
union all
select 'purchases_source' as source_name, count(*)::bigint as rows_count from public.purchases
union all
select 'v_documents_purchase' as source_name, count(*)::bigint as rows_count from public.v_documents where doc_type = 'purchase'
order by source_name;

-- -------------------------------------------------------------
-- ۴) نمونه خروجی نرمال‌شده v_documents
-- -------------------------------------------------------------
select
  doc_id,
  doc_type,
  physical_table,
  contact_id,
  doc_date,
  subtotal,
  discount_amount,
  total,
  paid_amount,
  status
from public.v_documents
order by doc_date desc
limit 20;

-- -------------------------------------------------------------
-- ۵) مقایسه تعداد اقلام در source و v_document_lines
-- -------------------------------------------------------------
select 'sale_items_source' as source_name, count(*)::bigint as rows_count from public.sale_items
union all
select 'v_document_lines_sale' as source_name, count(*)::bigint as rows_count from public.v_document_lines where doc_type = 'sale'
union all
select 'purchase_items_source' as source_name, count(*)::bigint as rows_count from public.purchase_items
union all
select 'v_document_lines_purchase' as source_name, count(*)::bigint as rows_count from public.v_document_lines where doc_type = 'purchase'
order by source_name;

-- -------------------------------------------------------------
-- ۶) نمونه خروجی نرمال‌شده v_document_lines
-- -------------------------------------------------------------
select
  line_id,
  doc_id,
  doc_type,
  product_id,
  product_variant_id,
  qty,
  unit_price,
  discount,
  line_total
from public.v_document_lines
order by doc_type, doc_id
limit 20;

-- -------------------------------------------------------------
-- ۷) بررسی snapshot بودن قیمت خط سند
-- اگر unit_price ستون مستقل و مقداردهی‌شده دارد، تغییر قیمت محصول فاکتور قدیمی را تغییر نمی‌دهد.
-- این کوئری تعداد اقلام با unit_price صفر یا null را نشان می‌دهد.
-- -------------------------------------------------------------
select
  'sale_items' as table_name,
  count(*) filter (where unit_price is null) as null_unit_price,
  count(*) filter (where unit_price = 0) as zero_unit_price,
  count(*) as total_rows
from public.sale_items
union all
select
  'purchase_items' as table_name,
  count(*) filter (where unit_price is null) as null_unit_price,
  count(*) filter (where unit_price = 0) as zero_unit_price,
  count(*) as total_rows
from public.purchase_items;

-- -------------------------------------------------------------
-- ۸) بررسی اینکه product_id از product_variants قابل استخراج است
-- orphan_variant_rows باید صفر باشد مگر داده قدیمی ناسالم وجود داشته باشد.
-- -------------------------------------------------------------
select
  doc_type,
  count(*) filter (where product_variant_id is not null and product_id is null) as orphan_variant_rows,
  count(*) as total_rows
from public.v_document_lines
group by doc_type
order by doc_type;

-- -------------------------------------------------------------
-- ۹) بررسی statusهای فعلی source برای تحلیل سازگاری
-- -------------------------------------------------------------
select 'sales' as table_name, status, count(*)::bigint as rows_count
from public.sales
group by status
union all
select 'purchases' as table_name, status, count(*)::bigint as rows_count
from public.purchases
group by status
order by table_name, status;

-- -------------------------------------------------------------
-- ۱۰) بررسی ستون‌های افزوده شده/موجود در sales و purchases
-- -------------------------------------------------------------
select
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('sales', 'purchases')
  and column_name in ('status', 'branch_id', 'warehouse_id', 'reversed_at', 'reversed_by')
order by table_name, column_name;
