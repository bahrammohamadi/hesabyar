-- =============================================================
-- Hesabyar Migration 0017 - Workflow Engine اسناد
-- نوع: UP migration ریسک متوسط
-- ایمنی: idempotent، بدون حذف داده، بدون UPDATE مستقیم stock_qty
-- =============================================================

CREATE OR REPLACE FUNCTION public.fn_transition_document(
  p_doc_type text,
  p_doc_id uuid,
  p_new_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid;
  v_doc_type text;
  v_new_status text;
  v_old_status text;
  v_allowed boolean := false;
  v_doc record;
  v_before jsonb;
  v_after jsonb;
  v_stock_already_posted boolean := false;
  v_reverse_already_posted boolean := false;
  it record;
  v_movement_id uuid;
BEGIN
  v_doc_type := lower(trim(coalesce(p_doc_type,'')));
  v_new_status := lower(trim(coalesce(p_new_status,'')));

  IF v_doc_type NOT IN ('sale','purchase') THEN
    RAISE EXCEPTION 'نوع سند نامعتبر است: %', p_doc_type;
  END IF;

  IF p_doc_id IS NULL THEN
    RAISE EXCEPTION 'شناسه سند الزامی است';
  END IF;

  IF v_new_status NOT IN ('confirmed','paid','settled','reversed') THEN
    RAISE EXCEPTION 'وضعیت مقصد نامعتبر است: %', p_new_status;
  END IF;

  BEGIN
    v_uid := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_uid := NULL;
  END;

  IF v_doc_type = 'sale' THEN
    SELECT * INTO v_doc FROM public.sales WHERE id = p_doc_id FOR UPDATE;
  ELSE
    SELECT * INTO v_doc FROM public.purchases WHERE id = p_doc_id FOR UPDATE;
  END IF;

  IF v_doc.id IS NULL THEN
    RAISE EXCEPTION 'سند مورد نظر یافت نشد: % %', v_doc_type, p_doc_id;
  END IF;

  v_old_status := coalesce(v_doc.status, 'confirmed');
  v_before := jsonb_build_object('doc_type', v_doc_type, 'doc_id', p_doc_id, 'status', v_old_status, 'reversed_at', v_doc.reversed_at);

  -- جلوگیری از transition بعد از reverse/cancel legacy
  IF v_old_status IN ('reversed','cancelled','returned') OR v_doc.reversed_at IS NOT NULL THEN
    RAISE EXCEPTION 'این سند قبلاً برگشت/لغو شده و قابل تغییر وضعیت نیست';
  END IF;

  -- جدول transitionهای مجاز
  v_allowed :=
    (v_old_status = 'draft'     AND v_new_status = 'confirmed') OR
    (v_old_status = 'confirmed' AND v_new_status = 'paid') OR
    (v_old_status = 'confirmed' AND v_new_status = 'settled') OR
    (v_old_status = 'paid'      AND v_new_status = 'settled') OR
    (v_old_status = 'confirmed' AND v_new_status = 'reversed') OR
    (v_old_status = 'paid'      AND v_new_status = 'reversed') OR
    (v_old_status = 'settled'   AND v_new_status = 'reversed');

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'انتقال وضعیت غیرمجاز است: % → %', v_old_status, v_new_status;
  END IF;

  -- ورود به confirmed از draft: ثبت stock movement فقط اگر قبلاً برای سند ثبت نشده باشد
  IF v_old_status = 'draft' AND v_new_status = 'confirmed' THEN
    IF v_doc_type = 'sale' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.stock_movements
        WHERE ref_table IN ('sales','sale') AND ref_id = p_doc_id AND reason = 'sale'
      ) INTO v_stock_already_posted;

      IF NOT v_stock_already_posted THEN
        FOR it IN
          SELECT si.*, pv.product_id
          FROM public.sale_items si
          JOIN public.product_variants pv ON pv.id = si.variant_id
          WHERE si.sale_id = p_doc_id
        LOOP
          v_movement_id := public.fn_add_stock_movement(
            it.product_id,
            it.variant_id,
            'sale',
            it.qty,
            'sales',
            p_doc_id::text,
            'ثبت خروج انبار در تایید فاکتور فروش'
          );
        END LOOP;
      END IF;
    ELSE
      SELECT EXISTS (
        SELECT 1 FROM public.stock_movements
        WHERE ref_table IN ('purchases','purchase') AND ref_id = p_doc_id AND reason = 'purchase'
      ) INTO v_stock_already_posted;

      IF NOT v_stock_already_posted THEN
        FOR it IN
          SELECT pi.*, pv.product_id
          FROM public.purchase_items pi
          JOIN public.product_variants pv ON pv.id = pi.variant_id
          WHERE pi.purchase_id = p_doc_id
        LOOP
          v_movement_id := public.fn_add_stock_movement(
            it.product_id,
            it.variant_id,
            'purchase',
            it.qty,
            'purchases',
            p_doc_id::text,
            'ثبت ورود انبار در تایید فاکتور خرید'
          );
        END LOOP;
      END IF;
    END IF;
  END IF;

  -- ورود به reversed: ثبت حرکت معکوس با adjust، بدون update مستقیم stock_qty
  IF v_new_status = 'reversed' THEN
    IF v_doc_type = 'sale' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.stock_movements
        WHERE ref_table = 'sales_reversal' AND ref_id = p_doc_id
      ) INTO v_reverse_already_posted;

      IF v_reverse_already_posted THEN
        RAISE EXCEPTION 'حرکت برگشت این فاکتور فروش قبلاً ثبت شده است';
      END IF;

      FOR it IN
        SELECT si.*, pv.product_id
        FROM public.sale_items si
        JOIN public.product_variants pv ON pv.id = si.variant_id
        WHERE si.sale_id = p_doc_id
      LOOP
        v_movement_id := public.fn_add_stock_movement(
          it.product_id,
          it.variant_id,
          'adjust',
          abs(it.qty),
          'sales_reversal',
          p_doc_id::text,
          'برگشت موجودی در reverse فاکتور فروش'
        );
      END LOOP;

      UPDATE public.sales
        SET status = 'reversed', reversed_at = now(), reversed_by = v_uid, updated_at = now()
      WHERE id = p_doc_id;

    ELSE
      SELECT EXISTS (
        SELECT 1 FROM public.stock_movements
        WHERE ref_table = 'purchases_reversal' AND ref_id = p_doc_id
      ) INTO v_reverse_already_posted;

      IF v_reverse_already_posted THEN
        RAISE EXCEPTION 'حرکت برگشت این فاکتور خرید قبلاً ثبت شده است';
      END IF;

      FOR it IN
        SELECT pi.*, pv.product_id
        FROM public.purchase_items pi
        JOIN public.product_variants pv ON pv.id = pi.variant_id
        WHERE pi.purchase_id = p_doc_id
      LOOP
        v_movement_id := public.fn_add_stock_movement(
          it.product_id,
          it.variant_id,
          'adjust',
          -1 * abs(it.qty),
          'purchases_reversal',
          p_doc_id::text,
          'برگشت موجودی در reverse فاکتور خرید'
        );
      END LOOP;

      UPDATE public.purchases
        SET status = 'reversed', reversed_at = now(), reversed_by = v_uid, updated_at = now()
      WHERE id = p_doc_id;
    END IF;
  ELSE
    IF v_doc_type = 'sale' THEN
      UPDATE public.sales SET status = v_new_status, updated_at = now() WHERE id = p_doc_id;
    ELSE
      UPDATE public.purchases SET status = v_new_status, updated_at = now() WHERE id = p_doc_id;
    END IF;
  END IF;

  v_after := jsonb_build_object('doc_type', v_doc_type, 'doc_id', p_doc_id, 'old_status', v_old_status, 'new_status', v_new_status);

  INSERT INTO public.audit_logs(user_id, entity_type, entity_id, action, before_json, after_json, source, created_at)
  VALUES (
    v_uid,
    v_doc_type,
    p_doc_id::text,
    CASE WHEN v_new_status = 'reversed' THEN 'reverse' ELSE 'update' END,
    v_before,
    v_after,
    'rpc',
    now()
  );

  RETURN jsonb_build_object(
    'ok', true,
    'doc_type', v_doc_type,
    'doc_id', p_doc_id,
    'old_status', v_old_status,
    'new_status', v_new_status,
    'stock_already_posted', v_stock_already_posted
  );
END;
$$;

COMMENT ON FUNCTION public.fn_transition_document(text, uuid, text) IS
'Workflow Engine اسناد: enforce transition، ثبت stock_movement از طریق fn_add_stock_movement، ثبت audit و جلوگیری از double-post/double-reverse.';

GRANT EXECUTE ON FUNCTION public.fn_transition_document(text, uuid, text) TO authenticated, service_role;

-- =============================================================
-- پایان UP migration 0017
-- =============================================================
