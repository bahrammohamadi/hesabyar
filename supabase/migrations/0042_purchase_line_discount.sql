-- 0042 — تخفیف هر قلم در فاکتور خرید
--
-- چرا لازم شد؟
--   فاکتور فروش از مهاجرت‌های اول تخفیف سطری داشت (sale_items.discount)
--   ولی خرید نداشت. کاربر خواست «قیمت و تخفیف در خرید هم مثل فروش
--   قابل تنظیم باشد». بدون ستون discount، تنها راه این بود که کاربر
--   خودش قیمت خرید را دستی کم کند — یعنی قیمت واقعیِ توافق‌شده با
--   تأمین‌کننده در سند گم می‌شد و گزارش «چقدر تخفیف گرفتیم» ممکن نبود.
--
-- ⚠️ کاملاً افزایشی است:
--   • ستون جدید `default 0 not null` → همه‌ی ردیف‌های موجود صفر می‌گیرند
--   • امضای هیچ تابعی عوض نمی‌شود (تخفیف داخل همان p_items jsonb می‌آید)
--     پس تله‌ی overload/PGRST203 که در 0030 خوردیم اینجا رخ نمی‌دهد
--   • فراخوانی‌های قدیمی که کلید discount ندارند → coalesce(...,0)

alter table public.purchase_items
  add column if not exists discount bigint not null default 0;

comment on column public.purchase_items.discount is 'تخفیف این قلم به ریال. line_total = qty*unit_price - discount';

-- -------------------------------------------------------------
-- create_purchase — همان امضا، با احتساب تخفیف سطری
-- -------------------------------------------------------------
create or replace function public.create_purchase(
  p_org uuid,
  p_branch uuid,
  p_supplier uuid,
  p_items jsonb,
  p_extra_total bigint default 0,
  p_discount bigint default 0,
  p_tax bigint default 0,
  p_paid bigint default 0,
  p_account uuid default null,
  p_note text default null,
  p_date timestamptz default now(),
  p_discount_type text default 'fixed',
  p_discount_value numeric default null,
  p_paid_cash bigint default null,
  p_paid_card bigint default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_purchase uuid;
  v_subtotal bigint := 0;
  v_discount bigint := 0;
  v_total bigint := 0;
  v_inv text;
  it jsonb;
  v_line bigint;
  v_line_discount bigint;
  v_cash bigint;
  v_card bigint;
  v_paid_total bigint;
begin
  if not public.has_permission('purchases.create') then
    raise exception 'دسترسی ثبت خرید وجود ندارد';
  end if;
  if not (p_org in (select public.user_org_ids())) then
    raise exception 'دسترسی غیرمجاز به سازمان';
  end if;

  if p_paid_cash is null and p_paid_card is null then
    v_cash := greatest(coalesce(p_paid, 0), 0);
    v_card := 0;
  else
    v_cash := greatest(coalesce(p_paid_cash, 0), 0);
    v_card := greatest(coalesce(p_paid_card, 0), 0);
  end if;
  v_paid_total := v_cash + v_card;

  /*
    جمع اقلام **پس از** کسر تخفیف سطری — دقیقاً همان قاعده‌ی create_sale.
    least(...) لازم است: تخفیف بزرگ‌تر از مبلغ سطر، جمع فاکتور را منفی
    می‌کرد و سند بی‌معنا می‌شد. سمت کلاینت هم محدود می‌شود ولی به
    ورودی کلاینت اعتماد نمی‌کنیم.
  */
  for it in select * from jsonb_array_elements(p_items)
  loop
    v_line := (it->>'unit_price')::bigint * (it->>'qty')::int;
    v_line_discount := least(greatest(coalesce((it->>'discount')::bigint, 0), 0), v_line);
    v_subtotal := v_subtotal + (v_line - v_line_discount);
  end loop;

  if p_discount_type = 'percent' then
    v_discount := round((v_subtotal::numeric * coalesce(p_discount_value,0)) / 100)::bigint;
  else
    v_discount := coalesce(p_discount,0);
  end if;

  v_total := greatest(0, v_subtotal + coalesce(p_extra_total,0) - v_discount + coalesce(p_tax,0));
  v_inv := public.next_invoice_no(p_org, 'P', 'purchases');

  insert into public.purchases(org_id, branch_id, supplier_id, invoice_no, date,
    subtotal, extra_total, discount, discount_type, discount_value, tax, total, paid, status, note, created_by)
  values (p_org, p_branch, p_supplier, v_inv, p_date,
    v_subtotal, p_extra_total, v_discount, p_discount_type,
    coalesce(p_discount_value, case when p_discount_type='fixed' then v_discount else 0 end),
    p_tax, v_total, v_paid_total, 'confirmed', p_note, v_uid)
  returning id into v_purchase;

  for it in select * from jsonb_array_elements(p_items)
  loop
    v_line := (it->>'unit_price')::bigint * (it->>'qty')::int;
    v_line_discount := least(greatest(coalesce((it->>'discount')::bigint, 0), 0), v_line);

    insert into public.purchase_items(org_id, branch_id, purchase_id, variant_id, qty, unit_price, discount, line_total, created_by)
    values (p_org, p_branch, v_purchase, (it->>'variant_id')::uuid, (it->>'qty')::int,
            (it->>'unit_price')::bigint, v_line_discount, v_line - v_line_discount, v_uid);

    insert into public.stock_movements(org_id, branch_id, variant_id, type, reason, qty, ref_table, ref_id, created_by)
    values (p_org, p_branch, (it->>'variant_id')::uuid, 'in', 'purchase', (it->>'qty')::int, 'purchases', v_purchase, v_uid);

    update public.product_variants
      set purchase_price = (it->>'unit_price')::bigint,
          sale_price = case when it ? 'sale_price' then (it->>'sale_price')::bigint else sale_price end,
          updated_at = now()
      where id = (it->>'variant_id')::uuid;
  end loop;

  if v_cash > 0 then
    insert into public.transactions(org_id, branch_id, type, amount, date, account_id, contact_id, purchase_id, ref_table, ref_id, method, note, created_by)
    values (p_org, p_branch, 'payment', v_cash, p_date, p_account, p_supplier, v_purchase, 'purchases', v_purchase, 'cash', 'پرداخت نقدی بابت خرید '||v_inv, v_uid);
  end if;

  if v_card > 0 then
    insert into public.transactions(org_id, branch_id, type, amount, date, account_id, contact_id, purchase_id, ref_table, ref_id, method, note, created_by)
    values (p_org, p_branch, 'payment', v_card, p_date, p_account, p_supplier, v_purchase, 'purchases', v_purchase, 'card', 'پرداخت کارتی بابت خرید '||v_inv, v_uid);
  end if;

  return v_purchase;
end;
$function$;

-- -------------------------------------------------------------
-- update_purchase_invoice — همان قاعده در ویرایش
-- -------------------------------------------------------------
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
  v_line_discount bigint := 0;
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
    v_line_discount := least(greatest(coalesce((it->>'discount')::bigint, 0), 0), v_line);
    v_subtotal := v_subtotal + (v_line - v_line_discount);
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

  for v_old_item in select * from public.purchase_items where purchase_id = p_purchase
  loop
    insert into public.stock_movements(
      org_id, branch_id, variant_id, type, reason, qty, ref_table, ref_id, note, created_by
    ) values (
      v_old_item.org_id, v_old_item.branch_id, v_old_item.variant_id,
      'out', 'manual', -1 * v_old_item.qty,
      'purchase_edit_reverse', p_purchase,
      'برگشت موجودی برای ویرایش خرید', v_uid
    );
  end loop;

  delete from public.purchase_items where purchase_id = p_purchase;

  for it in select * from jsonb_array_elements(p_items)
  loop
    v_line := (it->>'unit_price')::bigint * (it->>'qty')::int;
    v_line_discount := least(greatest(coalesce((it->>'discount')::bigint, 0), 0), v_line);

    insert into public.purchase_items(
      org_id, branch_id, purchase_id, variant_id, qty, unit_price, discount, line_total, created_by
    ) values (
      v_purchase.org_id, v_purchase.branch_id, p_purchase,
      (it->>'variant_id')::uuid, (it->>'qty')::int,
      (it->>'unit_price')::bigint, v_line_discount, v_line - v_line_discount, v_uid
    );

    insert into public.stock_movements(
      org_id, branch_id, variant_id, type, reason, qty, ref_table, ref_id, note, created_by
    ) values (
      v_purchase.org_id, v_purchase.branch_id, (it->>'variant_id')::uuid,
      'in', 'purchase', (it->>'qty')::int,
      'purchase_edit', p_purchase,
      'ورود موجودی پس از ویرایش خرید', v_uid
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
    v_purchase.org_id, v_uid, 'update', 'purchase', p_purchase,
    jsonb_build_object('total', v_purchase.total, 'supplier_id', v_purchase.supplier_id, 'date', v_purchase.date),
    jsonb_build_object('total', v_total, 'supplier_id', p_supplier, 'date', p_date, 'items_count', jsonb_array_length(p_items))
  );
end;
$$;
