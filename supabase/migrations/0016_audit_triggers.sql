-- =============================================================
-- Hesabyar Migration 0016 - اتصال Audit Triggers به جداول عملیاتی
-- نوع: UP migration کم‌ریسک
-- ایمنی: idempotent، بدون حذف داده
-- =============================================================

-- -------------------------------------------------------------
-- نکته:
-- fn_audit_trigger از migration 0012 موجود است.
-- این triggerها AFTER هستند و snapshot قبل/بعد را در audit_logs ثبت می‌کنند.
-- -------------------------------------------------------------

-- فروش
DROP TRIGGER IF EXISTS trg_audit_sales ON public.sales;
CREATE TRIGGER trg_audit_sales
  AFTER INSERT OR UPDATE OR DELETE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger('sale');

DROP TRIGGER IF EXISTS trg_audit_sale_items ON public.sale_items;
CREATE TRIGGER trg_audit_sale_items
  AFTER INSERT OR UPDATE OR DELETE ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger('sale_item');

-- خرید
DROP TRIGGER IF EXISTS trg_audit_purchases ON public.purchases;
CREATE TRIGGER trg_audit_purchases
  AFTER INSERT OR UPDATE OR DELETE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger('purchase');

DROP TRIGGER IF EXISTS trg_audit_purchase_items ON public.purchase_items;
CREATE TRIGGER trg_audit_purchase_items
  AFTER INSERT OR UPDATE OR DELETE ON public.purchase_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger('purchase_item');

-- کالا
DROP TRIGGER IF EXISTS trg_audit_products ON public.products;
CREATE TRIGGER trg_audit_products
  AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger('product');

DROP TRIGGER IF EXISTS trg_audit_product_variants ON public.product_variants;
CREATE TRIGGER trg_audit_product_variants
  AFTER INSERT OR UPDATE OR DELETE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger('product_variant');

-- اشخاص
DROP TRIGGER IF EXISTS trg_audit_contacts ON public.contacts;
CREATE TRIGGER trg_audit_contacts
  AFTER INSERT OR UPDATE OR DELETE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger('contact');

-- تراکنش‌ها
DROP TRIGGER IF EXISTS trg_audit_transactions ON public.transactions;
CREATE TRIGGER trg_audit_transactions
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger('transaction');

-- حرکات انبار
-- فقط INSERT/DELETE لاگ می‌شود، نه UPDATE.
-- دلیل: stock_movements باید عملاً append-only باشد و UPDATE آن می‌تواند پرتکرار/پرریسک باشد.
-- کاهش audit روی UPDATE برای جلوگیری از overhead و نویز در جدول audit_logs است.
DROP TRIGGER IF EXISTS trg_audit_stock_movements ON public.stock_movements;
CREATE TRIGGER trg_audit_stock_movements
  AFTER INSERT OR DELETE ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger('stock_movement');

-- =============================================================
-- پایان UP migration 0016
-- =============================================================
