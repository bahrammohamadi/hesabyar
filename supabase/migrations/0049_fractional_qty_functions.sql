-- 0049 — پذیرش مقدار اعشاری در توابع مالی
--
-- 🔴 باگی که این رفع می‌کند — مهاجرت ۰۰۴۸ نیمه‌کاره بود:
--
--   ستون‌های `qty` به `numeric(14,3)` تبدیل شدند، ولی توابعی که در
--   آن‌ها می‌نویسند هنوز مقدار ورودی را با `(it->>'qty')::int` از
--   JSON می‌خواندند. یعنی:
--
--     کاربر «۱٫۵ کیلو» می‌فروشد  ⇒  در فاکتور «۲ کیلو» ثبت می‌شود
--     کاربر «۰٫۴ کیلو» می‌فروشد  ⇒  در فاکتور «۰» ثبت می‌شود
--
--   بدتر از خطای آشکار: **بی‌صدا** بود. مبلغ فاکتور از روی همان
--   مقدار گردشده حساب می‌شد، پس هیچ ناهماهنگی‌ای دیده نمی‌شد؛ فقط
--   موجودی انبار با واقعیت فرق می‌کرد و کاردکس دروغ می‌گفت.
--
-- ⚠️ چرا تعاریف از دیتابیس زنده گرفته شد نه از فایل مهاجرت؟
--   این توابع در چند مهاجرت پیاپی بازنویسی شده‌اند (۰۰۰۲ ← ۰۰۰۶ ←
--   ۰۰۳۰ ← ۰۰۴۲ ← ۰۰۴۶). آخرین نسخه فقط در دیتابیس است. برداشتن
--   نسخه‌ی قدیمی از فایل، تخفیف سطری و سرشکن هزینه‌ی حمل را از بین
--   می‌برد. تعاریف با pg_get_functiondef گرفته و فقط cast عوض شد.
--
-- ⚠️ امضای توابع **عوض نشده**. تغییر امضا در Postgres یک overload
--   جدید می‌سازد و PostgREST خطای PGRST203 می‌دهد.
--
-- گرد کردن مبلغ: `round(قیمت × مقدار)::bigint` چون ستون `line_total`
-- از نوع bigint است و کسر ریال معنا ندارد.
--
-- ⚠️ `allocate_extra_cost` امضایش `p_line_qty integer` است و عوض
-- نمی‌شود؛ در محل فراخوانی با ceil به عدد صحیح تبدیل می‌شود. سرشکن
-- «به نسبت تعداد» برای کالای وزنی تقریبی است — «به نسبت ارزش» که
-- حالت پیش‌فرض است دقیق می‌ماند.

-- ------------------------------------------------------------
-- create_sale
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_sale(p_org uuid, p_branch uuid, p_customer uuid, p_items jsonb, p_discount bigint DEFAULT 0, p_tax bigint DEFAULT 0, p_paid_cash bigint DEFAULT 0, p_paid_card bigint DEFAULT 0, p_paid_credit bigint DEFAULT 0, p_account uuid DEFAULT NULL::uuid, p_note text DEFAULT NULL::text, p_date timestamp with time zone DEFAULT now(), p_discount_type text DEFAULT 'fixed'::text, p_discount_value numeric DEFAULT NULL::numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_sale uuid;
  v_subtotal bigint := 0;
  v_discount bigint := 0;
  v_total bigint := 0;
  v_inv text;
  it jsonb;
  v_line bigint;
begin
  if not public.has_permission('sales.create') then
    raise exception 'دسترسی ثبت فروش وجود ندارد';
  end if;
  if not (p_org in (select public.user_org_ids())) then
    raise exception 'دسترسی غیرمجاز به سازمان';
  end if;

  for it in select * from jsonb_array_elements(p_items)
  loop
    v_line := round((it->>'unit_price')::bigint * (it->>'qty')::numeric)::bigint - coalesce((it->>'discount')::bigint,0);
    v_subtotal := v_subtotal + v_line;
  end loop;

  if p_discount_type = 'percent' then
    v_discount := round((v_subtotal::numeric * coalesce(p_discount_value,0)) / 100)::bigint;
  else
    v_discount := coalesce(p_discount,0);
  end if;

  v_total := greatest(0, v_subtotal - v_discount + coalesce(p_tax,0));
  v_inv := public.next_invoice_no(p_org, 'F', 'sales');

  insert into public.sales(org_id, branch_id, customer_id, invoice_no, date,
    subtotal, discount, discount_type, discount_value, tax, total, paid_cash, paid_card, paid_credit, account_id, status, note, created_by)
  values (p_org, p_branch, p_customer, v_inv, p_date,
    v_subtotal, v_discount, p_discount_type, coalesce(p_discount_value, case when p_discount_type='fixed' then v_discount else 0 end), p_tax, v_total,
    p_paid_cash, p_paid_card, greatest(v_total - coalesce(p_paid_cash,0) - coalesce(p_paid_card,0), 0), p_account, 'confirmed', p_note, v_uid)
  returning id into v_sale;

  for it in select * from jsonb_array_elements(p_items)
  loop
    v_line := round((it->>'unit_price')::bigint * (it->>'qty')::numeric)::bigint - coalesce((it->>'discount')::bigint,0);

    insert into public.sale_items(org_id, branch_id, sale_id, variant_id, qty, unit_price, discount, line_total, cost_price, created_by)
    values (p_org, p_branch, v_sale, (it->>'variant_id')::uuid, (it->>'qty')::numeric,
            (it->>'unit_price')::bigint, coalesce((it->>'discount')::bigint,0), v_line,
            coalesce((it->>'cost_price')::bigint,0), v_uid);

    insert into public.stock_movements(org_id, branch_id, variant_id, type, reason, qty, ref_table, ref_id, created_by)
    values (p_org, p_branch, (it->>'variant_id')::uuid, 'out', 'sale', -1 * (it->>'qty')::numeric, 'sales', v_sale, v_uid);
  end loop;

  if coalesce(p_paid_cash,0) > 0 then
    insert into public.transactions(org_id, branch_id, type, amount, date, account_id, contact_id, sale_id, ref_table, ref_id, method, note, created_by)
    values (p_org, p_branch, 'receipt', p_paid_cash, p_date, p_account, p_customer, v_sale, 'sales', v_sale, 'cash', 'دریافت نقدی فروش '||v_inv, v_uid);
  end if;
  if coalesce(p_paid_card,0) > 0 then
    insert into public.transactions(org_id, branch_id, type, amount, date, account_id, contact_id, sale_id, ref_table, ref_id, method, note, created_by)
    values (p_org, p_branch, 'receipt', p_paid_card, p_date, p_account, p_customer, v_sale, 'sales', v_sale, 'card', 'دریافت کارتی فروش '||v_inv, v_uid);
  end if;

  return v_sale;
end;
$function$;

-- ------------------------------------------------------------
-- create_purchase
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_purchase(p_org uuid, p_branch uuid, p_supplier uuid, p_items jsonb, p_extra_total bigint DEFAULT 0, p_discount bigint DEFAULT 0, p_tax bigint DEFAULT 0, p_paid bigint DEFAULT 0, p_account uuid DEFAULT NULL::uuid, p_note text DEFAULT NULL::text, p_date timestamp with time zone DEFAULT now(), p_discount_type text DEFAULT 'fixed'::text, p_discount_value numeric DEFAULT NULL::numeric, p_paid_cash bigint DEFAULT NULL::bigint, p_paid_card bigint DEFAULT NULL::bigint)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

    insert into public.purchase_items(org_id, branch_id, purchase_id, variant_id, qty, unit_price, discount, line_total, landed_cost, created_by)
    values (p_org, p_branch, v_purchase, (it->>'variant_id')::uuid, (it->>'qty')::numeric,
            (it->>'unit_price')::bigint, v_line_discount, v_line_net, v_landed, v_uid);

    insert into public.stock_movements(org_id, branch_id, variant_id, type, reason, qty, ref_table, ref_id, created_by)
    values (p_org, p_branch, (it->>'variant_id')::uuid, 'in', 'purchase', (it->>'qty')::numeric, 'purchases', v_purchase, v_uid);

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

-- ------------------------------------------------------------
-- update_sale_invoice
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_sale_invoice(p_sale uuid, p_customer uuid, p_date timestamp with time zone, p_items jsonb, p_discount_type text DEFAULT 'fixed'::text, p_discount_value numeric DEFAULT 0, p_discount bigint DEFAULT 0, p_tax bigint DEFAULT 0, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    if coalesce((it->>'qty')::numeric, 0) <= 0 then
      raise exception 'تعداد آیتم نامعتبر است';
    end if;
    if coalesce((it->>'unit_price')::bigint, 0) < 0 then
      raise exception 'قیمت آیتم نامعتبر است';
    end if;
    v_line := round((it->>'unit_price')::bigint * (it->>'qty')::numeric)::bigint - coalesce((it->>'discount')::bigint, 0);
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
    v_line := round((it->>'unit_price')::bigint * (it->>'qty')::numeric)::bigint - coalesce((it->>'discount')::bigint, 0);

    insert into public.sale_items(
      org_id, branch_id, sale_id, variant_id, qty, unit_price, discount, line_total, cost_price, created_by
    ) values (
      v_sale.org_id,
      v_sale.branch_id,
      p_sale,
      (it->>'variant_id')::uuid,
      (it->>'qty')::numeric,
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
      -1 * (it->>'qty')::numeric,
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
$function$;

-- ------------------------------------------------------------
-- update_purchase_invoice
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_purchase_invoice(p_purchase uuid, p_supplier uuid, p_date timestamp with time zone, p_items jsonb, p_discount_type text DEFAULT 'fixed'::text, p_discount_value numeric DEFAULT 0, p_discount bigint DEFAULT 0, p_tax bigint DEFAULT 0, p_extra_total bigint DEFAULT 0, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_line_net bigint := 0;
  v_paid_total bigint := 0;
  v_balance bigint := 0;
  v_total_qty int := 0;
  v_share bigint;
  v_landed bigint;
begin
  if not public.has_permission('purchases.create') then
    raise exception 'دسترسی ویرایش فاکتور خرید وجود ندارد';
  end if;

  select * into v_purchase from public.purchases where id = p_purchase for update;
  if not found then raise exception 'فاکتور خرید یافت نشد'; end if;
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
    if coalesce((it->>'qty')::numeric, 0) <= 0 then
      raise exception 'تعداد آیتم نامعتبر است';
    end if;
    if coalesce((it->>'unit_price')::bigint, 0) < 0 then
      raise exception 'قیمت خرید آیتم نامعتبر است';
    end if;
    v_line := round((it->>'unit_price')::bigint * (it->>'qty')::numeric)::bigint;
    v_line_discount := least(greatest(coalesce((it->>'discount')::bigint, 0), 0), v_line);
    v_subtotal := v_subtotal + (v_line - v_line_discount);
    v_total_qty := v_total_qty + ceil((it->>'qty')::numeric)::int;
  end loop;

  if p_discount_type = 'percent' then
    v_discount := round((v_subtotal::numeric * coalesce(p_discount_value, 0)) / 100)::bigint;
  else
    v_discount := coalesce(p_discount, 0);
  end if;

  v_total := greatest(0, v_subtotal + coalesce(p_extra_total, 0) - v_discount + coalesce(p_tax, 0));

  select coalesce(sum(amount), 0)::bigint into v_paid_total
  from public.transactions where purchase_id = p_purchase and type = 'payment';

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
    v_line := round((it->>'unit_price')::bigint * (it->>'qty')::numeric)::bigint;
    v_line_discount := least(greatest(coalesce((it->>'discount')::bigint, 0), 0), v_line);
    v_line_net := v_line - v_line_discount;

    v_share := public.allocate_extra_cost(
      coalesce(p_extra_total, 0), v_line_net, ceil((it->>'qty')::numeric)::int,
      v_subtotal, v_total_qty,
      coalesce(it->>'alloc', 'by_value')
    );

    v_landed := case
      when (it->>'qty')::numeric > 0 then round((v_line_net + v_share)::numeric / (it->>'qty')::numeric)::bigint
      else 0
    end;

    insert into public.purchase_items(
      org_id, branch_id, purchase_id, variant_id, qty, unit_price, discount, line_total, landed_cost, created_by
    ) values (
      v_purchase.org_id, v_purchase.branch_id, p_purchase,
      (it->>'variant_id')::uuid, (it->>'qty')::numeric,
      (it->>'unit_price')::bigint, v_line_discount, v_line_net, v_landed, v_uid
    );

    insert into public.stock_movements(
      org_id, branch_id, variant_id, type, reason, qty, ref_table, ref_id, note, created_by
    ) values (
      v_purchase.org_id, v_purchase.branch_id, (it->>'variant_id')::uuid,
      'in', 'purchase', (it->>'qty')::numeric,
      'purchase_edit', p_purchase,
      'ورود موجودی پس از ویرایش خرید', v_uid
    );

    update public.product_variants
      set purchase_price = v_landed,
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
$function$;
