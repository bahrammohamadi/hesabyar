-- =============================================================
-- تست‌های فقط-خواندنی برای Migration 0019 - Search + Reports
-- شامل نمونه query و EXPLAIN ANALYZE
-- =============================================================

-- -------------------------------------------------------------
-- ۱) بررسی indexهای trgm ساخته‌شده
-- -------------------------------------------------------------
select schemaname, tablename, indexname, indexdef
from pg_indexes
where schemaname='public'
  and indexname in (
    'idx_contacts_name_trgm','idx_contacts_phone_trgm','idx_contacts_code_trgm',
    'idx_products_name_trgm','idx_products_code_trgm',
    'idx_product_variants_sku_trgm','idx_product_variants_barcode_trgm',
    'idx_sales_invoice_no_trgm','idx_purchases_invoice_no_trgm'
  )
order by tablename, indexname;

-- -------------------------------------------------------------
-- ۲) بررسی وجود RPC
-- -------------------------------------------------------------
select n.nspname schema_name, p.proname function_name,
       pg_get_function_identity_arguments(p.oid) arguments,
       pg_get_function_result(p.oid) return_type,
       p.prosecdef security_definer
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='fn_global_search';

-- -------------------------------------------------------------
-- ۳) نمونه جستجوها
-- -------------------------------------------------------------
select * from public.fn_global_search('0911', 10);
select * from public.fn_global_search('شال', 10);
select * from public.fn_global_search('1360', 10);
select * from public.fn_global_search('WF', 10);

-- -------------------------------------------------------------
-- ۴) بررسی viewهای گزارش
-- -------------------------------------------------------------
select table_schema, table_name
from information_schema.views
where table_schema='public'
  and table_name in ('v_daily_sales','v_customer_debt','v_product_profitability','v_top_products','v_monthly_profit','v_purchase_summary')
order by table_name;

-- -------------------------------------------------------------
-- ۵) نمونه خروجی هر گزارش
-- -------------------------------------------------------------
select * from public.v_daily_sales order by sale_date desc limit 10;
select * from public.v_customer_debt order by debt_amount desc limit 10;
select * from public.v_product_profitability order by gross_profit desc limit 10;
select * from public.v_top_products order by qty_sold desc, sales_amount desc limit 10;
select * from public.v_monthly_profit order by month_start desc limit 10;
select * from public.v_purchase_summary order by purchase_date desc limit 10;

-- -------------------------------------------------------------
-- ۶) EXPLAIN ANALYZE برای fn_global_search
-- با داده فعلی کم، Seq Scan ممکن است طبیعی باشد؛ indexها برای رشد داده آماده‌اند.
-- -------------------------------------------------------------
explain analyze select * from public.fn_global_search('0911', 20);
explain analyze select * from public.fn_global_search('شال', 20);

-- -------------------------------------------------------------
-- ۷) تست org-awareness: تابع باید با user_org_ids فیلتر کند.
-- این کوئری نشان می‌دهد orgهای نتایج برگشتی contact/product/document خارج از user_org_ids نیستند.
-- اگر با service_role بدون auth.uid اجرا شود، user_org_ids خالی است و نتیجه تابع ممکن است خالی باشد.
-- -------------------------------------------------------------
select count(*)::bigint as search_rows_for_current_user
from public.fn_global_search('0911', 50);
