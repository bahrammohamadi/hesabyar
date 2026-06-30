-- =============================================================
-- Hesabyar ERP - Update / Cancel Purchase RPCs
-- نسخه: 0011
-- هدف: ویرایش و ابطال امن فاکتور خرید
-- =============================================================

alter table public.purchases
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references auth.users(id),
  add column if not exists cancel_reason text;

create or replace function public.update_purchase_invoice(
  p_purchase uuid,
  p_supplier uuid,
  p_date timestamptz,
  p_items jsonb,
  p_discount_type text default 'fixed',
  p_discount_value numeric default 0,
  p_discount bigint default 0,
  p_tax bigint default 0,
  p_extra_total bigint default 0,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_purchase record;
  v_old_item record;
  it jsonb;
  v_subtotal bigint := 0;
  v_discount bigint := 0;
  v_total bigint := 0;
  v_line bigint := 0;
  v_paid_total bigint := 0;
  v_balance bigint := 0;
begin
  if not public.has_permission('purchases.create') then
    raise exception 'دسترسی ویرایش فاکتور خرید وجود ندارد';
  end if;

  select * into v_purchase
  from public.purchases
  where id = p_purchase
  for update;

  if not found then
    raise exception 'فاکتور خرید یافت نشد';
  end if;

  if not (v_purchase.org_id in (select public.user_org_ids())) then
    raise exception 'دسترسی غیرمجاز';
  end if;

  if v_purchase.status = 'cancelled' then
    raise exception 'فاکتور خرید باطل‌شده قابل ویرایش نیست';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'فاکتور خرید باید حداقل یک آیتم داشته باشد';
  end if;

  for it in select * from jsonb_array_elements(p_items)
  loop
    if coalesce((it->>'qty')::int, 0) <= 0 then
      raise exception 'تعداد آیتم نامعتبر است';
    end if;
    if coalesce((it->>'unit_price')::bigint, 0) < 0 then
      raise exception 'قیمت خرید آیتم نامعتبر است';
    end if;
    v_line := (it->>'unit_price')::bigint * (it->>'qty')::int;
    v_subtotal := v_subtotal + v_line;
  end loop;

  if p_discount_type = 'percent' then
    v_discount := round((v_subtotal::numeric * coalesce(p_discount_value, 0)) / 100)::bigint;
  else
    v_discount := coalesce(p_discount, 0);
  end if;

  v_total := greatest(0, v_subtotal + coalesce(p_extra_total, 0) - v_discount + coalesce(p_tax, 0));

  select coalesce(sum(amount), 0)::bigint into v_paid_total
  from public.transactions
  where purchase_id = p_purchase and type = 'payment';

  v_balance := greatest(v_total - v_paid_total, 0);

  if v_balance > 0 and p_supplier is null then
    raise exception 'برای خرید دارای مانده، انتخاب تأمین‌کننده الزامی است';
  end if;

  -- برگشت موجودی قبلی خرید: خرید قبلی ورود بوده، ویرایش باید خروج معکوس ایجاد کند.
  for v_old_item in select * from public.purchase_items where purchase_id = p_purchase
  loop
    insert into public.stock_movements(
      org_id, branch_id, variant_id, type, reason, qty, ref_table, ref_id, note, created_by
    ) values (
      v_old_item.org_id,
      v_old_item.branch_id,
      v_old_item.variant_id,
      'out',
      'manual',
      -1 * v_old_item.qty,
      'purchase_edit_reverse',
      p_purchase,
      'برگشت موجودی برای ویرایش خرید',
      v_uid
    );
  end loop;

  delete from public.purchase_items where purchase_id = p_purchase;

  for it in select * from jsonb_array_elements(p_items)
  loop
    v_line := (it->>'unit_price')::bigint * (it->>'qty')::int;

    insert into public.purchase_items(
      org_id, branch_id, purchase_id, variant_id, qty, unit_price, line_total, created_by
    ) values (
      v_purchase.org_id,
      v_purchase.branch_id,
      p_purchase,
      (it->>'variant_id')::uuid,
      (it->>'qty')::int,
      (it->>'unit_price')::bigint,
      v_line,
      v_uid
    );

    insert into public.stock_movements(
      org_id, branch_id, variant_id, type, reason, qty, ref_table, ref_id, note, created_by
    ) values (
      v_purchase.org_id,
      v_purchase.branch_id,
      (it->>'variant_id')::uuid,
      'in',
      'purchase',
      (it->>'qty')::int,
      'purchase_edit',
      p_purchase,
      'ورود موجودی پس از ویرایش خرید',
      v_uid
    );

    update public.product_variants
      set purchase_price = (it->>'unit_price')::bigint,
          sale_price = case when it ? 'sale_price' then (it->>'sale_price')::bigint else sale_price end,
          updated_at = now()
      where id = (it->>'variant_id')::uuid;
  end loop;

  update public.purchases
  set supplier_id = p_supplier,
      date = coalesce(p_date, v_purchase.date),
      subtotal = v_subtotal,
      extra_total = coalesce(p_extra_total, 0),
      discount = v_discount,
      discount_type = p_discount_type,
      discount_value = coalesce(p_discount_value, 0),
      tax = coalesce(p_tax, 0),
      total = v_total,
      paid = v_paid_total,
      note = p_note,
      updated_at = now()
  where id = p_purchase;

  insert into public.activity_logs(org_id, user_id, action, entity_type, entity_id, old_data, new_data)
  values (
    v_purchase.org_id,
    v_uid,
    'update',
    'purchase',
    p_purchase,
    jsonb_build_object('total', v_purchase.total, 'supplier_id', v_purchase.supplier_id, 'date', v_purchase.date),
    jsonb_build_object('total', v_total, 'supplier_id', p_supplier, 'date', p_date, 'items_count', jsonb_array_length(p_items))
  );
end;
$$;

create or replace function public.cancel_purchase(
  p_purchase uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_purchase record;
  v_item record;
  v_tx record;
begin
  if not public.has_permission('purchases.create') then
    raise exception 'دسترسی ابطال خرید وجود ندارد';
  end if;

  select * into v_purchase
  from public.purchases
  where id = p_purchase
  for update;

  if not found then
    raise exception 'فاکتور خرید یافت نشد';
  end if;

  if not (v_purchase.org_id in (select public.user_org_ids())) then
    raise exception 'دسترسی غیرمجاز';
  end if;

  if v_purchase.status = 'cancelled' then
    return;
  end if;

  for v_item in select * from public.purchase_items where purchase_id = p_purchase
  loop
    insert into public.stock_movements(
      org_id, branch_id, variant_id, type, reason, qty, ref_table, ref_id, note, created_by
    ) values (
      v_item.org_id,
      v_item.branch_id,
      v_item.variant_id,
      'out',
      'manual',
      -1 * v_item.qty,
      'purchase_cancel',
      p_purchase,
      coalesce(p_reason, 'ابطال خرید'),
      v_uid
    );
  end loop;

  -- خنثی‌سازی پرداخت‌های خرید: پرداخت قبلی از حساب کم کرده، ابطال باید receipt معکوس ثبت کند.
  for v_tx in
    select * from public.transactions
    where purchase_id = p_purchase and type = 'payment'
  loop
    insert into public.transactions(
      org_id, branch_id, type, amount, date, account_id, contact_id, purchase_id,
      ref_table, ref_id, method, note, created_by
    ) values (
      v_tx.org_id,
      v_tx.branch_id,
      'receipt',
      v_tx.amount,
      now(),
      v_tx.account_id,
      v_tx.contact_id,
      p_purchase,
      'purchase_cancel',
      p_purchase,
      v_tx.method,
      coalesce(p_reason, 'برگشت پرداخت بابت ابطال خرید') || coalesce(' - ' || v_purchase.invoice_no, ''),
      v_uid
    );
  end loop;

  update public.purchases
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = v_uid,
      cancel_reason = p_reason,
      updated_at = now()
  where id = p_purchase;

  insert into public.activity_logs(org_id, user_id, action, entity_type, entity_id, old_data, new_data)
  values (
    v_purchase.org_id,
    v_uid,
    'cancel',
    'purchase',
    p_purchase,
    jsonb_build_object('status', v_purchase.status, 'total', v_purchase.total),
    jsonb_build_object('status', 'cancelled', 'reason', p_reason)
  );
end;
$$;
