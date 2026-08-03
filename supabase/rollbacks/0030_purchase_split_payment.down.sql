-- بازگردانی 0030 — حذف تفکیک نقدی/کارتی از create_purchase
--
-- ⚠️ ترتیب مهم است: نسخه‌ی جدید دو پارامتر اضافه دارد، پس امضای
-- متفاوتی است و یک تابع *مجزا* در دیتابیس ساخته می‌شود. باید صریحاً
-- drop شود، وگرنه هر دو نسخه کنار هم می‌مانند و فراخوانی‌های بدون
-- پارامترهای جدید مبهم (ambiguous) می‌شوند.

drop function if exists public.create_purchase(
  uuid, uuid, uuid, jsonb, bigint, bigint, bigint, bigint, uuid, text, timestamptz, text, numeric, bigint, bigint
);

-- بازگردانی نسخه‌ی قبلی، دقیقاً همان‌طور که بود.
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
  p_discount_value numeric default null
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
begin
  if not public.has_permission('purchases.create') then
    raise exception 'دسترسی ثبت خرید وجود ندارد';
  end if;
  if not (p_org in (select public.user_org_ids())) then
    raise exception 'دسترسی غیرمجاز به سازمان';
  end if;

  for it in select * from jsonb_array_elements(p_items)
  loop
    v_subtotal := v_subtotal + ((it->>'unit_price')::bigint * (it->>'qty')::int);
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
    p_tax, v_total, p_paid, 'confirmed', p_note, v_uid)
  returning id into v_purchase;

  for it in select * from jsonb_array_elements(p_items)
  loop
    v_line := (it->>'unit_price')::bigint * (it->>'qty')::int;

    insert into public.purchase_items(org_id, branch_id, purchase_id, variant_id, qty, unit_price, line_total, created_by)
    values (p_org, p_branch, v_purchase, (it->>'variant_id')::uuid, (it->>'qty')::int,
            (it->>'unit_price')::bigint, v_line, v_uid);

    insert into public.stock_movements(org_id, branch_id, variant_id, type, reason, qty, ref_table, ref_id, created_by)
    values (p_org, p_branch, (it->>'variant_id')::uuid, 'in', 'purchase', (it->>'qty')::int, 'purchases', v_purchase, v_uid);

    update public.product_variants
      set purchase_price = (it->>'unit_price')::bigint,
          sale_price = case when it ? 'sale_price' then (it->>'sale_price')::bigint else sale_price end,
          updated_at = now()
      where id = (it->>'variant_id')::uuid;
  end loop;

  if coalesce(p_paid,0) > 0 then
    insert into public.transactions(org_id, branch_id, type, amount, date, account_id, contact_id, purchase_id, ref_table, ref_id, method, note, created_by)
    values (p_org, p_branch, 'payment', p_paid, p_date, p_account, p_supplier, v_purchase, 'purchases', v_purchase, 'cash', 'پرداخت بابت خرید '||v_inv, v_uid);
  end if;

  return v_purchase;
end;
$function$;
