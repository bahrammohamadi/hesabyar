-- =============================================================
-- تست‌های فقط-خواندنی برای Migration 0014 - Stock Movements
-- این فایل هیچ داده‌ای تغییر نمی‌دهد.
-- =============================================================

-- -------------------------------------------------------------
-- ۱) بررسی ستون‌های کلیدی stock_movements پس از migration
-- -------------------------------------------------------------
select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'stock_movements'
  and column_name in ('type','reason','variant_id','ref_table','ref_id','warehouse_id','balance_after','created_by','qty')
order by ordinal_position;

-- -------------------------------------------------------------
-- ۲) بررسی constraintهای مرتبط با type/reason
-- -------------------------------------------------------------
select
  conname,
  contype,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.stock_movements'::regclass
  and contype = 'c'
order by conname;

-- -------------------------------------------------------------
-- ۳) بررسی وجود v_product_stock
-- -------------------------------------------------------------
select
  table_schema,
  table_name
from information_schema.views
where table_schema = 'public'
  and table_name = 'v_product_stock';

-- -------------------------------------------------------------
-- ۴) نمونه موجودی محاسبه‌شده از v_product_stock
-- -------------------------------------------------------------
select
  product_id,
  product_variant_id,
  current_stock,
  last_movement_at
from public.v_product_stock
order by current_stock desc, last_movement_at desc nulls last
limit 20;

-- -------------------------------------------------------------
-- ۵) مقایسه مجموع موجودی سریع با موجودی محاسبه‌شده
-- باید برابر باشد مگر داده قدیمی ناسازگار وجود داشته باشد.
-- -------------------------------------------------------------
select
  (select coalesce(sum(stock_qty),0)::numeric from public.product_variants) as product_variants_stock_sum,
  (select coalesce(sum(current_stock),0)::numeric from public.v_product_stock) as computed_stock_sum,
  (select coalesce(sum(stock_qty),0)::numeric from public.product_variants)
    -
  (select coalesce(sum(current_stock),0)::numeric from public.v_product_stock) as diff;

-- -------------------------------------------------------------
-- ۶) کوئری تشخیصی مغایرت موجودی به تفکیک variant
-- فقط SELECT؛ هیچ اصلاح خودکار انجام نمی‌دهد.
-- -------------------------------------------------------------
select
  p.id as product_id,
  pv.id as variant_id,
  pv.stock_qty::numeric as stock_field,
  coalesce(vps.current_stock,0)::numeric as computed_stock,
  pv.stock_qty::numeric - coalesce(vps.current_stock,0)::numeric as diff
from public.product_variants pv
join public.products p on p.id = pv.product_id
left join public.v_product_stock vps on vps.product_variant_id = pv.id
where pv.stock_qty::numeric <> coalesce(vps.current_stock,0)::numeric
order by abs(pv.stock_qty::numeric - coalesce(vps.current_stock,0)::numeric) desc, p.name
limit 100;

-- -------------------------------------------------------------
-- ۷) خلاصه تعداد مغایرت‌ها
-- -------------------------------------------------------------
select
  count(*)::bigint as mismatch_count,
  coalesce(sum(abs(pv.stock_qty::numeric - coalesce(vps.current_stock,0)::numeric)),0)::numeric as total_abs_diff
from public.product_variants pv
left join public.v_product_stock vps on vps.product_variant_id = pv.id
where pv.stock_qty::numeric <> coalesce(vps.current_stock,0)::numeric;

-- -------------------------------------------------------------
-- ۸) بررسی وجود تابع RPC
-- -------------------------------------------------------------
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'fn_add_stock_movement';

-- -------------------------------------------------------------
-- ۹) خلاصه type/reason موجود برای sanity check
-- -------------------------------------------------------------
select
  type,
  reason,
  count(*)::bigint as rows_count,
  min(qty) as min_qty,
  max(qty) as max_qty,
  sum(qty)::numeric as sum_qty
from public.stock_movements
group by type, reason
order by rows_count desc, type, reason;
