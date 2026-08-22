-- 0054 — اتصال سری ساخت به فاکتور خرید
--
-- 🔴 بدون این، مهاجرت ۰۰۵۳ نیمه‌کاره بود: جدول بچ وجود داشت ولی
--   هیچ راهی برای **پر کردنش** از جریان عادی کار نبود، پس گزارش
--   انقضا همیشه خالی می‌ماند.
--
-- ⚠️ تعریف تابع از `pg_get_functiondef` گرفته شده نه از فایل
--   مهاجرت. `create_purchase` در پنج مهاجرت پیاپی بازنویسی شده
--   (۰۰۰۲ ← ۰۰۰۶ ← ۰۰۳۰ ← ۰۰۴۲ ← ۰۰۴۶ ← ۰۰۴۹) و آخرین نسخه فقط
--   در دیتابیس است. برداشتن نسخه‌ی قدیمی، تخفیف سطری و سرشکن
--   هزینه‌ی حمل را از بین می‌برد.
--
-- ⚠️ امضای تابع **عوض نشده** — بچ داخل `p_items` می‌آید. تغییر
--   امضا در Postgres یک overload تازه می‌سازد و PostgREST خطای
--   PGRST203 می‌دهد.

CREATE OR REPLACE FUNCTION public.create_purchase(p_org uuid, p_branch uuid, p_supplier uuid, p_items jsonb, p_extra_total bigint DEFAULT 0, p_discount bigint DEFAULT 0, p_tax bigint DEFAULT 0, p_paid bigint DEFAULT 0, p_account uuid DEFAULT NULL::uuid, p_note text DEFAULT NULL::text, p_date timestamp with time zone DEFAULT now(), p_discount_type text DEFAULT 'fixed'::text, p_discount_value numeric DEFAULT NULL::numeric, p_paid_cash bigint DEFAULT NULL::bigint, p_paid_card bigint DEFAULT NULL::bigint)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_batch uuid;
  v_uid uuid := auth.uid();
  v_purchase uuid;
  v_subtotal bigint := 0;
  v_discount bigint := 0;
  v_total bigint := 0;
  v_inv text;
  it jsonb;
  v_line bigint;
  v_line_discount bigint;
  v_line_net bigint;
  v_cash bigint;
  v_card bigint;
  v_paid_total bigint;
  v_total_qty int := 0;
  v_share bigint;
  v_landed bigint;
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

  -- گذر اول: جمع خالص و جمع تعداد، هر دو مبنای سرشکن‌اند.
  for it in select * from jsonb_array_elements(p_items)
  loop
    v_line := round((it->>'unit_price')::bigint * (it->>'qty')::numeric)::bigint;
    v_line_discount := least(greatest(coalesce((it->>'discount')::bigint, 0), 0), v_line);
    v_subtotal := v_subtotal + (v_line - v_line_discount);
    v_total_qty := v_total_qty + ceil((it->>'qty')::numeric)::int;
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

  -- گذر دوم: درج اقلام با قیمت تمام‌شده.
  for it in select * from jsonb_array_elements(p_items)
  loop
    v_line := round((it->>'unit_price')::bigint * (it->>'qty')::numeric)::bigint;
    v_line_discount := least(greatest(coalesce((it->>'discount')::bigint, 0), 0), v_line);
    v_line_net := v_line - v_line_discount;

    v_share := public.allocate_extra_cost(
      coalesce(p_extra_total, 0), v_line_net, ceil((it->>'qty')::numeric)::int,
      v_subtotal, v_total_qty,
      coalesce(it->>'alloc', 'by_value')
    );

    /*
      قیمت تمام‌شده‌ی هر **واحد**، نه کل سطر.
      `cost_price` در sale_items هم واحدی است و اگر اینجا کل سطر را
      بگذاریم، سود کالاهای چندتایی چند برابر غلط می‌شود.
    */
    v_landed := case
      when (it->>'qty')::numeric > 0 then round((v_line_net + v_share)::numeric / (it->>'qty')::numeric)::bigint
      else 0
    end;

    /*
      🔴 سری ساخت و تاریخ انقضا.

      اگر قلم بچ داشته باشد، اینجا ساخته یا پیدا می‌شود. `upsert`
      است نه `insert` چون کاربر همان سری را دوباره می‌خرد؛ بدون آن
      فهرست پر می‌شد از ردیف‌های تکراری با موجودی خرد و گزارش
      انقضا ده خط برای یک کالا نشان می‌داد.

      ⚠️ بچ داخل **همین تراکنش** ساخته می‌شود. اگر از سمت کلاینت
      جدا صدا می‌زدیم، شکست میانی یعنی بچ یتیم بدون هیچ حرکتی.
    */
    v_batch := null;
    if nullif(trim(coalesce(it->>'lot_no','')), '') is not null
       or nullif(it->>'expiry_date','') is not null then

      select id into v_batch from public.product_batches
      where variant_id = (it->>'variant_id')::uuid
        and coalesce(lot_no,'') = coalesce(nullif(trim(coalesce(it->>'lot_no','')),''), '')
        and coalesce(expiry_date,'9999-12-31'::date)
            = coalesce(nullif(it->>'expiry_date','')::date, '9999-12-31'::date);

      if v_batch is null then
        insert into public.product_batches(org_id, variant_id, lot_no, expiry_date, created_by)
        values (p_org, (it->>'variant_id')::uuid,
                nullif(trim(coalesce(it->>'lot_no','')), ''),
                nullif(it->>'expiry_date','')::date,
                v_uid)
        returning id into v_batch;
      end if;
    end if;

    insert into public.purchase_items(org_id, branch_id, purchase_id, variant_id, qty, unit_price, discount, line_total, landed_cost, batch_id, created_by)
    values (p_org, p_branch, v_purchase, (it->>'variant_id')::uuid, (it->>'qty')::numeric,
            (it->>'unit_price')::bigint, v_line_discount, v_line_net, v_landed, v_batch, v_uid);

    insert into public.stock_movements(org_id, branch_id, variant_id, type, reason, qty, ref_table, ref_id, batch_id, created_by)
    values (p_org, p_branch, (it->>'variant_id')::uuid, 'in', 'purchase', (it->>'qty')::numeric, 'purchases', v_purchase, v_batch, v_uid);

    /*
      🔴 `purchase_price` حالا **قیمت تمام‌شده** می‌گیرد نه قیمت خام.

      این همان خطی است که باگ را رفع می‌کند: چون
      `sale_items.cost_price` از اینجا می‌آید، سود فروش از این پس
      هزینه‌ی حمل را هم حساب می‌کند.
    */
    update public.product_variants
      set purchase_price = v_landed,
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
