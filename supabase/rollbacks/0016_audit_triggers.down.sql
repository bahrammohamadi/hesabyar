-- =============================================================
-- Hesabyar Rollback 0016 - حذف غیرمخرب Audit Triggers
-- ایمنی: داده audit_logs و داده عملیاتی حذف نمی‌شود؛ فقط triggerهای audit جدا می‌شوند.
-- =============================================================

DROP TRIGGER IF EXISTS trg_audit_sales ON public.sales;
DROP TRIGGER IF EXISTS trg_audit_sale_items ON public.sale_items;
DROP TRIGGER IF EXISTS trg_audit_purchases ON public.purchases;
DROP TRIGGER IF EXISTS trg_audit_purchase_items ON public.purchase_items;
DROP TRIGGER IF EXISTS trg_audit_products ON public.products;
DROP TRIGGER IF EXISTS trg_audit_product_variants ON public.product_variants;
DROP TRIGGER IF EXISTS trg_audit_contacts ON public.contacts;
DROP TRIGGER IF EXISTS trg_audit_transactions ON public.transactions;
DROP TRIGGER IF EXISTS trg_audit_stock_movements ON public.stock_movements;

-- =============================================================
-- پایان DOWN migration 0016
-- =============================================================
