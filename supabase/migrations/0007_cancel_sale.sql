-- =============================================================
-- Hesabyar ERP - Cancel Sale RPC
-- نسخه: 0007
-- هدف: ابطال امن فاکتور فروش، برگشت موجودی و خنثی‌سازی پرداخت‌ها
-- =============================================================

alter table public.sales
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references auth.users(id),
  add column if not exists cancel_reason text;

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

  select * into v_sale
  from public.sales
  where id = p_sale
  for update;

  if not found then
    raise exception 'فاکتور فروش یافت نشد';
  end if;

  if not (v_sale.org_id in (select public.user_org_ids())) then
    raise exception 'دسترسی غیرمجاز';
  end if;

  if v_sale.status = 'cancelled' then
    return;
  end if;

  -- برگشت موجودی اقلام فروش: فروش قبلی خروج بوده، ابطال باید ورود ایجاد کند.
  for v_item in
    select * from public.sale_items where sale_id = p_sale
  loop
    insert into public.stock_movements(
      org_id, branch_id, variant_id, type, reason, qty, ref_table, ref_id, note, created_by
    ) values (
      v_item.org_id,
      v_item.branch_id,
      v_item.variant_id,
      'in',
      'return',
      v_item.qty,
      'sales_cancel',
      p_sale,
      coalesce(p_reason, 'ابطال فاکتور فروش'),
      v_uid
    );
  end loop;

  -- خنثی‌سازی دریافت‌های ثبت‌شده برای این فاکتور، برای اصلاح صندوق/بانک و مانده مشتری.
  for v_tx in
    select * from public.transactions
    where sale_id = p_sale and type = 'receipt'
  loop
    insert into public.transactions(
      org_id, branch_id, type, amount, date, account_id, contact_id, sale_id,
      ref_table, ref_id, method, note, created_by
    ) values (
      v_tx.org_id,
      v_tx.branch_id,
      'payment',
      v_tx.amount,
      now(),
      v_tx.account_id,
      v_tx.contact_id,
      p_sale,
      'sales_cancel',
      p_sale,
      v_tx.method,
      coalesce(p_reason, 'برگشت دریافت بابت ابطال فاکتور') || coalesce(' - ' || v_sale.invoice_no, ''),
      v_uid
    );
  end loop;

  update public.sales
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = v_uid,
      cancel_reason = p_reason,
      updated_at = now()
  where id = p_sale;
end;
$$;
