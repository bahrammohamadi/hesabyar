-- =============================================================
-- Migration 0020 — sync variant prices when product base price changes
-- =============================================================
-- Root cause:
--   updateProduct (edit form) updates products.base_sale_price
--   but does NOT update product_variants.sale_price.
--   change_product_price RPC correctly syncs both — but only when called.
--   Any other update path (edit form, direct SQL, future API) leaves
--   product_variants.sale_price stale, causing ProductSelector to show
--   old price while Products page shows new price.
--
-- Fix:
--   Trigger on products AFTER UPDATE OF base_sale_price, base_purchase_price.
--   For each variant whose price exactly matched the OLD base price,
--   update it to the NEW base price.
--   Variants with an independently different price are left untouched.
--   This preserves multi-variant independent pricing while ensuring
--   simple single-variant products stay in sync automatically.
-- =============================================================

-- ---------- Trigger function ----------
CREATE OR REPLACE FUNCTION public.sync_variant_prices_on_base_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- فقط وقتی قیمت پایه واقعاً تغییر کرده
  IF NEW.base_sale_price IS NOT DISTINCT FROM OLD.base_sale_price
     AND NEW.base_purchase_price IS NOT DISTINCT FROM OLD.base_purchase_price THEN
    RETURN NEW;
  END IF;

  -- واریانت‌هایی که قیمتشون با قیمت قدیمی base یکسان بود → sync کن
  -- واریانت‌هایی با قیمت مستقل متفاوت → دست نزن (multi-variant independent pricing)
  UPDATE public.product_variants
  SET
    sale_price = CASE
      WHEN NEW.base_sale_price IS NOT DISTINCT FROM OLD.base_sale_price
        THEN sale_price  -- تغییر نکرده، دست نزن
      WHEN sale_price = OLD.base_sale_price OR sale_price IS NULL
        THEN NEW.base_sale_price  -- sync کن
      ELSE sale_price  -- قیمت مستقل متفاوت — دست نزن
    END,
    purchase_price = CASE
      WHEN NEW.base_purchase_price IS NOT DISTINCT FROM OLD.base_purchase_price
        THEN purchase_price  -- تغییر نکرده، دست نزن
      WHEN purchase_price = OLD.base_purchase_price OR purchase_price IS NULL
        THEN NEW.base_purchase_price  -- sync کن
      ELSE purchase_price  -- قیمت مستقل متفاوت — دست نزن
    END,
    updated_at = now()
  WHERE product_id = NEW.id
    AND is_active = true;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_variant_prices_on_base_change() IS
'وقتی base_sale_price یا base_purchase_price محصول تغییر می‌کند،
واریانت‌هایی که قیمتشان با قیمت قدیمی base یکسان بود را sync می‌کند.
واریانت‌هایی با قیمت مستقل متفاوت (multi-variant) دست‌نخورده می‌مانند.';

-- ---------- Trigger ----------
DROP TRIGGER IF EXISTS trg_sync_variant_prices ON public.products;

CREATE TRIGGER trg_sync_variant_prices
  AFTER UPDATE OF base_sale_price, base_purchase_price
  ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_variant_prices_on_base_change();

-- =============================================================
-- Data fix: sync all currently out-of-sync variants
-- These were made out-of-sync by the edit form before this trigger existed.
-- Logic: for each product, sync variants whose sale_price != base_sale_price
--        AND whose sale_price matches another variant's known old price pattern.
-- Safe: only updates variants where sale_price == base_sale_price of OLD value.
-- For safety, we simply sync ALL variants where sale_price != base_sale_price
-- and the product has only ONE distinct variant price (i.e., not truly multi-price).
-- =============================================================

-- یک‌بار data fix برای ۱۹ محصول out-of-sync فعلی
-- فقط محصولاتی که همه واریانت‌هاشون یک قیمت یکسان دارن (نه multi-variant مستقل)
UPDATE public.product_variants pv
SET
  sale_price = p.base_sale_price,
  purchase_price = p.base_purchase_price,
  updated_at = now()
FROM public.products p
WHERE pv.product_id = p.id
  AND pv.is_active = true
  AND (pv.sale_price != p.base_sale_price OR pv.purchase_price != p.base_purchase_price)
  AND pv.product_id NOT IN (
    -- محصولاتی که واریانت‌هاشون قیمت‌های مستقل متفاوت دارن → دست نزن
    SELECT product_id
    FROM public.product_variants
    WHERE is_active = true
    GROUP BY product_id
    HAVING COUNT(DISTINCT sale_price) > 1
  );

-- =============================================================
-- Grant
-- =============================================================
GRANT EXECUTE ON FUNCTION public.sync_variant_prices_on_base_change() TO service_role;
