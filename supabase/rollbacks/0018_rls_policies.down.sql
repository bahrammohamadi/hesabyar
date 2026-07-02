-- =============================================================
-- Hesabyar Rollback 0018 - حذف policyهای افزوده‌شده در 0018
-- ایمنی: RLS خاموش نمی‌شود و policy legacy org_isolation حذف نمی‌شود.
-- =============================================================

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sales','sale_items','purchases','purchase_items','contacts','products','product_variants','transactions','stock_movements'
  ]
  LOOP
    EXECUTE format('drop policy if exists %I on public.%I;', 'p_' || t || '_service_role_all', t);
    EXECUTE format('drop policy if exists %I on public.%I;', 'p_' || t || '_auth_select_org', t);
    EXECUTE format('drop policy if exists %I on public.%I;', 'p_' || t || '_auth_insert_org', t);
    EXECUTE format('drop policy if exists %I on public.%I;', 'p_' || t || '_auth_update_org', t);
  END LOOP;
END $$;

-- =============================================================
-- پایان DOWN migration 0018
-- =============================================================
