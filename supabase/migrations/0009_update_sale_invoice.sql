-- =============================================================
-- Hesabyar ERP - Update Sale Invoice RPC
-- نسخه: 0009
-- هدف: ویرایش امن و اتمیک فاکتور فروش پس از ثبت
-- =============================================================

create or replace function public.update_sale_invoice(
  p_sale uuid,
  p_customer uuid,
  p_date timestamptz,
  p_items jsonb,
  p_discount_type text default 'fixed',
  p_discount_value numeric default 0,
  p_discount bigint default 0,
  p_tax bigint default 0,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_sale record;
  v_old_item record;
  it jsonb;
  v_subtotal bigint := 0;
  v_discount bigint := 0;
  v_total bigint := 0;
  v_line bigint := 0;
  v_paid_total bigint := 0;
  v_balance bigint := 0;
begin
  if not public.has_permission('sales.create') then
    raise exception 'دسترسی ویرایش فاکتور فروش وجود ندارد';
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
    raise exception 'فاکتور باطل‌شده قابل ویرایش نیست';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'فاکتور باید حداقل یک آیتم داشته باشد';
  end if;

  -- محاسبه جمع جدید و اعتبارسنجی آیتم‌ها
  for it in select * from jsonb_array_elements(p_items)
  loop
    if coalesce((it->>'qty')::int, 0) <= 0 then
      raise exception 'تعداد آیتم نامعتبر است';
    end if;
    if coalesce((it->>'unit_price')::bigint, 0) < 0 then
      raise exception 'قیمت آیتم نامعتبر است';
    end if;
    v_line := ((it->>'unit_price')::bigint * (it->>'qty')::int) - coalesce((it->>'discount')::bigint, 0);
    if v_line < 0 then
      raise exception 'جمع ردیف نمی‌تواند منفی باشد';
    end if;
    v_subtotal := v_subtotal + v_line;
  end loop;

  if p_discount_type = 'percent' then
    v_discount := round((v_subtotal::numeric * coalesce(p_discount_value, 0)) / 100)::bigint;
  else
    v_discount := coalesce(p_discount, 0);
  end if;

  v_total := greatest(0, v_subtotal - v_discount + coalesce(p_tax, 0));

  select coalesce(sum(amount), 0)::bigint into v_paid_total
  from public.transactions
  where sale_id = p_sale and type = 'receipt';

  v_balance := greatest(v_total - v_paid_total, 0);

  if v_balance > 0 and p_customer is null then
    raise exception 'برای فاکتور دارای مانده، انتخاب مشتری الزامی است';
  end if;

  -- برگشت موجودی قبلی
  for v_old_item in select * from public.sale_items where sale_id = p_sale
  loop
    insert into public.stock_movements(
      org_id, branch_id, variant_id, type, reason, qty, ref_table, ref_id, note, created_by
    ) values (
      v_old_item.org_id,
      v_old_item.branch_id,
      v_old_item.variant_id,
      'in',
      'manual',
      v_old_item.qty,
      'sales_edit_reverse',
      p_sale,
      'برگشت موجودی برای ویرایش فاکتور',
      v_uid
    );
  end loop;

  delete from public.sale_items where sale_id = p_sale;

  -- ثبت آیتم‌های جدید و خروج موجودی جدید
  for it in select * from jsonb_array_elements(p_items)
  loop
    v_line := ((it->>'unit_price')::bigint * (it->>'qty')::int) - coalesce((it->>'discount')::bigint, 0);

    insert into public.sale_items(
      org_id, branch_id, sale_id, variant_id, qty, unit_price, discount, line_total, cost_price, created_by
    ) values (
      v_sale.org_id,
      v_sale.branch_id,
      p_sale,
      (it->>'variant_id')::uuid,
      (it->>'qty')::int,
      (it->>'unit_price')::bigint,
      coalesce((it->>'discount')::bigint, 0),
      v_line,
      coalesce((it->>'cost_price')::bigint, 0),
      v_uid
    );

    insert into public.stock_movements(
      org_id, branch_id, variant_id, type, reason, qty, ref_table, ref_id, note, created_by
    ) values (
      v_sale.org_id,
      v_sale.branch_id,
      (it->>'variant_id')::uuid,
      'out',
      'sale',
      -1 * (it->>'qty')::int,
      'sales_edit',
      p_sale,
      'خروج موجودی پس از ویرایش فاکتور',
      v_uid
    );
  end loop;

  update public.sales
  set customer_id = p_customer,
      date = coalesce(p_date, v_sale.date),
      subtotal = v_subtotal,
      discount = v_discount,
      discount_type = p_discount_type,
      discount_value = coalesce(p_discount_value, 0),
      tax = coalesce(p_tax, 0),
      total = v_total,
      paid_credit = v_balance,
      note = p_note,
      updated_at = now()
  where id = p_sale;

  insert into public.activity_logs(org_id, user_id, action, entity_type, entity_id, old_data, new_data)
  values (
    v_sale.org_id,
    v_uid,
    'update',
    'sale',
    p_sale,
    jsonb_build_object('total', v_sale.total, 'customer_id', v_sale.customer_id, 'date', v_sale.date),
    jsonb_build_object('total', v_total, 'customer_id', p_customer, 'date', p_date, 'items_count', jsonb_array_length(p_items))
  );
end;
$$;
