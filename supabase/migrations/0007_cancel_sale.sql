-- =============================================================
-- Hesabyar ERP - Atomic Sale Cancellation
-- نسخه: 0007 | بعد از 0006 اجرا شود
-- هدف: ابطال اتمیک فاکتور فروش با برگشت موجودی و خنثی‌سازی پرداخت‌ها
-- این migration backward-compatible است.
-- =============================================================

-- -------------------------------------------------------------
-- ابطال فاکتور فروش
-- رفتار:
--   ۱) چک دسترسی و مالکیت سازمان
--   ۲) جلوگیری از ابطال دوباره
--   ۳) برگشت موجودی برای هر قلم (stock_movement معکوس)
--   ۴) خنثی‌سازی دریافت‌های مرتبط با ثبت reverse entry (حفظ audit trail)
--   ۵) تغییر وضعیت فاکتور به cancelled
-- -------------------------------------------------------------
create or replace function public.cancel_sale(
  p_sale uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_sale record;
  v_item record;
  v_tx record;
begin
  if not public.has_permission('sales.create') then
    raise exception 'دسترسی ابطال فاکتور وجود ندارد';
  end if;

  select * into v_sale from public.sales where id = p_sale for update;
  if not found then
    raise exception 'فاکتور فروش یافت نشد';
  end if;
  if not (v_sale.org_id in (select public.user_org_ids())) then
    raise exception 'دسترسی غیرمجاز';
  end if;
  if v_sale.status = 'cancelled' then
    raise exception 'این فاکتور قبلاً ابطال شده است';
  end if;

  -- ۳) برگشت موجودی: برای هر قلم، حرکت ورودی معادل ثبت می‌شود.
  -- trigger apply_stock_movement خودکار stock_qty را بالا می‌برد.
  for v_item in
    select variant_id, qty from public.sale_items where sale_id = p_sale
  loop
    insert into public.stock_movements(org_id, branch_id, variant_id, type, reason, qty, ref_table, ref_id, note, created_by)
    values (v_sale.org_id, v_sale.branch_id, v_item.variant_id, 'in', 'return', v_item.qty, 'sales', p_sale,
            'برگشت موجودی بابت ابطال فاکتور ' || coalesce(v_sale.invoice_no, ''), v_uid);
  end loop;

  -- ۴) خنثی‌سازی دریافت‌های مرتبط: برای هر receipt یک payment معادل ثبت می‌شود
  -- تا مانده حساب صندوق/مشتری درست بماند و سوابق حذف نشود.
  for v_tx in
    select * from public.transactions
    where sale_id = p_sale and type = 'receipt'
  loop
    insert into public.transactions(org_id, branch_id, type, amount, date, account_id, contact_id, sale_id, ref_table, ref_id, method, note, created_by)
    values (v_tx.org_id, v_tx.branch_id, 'payment', v_tx.amount, now(), v_tx.account_id, v_tx.contact_id, p_sale, 'sales', p_sale, v_tx.method,
            'خنثی‌سازی دریافت بابت ابطال فاکتور ' || coalesce(v_sale.invoice_no, ''), v_uid);
  end loop;

  -- ۵) تغییر وضعیت و صفر کردن نسیه (بدهی مشتری بابت این فاکتور حذف می‌شود)
  update public.sales
    set status = 'cancelled',
        paid_credit = 0,
        note = case
                 when p_reason is null or p_reason = '' then note
                 else coalesce(note || ' | ', '') || 'ابطال: ' || p_reason
               end,
        updated_at = now()
    where id = p_sale;

  -- ثبت لاگ فعالیت (در صورت وجود جدول)
  insert into public.activity_logs(org_id, user_id, action, entity_type, entity_id, new_data)
  values (v_sale.org_id, v_uid, 'cancel', 'sale', p_sale, jsonb_build_object('reason', p_reason, 'invoice_no', v_sale.invoice_no));
end;
$$;

-- =============================================================
-- پایان migration 0007
-- =============================================================
