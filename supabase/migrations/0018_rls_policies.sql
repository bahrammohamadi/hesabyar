-- =============================================================
-- Hesabyar Migration 0018 - RLS Policies ایمن و مرحله‌ای
-- نوع: UP migration پرریسک، اما غیرمخرب
-- نکته: RLS از قبل فعال است و policy قدیمی org_isolation وجود دارد.
-- این migration policy قدیمی را حذف نمی‌کند تا دسترسی فعلی اپ ناگهان قطع نشود.
-- =============================================================

-- -------------------------------------------------------------
-- EMERGENCY DISABLE - اگر دسترسی قطع شد از Supabase SQL Editor با نقش مدیریتی اجرا کنید:
-- ALTER TABLE public.sales DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.sale_items DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.purchases DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.purchase_items DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.contacts DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.product_variants DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.transactions DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.stock_movements DISABLE ROW LEVEL SECURITY;
-- -------------------------------------------------------------

-- -------------------------------------------------------------
-- فعال‌سازی RLS، idempotent
-- -------------------------------------------------------------
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------
-- Service Role: دسترسی کامل برای backend/admin
-- service_role در Supabase عملاً bypassrls دارد، اما policy صریح برای مستندسازی و ایمنی اضافه می‌شود.
-- -------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sales','sale_items','purchases','purchase_items','contacts','products','product_variants','transactions','stock_movements'
  ]
  LOOP
    EXECUTE format('drop policy if exists %I on public.%I;', 'p_' || t || '_service_role_all', t);
    EXECUTE format($sql$
      create policy %I on public.%I
      for all
      to service_role
      using (true)
      with check (true);
    $sql$, 'p_' || t || '_service_role_all', t);
  END LOOP;
END $$;

-- -------------------------------------------------------------
-- Authenticated: دسترسی SELECT/INSERT/UPDATE بر اساس org_id کاربر
-- مکانیزم org-scoping: public.user_org_ids() که auth.uid() را با memberships تطبیق می‌دهد.
-- DELETE عمداً در policy جدید مجاز نشده است.
-- توجه: policy legacy org_isolation با cmd=ALL هنوز وجود دارد و در این فاز حذف نشده است.
-- -------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sales','sale_items','purchases','purchase_items','contacts','products','product_variants','transactions','stock_movements'
  ]
  LOOP
    EXECUTE format('drop policy if exists %I on public.%I;', 'p_' || t || '_auth_select_org', t);
    EXECUTE format('drop policy if exists %I on public.%I;', 'p_' || t || '_auth_insert_org', t);
    EXECUTE format('drop policy if exists %I on public.%I;', 'p_' || t || '_auth_update_org', t);

    EXECUTE format($sql$
      create policy %I on public.%I
      for select
      to authenticated
      using (org_id in (select public.user_org_ids()));
    $sql$, 'p_' || t || '_auth_select_org', t);

    EXECUTE format($sql$
      create policy %I on public.%I
      for insert
      to authenticated
      with check (org_id in (select public.user_org_ids()));
    $sql$, 'p_' || t || '_auth_insert_org', t);

    EXECUTE format($sql$
      create policy %I on public.%I
      for update
      to authenticated
      using (org_id in (select public.user_org_ids()))
      with check (org_id in (select public.user_org_ids()));
    $sql$, 'p_' || t || '_auth_update_org', t);
  END LOOP;
END $$;

-- -------------------------------------------------------------
-- granular policies آینده - فقط مستند، فعال نشده:
-- مثال‌ها:
-- sales.confirm      → فقط RPC fn_transition_document و permission table
-- invoice.reverse    → فقط مدیر/owner
-- product.change_price → فقط role دارای permission تغییر قیمت
-- stock.adjust       → فقط انباردار/مدیر
-- finance.manage     → فقط حسابدار/مدیر
-- -------------------------------------------------------------

-- =============================================================
-- پایان UP migration 0018
-- =============================================================
