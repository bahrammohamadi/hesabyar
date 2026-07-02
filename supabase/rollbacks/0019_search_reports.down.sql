-- =============================================================
-- Hesabyar Rollback 0019 - حذف غیرمخرب Search/Reports
-- ایمنی: فقط function/view/index حذف می‌شود؛ داده عملیاتی حذف نمی‌شود.
-- =============================================================

DROP FUNCTION IF EXISTS public.fn_global_search(text, int);

DROP VIEW IF EXISTS public.v_purchase_summary;
DROP VIEW IF EXISTS public.v_monthly_profit;
DROP VIEW IF EXISTS public.v_top_products;
DROP VIEW IF EXISTS public.v_product_profitability;
DROP VIEW IF EXISTS public.v_customer_debt;
DROP VIEW IF EXISTS public.v_daily_sales;

DROP INDEX IF EXISTS public.idx_contacts_name_trgm;
DROP INDEX IF EXISTS public.idx_contacts_phone_trgm;
DROP INDEX IF EXISTS public.idx_contacts_code_trgm;
DROP INDEX IF EXISTS public.idx_products_name_trgm;
DROP INDEX IF EXISTS public.idx_products_code_trgm;
DROP INDEX IF EXISTS public.idx_product_variants_sku_trgm;
DROP INDEX IF EXISTS public.idx_product_variants_barcode_trgm;
DROP INDEX IF EXISTS public.idx_sales_invoice_no_trgm;
DROP INDEX IF EXISTS public.idx_purchases_invoice_no_trgm;

-- =============================================================
-- پایان DOWN migration 0019
-- =============================================================
