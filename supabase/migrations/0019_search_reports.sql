-- =============================================================
-- Hesabyar Migration 0019 - Global Search + View-based Reports
-- نوع: UP migration کم‌ریسک
-- ایمنی: فقط index/view/RPC خواندنی، بدون حذف/تغییر داده، بدون trigger
-- =============================================================

-- -------------------------------------------------------------
-- بخش ۱) ایندکس‌های جستجو با pg_trgm
-- ستون‌های واقعی طبق گزارش گام صفر:
-- contacts: name, phone, code
-- products: name, code
-- product_variants: sku, barcode
-- sales/purchases: invoice_no
-- -------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_contacts_name_trgm
  ON public.contacts USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_contacts_phone_trgm
  ON public.contacts USING gin (phone gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_contacts_code_trgm
  ON public.contacts USING gin (code gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_name_trgm
  ON public.products USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_code_trgm
  ON public.products USING gin (code gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_product_variants_sku_trgm
  ON public.product_variants USING gin (sku gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_product_variants_barcode_trgm
  ON public.product_variants USING gin (barcode gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_sales_invoice_no_trgm
  ON public.sales USING gin (invoice_no gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_purchases_invoice_no_trgm
  ON public.purchases USING gin (invoice_no gin_trgm_ops);

-- -------------------------------------------------------------
-- بخش ۲) RPC جستجوی سراسری
-- SECURITY DEFINER است اما برای جلوگیری از نشت بین سازمان‌ها، org_id دستی با user_org_ids فیلتر می‌شود.
-- service_role بدون auth.uid نتیجه‌ای نمی‌گیرد مگر در context کاربر استفاده شود؛ این برای جلوگیری از leak عمدی است.
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_global_search(q text, p_limit int DEFAULT 20)
RETURNS TABLE(
  result_type text,
  id uuid,
  title text,
  subtitle text,
  meta jsonb,
  score real
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH params AS (
    SELECT trim(coalesce(q,'')) AS term, greatest(coalesce(p_limit,20),1) AS lim
  ), results AS (
    -- اشخاص
    SELECT
      'contact'::text AS result_type,
      c.id,
      c.name::text AS title,
      concat_ws(' • ', nullif(c.phone,''), nullif(c.code,''), c.type)::text AS subtitle,
      jsonb_build_object('phone', c.phone, 'code', c.code, 'type', c.type) AS meta,
      greatest(similarity(coalesce(c.name,''), p.term), similarity(coalesce(c.phone,''), p.term), similarity(coalesce(c.code,''), p.term))::real AS score
    FROM public.contacts c, params p
    WHERE p.term <> ''
      AND c.org_id IN (SELECT public.user_org_ids())
      AND (
        c.name ILIKE '%' || p.term || '%'
        OR coalesce(c.phone,'') ILIKE '%' || p.term || '%'
        OR coalesce(c.code,'') ILIKE '%' || p.term || '%'
        OR similarity(coalesce(c.name,''), p.term) > 0.18
        OR similarity(coalesce(c.phone,''), p.term) > 0.18
        OR similarity(coalesce(c.code,''), p.term) > 0.18
      )

    UNION ALL

    -- کالا / تنوع کالا
    SELECT
      'product'::text AS result_type,
      pdt.id,
      pdt.name::text AS title,
      concat_ws(' • ', nullif(pdt.code,''), nullif(pv.sku,''), nullif(pv.barcode,''))::text AS subtitle,
      jsonb_build_object('product_id', pdt.id, 'variant_id', pv.id, 'code', pdt.code, 'sku', pv.sku, 'barcode', pv.barcode, 'sale_price', pv.sale_price) AS meta,
      greatest(similarity(coalesce(pdt.name,''), prm.term), similarity(coalesce(pdt.code,''), prm.term), similarity(coalesce(pv.sku,''), prm.term), similarity(coalesce(pv.barcode,''), prm.term))::real AS score
    FROM public.products pdt
    LEFT JOIN public.product_variants pv ON pv.product_id = pdt.id
    CROSS JOIN params prm
    WHERE prm.term <> ''
      AND pdt.org_id IN (SELECT public.user_org_ids())
      AND (
        pdt.name ILIKE '%' || prm.term || '%'
        OR coalesce(pdt.code,'') ILIKE '%' || prm.term || '%'
        OR coalesce(pv.sku,'') ILIKE '%' || prm.term || '%'
        OR coalesce(pv.barcode,'') ILIKE '%' || prm.term || '%'
        OR similarity(coalesce(pdt.name,''), prm.term) > 0.18
        OR similarity(coalesce(pdt.code,''), prm.term) > 0.18
        OR similarity(coalesce(pv.sku,''), prm.term) > 0.18
        OR similarity(coalesce(pv.barcode,''), prm.term) > 0.18
      )

    UNION ALL

    -- اسناد فروش
    SELECT
      'document'::text AS result_type,
      s.id,
      coalesce(s.invoice_no, s.id::text)::text AS title,
      concat_ws(' • ', 'فروش', to_char(s.date, 'YYYY-MM-DD'), s.status)::text AS subtitle,
      jsonb_build_object('doc_type','sale','physical_table','sales','total',s.total,'status',s.status) AS meta,
      greatest(similarity(coalesce(s.invoice_no,''), prm.term), CASE WHEN s.id::text ILIKE '%' || prm.term || '%' THEN 0.4 ELSE 0 END)::real AS score
    FROM public.sales s, params prm
    WHERE prm.term <> ''
      AND s.org_id IN (SELECT public.user_org_ids())
      AND (
        coalesce(s.invoice_no,'') ILIKE '%' || prm.term || '%'
        OR s.id::text ILIKE '%' || prm.term || '%'
        OR similarity(coalesce(s.invoice_no,''), prm.term) > 0.18
      )

    UNION ALL

    -- اسناد خرید
    SELECT
      'document'::text AS result_type,
      pr.id,
      coalesce(pr.invoice_no, pr.id::text)::text AS title,
      concat_ws(' • ', 'خرید', to_char(pr.date, 'YYYY-MM-DD'), pr.status)::text AS subtitle,
      jsonb_build_object('doc_type','purchase','physical_table','purchases','total',pr.total,'status',pr.status) AS meta,
      greatest(similarity(coalesce(pr.invoice_no,''), prm.term), CASE WHEN pr.id::text ILIKE '%' || prm.term || '%' THEN 0.4 ELSE 0 END)::real AS score
    FROM public.purchases pr, params prm
    WHERE prm.term <> ''
      AND pr.org_id IN (SELECT public.user_org_ids())
      AND (
        coalesce(pr.invoice_no,'') ILIKE '%' || prm.term || '%'
        OR pr.id::text ILIKE '%' || prm.term || '%'
        OR similarity(coalesce(pr.invoice_no,''), prm.term) > 0.18
      )
  )
  SELECT result_type, id, title, subtitle, meta, score
  FROM results, params
  ORDER BY score DESC, result_type, title
  LIMIT (SELECT lim FROM params);
$$;

COMMENT ON FUNCTION public.fn_global_search(text, int) IS
'جستجوی سراسری contacts/products/documents با pg_trgm و فیلتر org_id بر اساس user_org_ids برای جلوگیری از نشت بین سازمان‌ها.';

GRANT EXECUTE ON FUNCTION public.fn_global_search(text, int) TO authenticated, service_role;

-- -------------------------------------------------------------
-- بخش ۳) Report Views با security_invoker=true
-- تاریخ‌ها میلادی هستند؛ تبدیل شمسی در frontend انجام شود.
-- -------------------------------------------------------------

DROP VIEW IF EXISTS public.v_purchase_summary;
DROP VIEW IF EXISTS public.v_monthly_profit;
DROP VIEW IF EXISTS public.v_top_products;
DROP VIEW IF EXISTS public.v_product_profitability;
DROP VIEW IF EXISTS public.v_customer_debt;
DROP VIEW IF EXISTS public.v_daily_sales;

-- فروش روزانه
CREATE OR REPLACE VIEW public.v_daily_sales
WITH (security_invoker = true)
AS
SELECT
  s.org_id,
  s.date::date AS sale_date,
  count(*)::bigint AS invoice_count,
  coalesce(sum(s.total),0)::bigint AS total_sales,
  coalesce(sum(s.discount),0)::bigint AS total_discount
FROM public.sales s
WHERE coalesce(s.status,'confirmed') NOT IN ('cancelled','returned','reversed')
GROUP BY s.org_id, s.date::date;

COMMENT ON VIEW public.v_daily_sales IS 'گزارش فروش روزانه میلادی؛ تبدیل شمسی در frontend انجام شود.';

-- بدهکاران مشتری
CREATE OR REPLACE VIEW public.v_customer_debt
WITH (security_invoker = true)
AS
SELECT
  c.org_id,
  vcb.contact_id,
  c.name AS contact_name,
  c.phone,
  vcb.total_sales,
  vcb.total_received,
  vcb.balance AS debt_amount,
  vcb.last_activity_at
FROM public.v_contact_balance vcb
JOIN public.contacts c ON c.id = vcb.contact_id
WHERE vcb.balance > 0;

COMMENT ON VIEW public.v_customer_debt IS 'لیست بدهکاران مشتری بر اساس v_contact_balance؛ balance مثبت یعنی بدهکار.';

-- سودآوری کالا/واریانت
CREATE OR REPLACE VIEW public.v_product_profitability
WITH (security_invoker = true)
AS
WITH avg_purchase AS (
  SELECT variant_id, avg(nullif(unit_price,0))::numeric AS avg_purchase_price
  FROM public.purchase_items
  GROUP BY variant_id
), sale_profit AS (
  SELECT
    s.org_id,
    p.id AS product_id,
    pv.id AS product_variant_id,
    p.name AS product_name,
    p.code AS product_code,
    pv.sku,
    pv.barcode,
    sum(si.qty)::numeric AS qty_sold,
    sum((si.unit_price * si.qty) - coalesce(si.discount,0))::numeric AS sales_amount,
    sum(coalesce(nullif(si.cost_price,0), nullif(pv.purchase_price,0), nullif(p.base_purchase_price,0), ap.avg_purchase_price, 0) * si.qty)::numeric AS cost_amount
  FROM public.sale_items si
  JOIN public.sales s ON s.id = si.sale_id
  JOIN public.product_variants pv ON pv.id = si.variant_id
  JOIN public.products p ON p.id = pv.product_id
  LEFT JOIN avg_purchase ap ON ap.variant_id = si.variant_id
  WHERE coalesce(s.status,'confirmed') NOT IN ('cancelled','returned','reversed')
  GROUP BY s.org_id, p.id, pv.id, p.name, p.code, pv.sku, pv.barcode
)
SELECT
  org_id,
  product_id,
  product_variant_id,
  product_name,
  product_code,
  sku,
  barcode,
  qty_sold,
  sales_amount,
  cost_amount,
  (sales_amount - cost_amount)::numeric AS gross_profit,
  CASE WHEN sales_amount <> 0 THEN round(((sales_amount - cost_amount) / sales_amount) * 100, 2) ELSE 0 END AS gross_margin_percent
FROM sale_profit;

COMMENT ON VIEW public.v_product_profitability IS 'سودآوری کالا با اولویت cost_price snapshot سپس purchase_price variant سپس base_purchase_price سپس میانگین خرید.';

-- پرفروش‌ترین کالاها
CREATE OR REPLACE VIEW public.v_top_products
WITH (security_invoker = true)
AS
SELECT
  s.org_id,
  vdl.product_id,
  vdl.product_variant_id,
  p.name AS product_name,
  p.code AS product_code,
  pv.sku,
  pv.barcode,
  sum(vdl.qty)::numeric AS qty_sold,
  sum(vdl.line_total)::numeric AS sales_amount
FROM public.v_document_lines vdl
JOIN public.sales s ON s.id = vdl.doc_id AND vdl.doc_type = 'sale'
LEFT JOIN public.products p ON p.id = vdl.product_id
LEFT JOIN public.product_variants pv ON pv.id = vdl.product_variant_id
WHERE coalesce(s.status,'confirmed') NOT IN ('cancelled','returned','reversed')
GROUP BY s.org_id, vdl.product_id, vdl.product_variant_id, p.name, p.code, pv.sku, pv.barcode;

COMMENT ON VIEW public.v_top_products IS 'پرفروش‌ترین کالاها بر اساس تعداد و مبلغ فروش از v_document_lines.';

-- سود ماهانه میلادی
CREATE OR REPLACE VIEW public.v_monthly_profit
WITH (security_invoker = true)
AS
WITH avg_purchase AS (
  SELECT variant_id, avg(nullif(unit_price,0))::numeric AS avg_purchase_price
  FROM public.purchase_items
  GROUP BY variant_id
), lines AS (
  SELECT
    s.org_id,
    date_trunc('month', s.date)::date AS month_start,
    ((si.unit_price * si.qty) - coalesce(si.discount,0))::numeric AS revenue,
    (coalesce(nullif(si.cost_price,0), nullif(pv.purchase_price,0), nullif(p.base_purchase_price,0), ap.avg_purchase_price, 0) * si.qty)::numeric AS cost
  FROM public.sale_items si
  JOIN public.sales s ON s.id = si.sale_id
  JOIN public.product_variants pv ON pv.id = si.variant_id
  JOIN public.products p ON p.id = pv.product_id
  LEFT JOIN avg_purchase ap ON ap.variant_id = si.variant_id
  WHERE coalesce(s.status,'confirmed') NOT IN ('cancelled','returned','reversed')
)
SELECT
  org_id,
  month_start,
  sum(revenue)::numeric AS sales_amount,
  sum(cost)::numeric AS cost_amount,
  (sum(revenue) - sum(cost))::numeric AS gross_profit
FROM lines
GROUP BY org_id, month_start;

COMMENT ON VIEW public.v_monthly_profit IS 'سود ماهانه بر اساس ماه میلادی؛ تبدیل/گروه‌بندی شمسی در frontend یا view جداگانه انجام شود.';

-- خلاصه خرید
CREATE OR REPLACE VIEW public.v_purchase_summary
WITH (security_invoker = true)
AS
SELECT
  p.org_id,
  p.date::date AS purchase_date,
  date_trunc('month', p.date)::date AS month_start,
  count(*)::bigint AS purchase_count,
  coalesce(sum(p.total),0)::bigint AS total_purchase,
  coalesce(sum(p.discount),0)::bigint AS total_discount
FROM public.purchases p
WHERE coalesce(p.status,'confirmed') NOT IN ('cancelled','reversed')
GROUP BY p.org_id, p.date::date, date_trunc('month', p.date)::date;

COMMENT ON VIEW public.v_purchase_summary IS 'خلاصه خرید روزانه/ماهانه میلادی؛ تبدیل شمسی در frontend انجام شود.';

-- =============================================================
-- پایان UP migration 0019
-- =============================================================
