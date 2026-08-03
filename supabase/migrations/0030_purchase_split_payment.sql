-- 0030 — تفکیک پرداخت نقدی/کارتی در فاکتور خرید
--
-- چرا لازم شد؟
--   پنجره‌ی «خرید جدید» قرار است هم‌سطح «فروش جدید» شود. فروش از
--   create_sale استفاده می‌کند که p_paid_cash و p_paid_card جدا دارد و
--   برای هرکدام یک تراکنش با method درست می‌سازد.
--
--   خرید ولی فقط p_paid داشت و تراکنشش method را hardcode روی 'cash'
--   می‌گذاشت. یعنی اگر فروشنده کالا را با کارت می‌خرید، در گزارش‌های
--   مالی «نقدی» ثبت می‌شد و مانده‌ی صندوق غلط درمی‌آمد.
--
-- سازگاری با گذشته:
--   امضای قبلی (p_paid) دست‌نخورده باقی می‌ماند. پارامترهای جدید در
--   انتها و با DEFAULT NULL اضافه شده‌اند، پس هر فراخوانی موجود —
--   از جمله صفحه‌ی /purchases/[id] — بدون تغییر کار می‌کند.
--
--   منطق: اگر p_paid_cash/p_paid_card داده شود، همان‌ها ملاک‌اند؛
--   وگرنه p_paid کل مبلغ نقدی در نظر گرفته می‌شود (رفتار قدیمی).

-- 🔴 این drop حیاتی است و با آزمایش واقعی کشف شد.
--
-- `create or replace` روی امضای *متفاوت* جایگزین نمی‌کند؛ یک تابع دوم
-- می‌سازد. نتیجه دو overload کنار هم بود و PostgREST نتوانست انتخاب کند:
--
--   PGRST203 — Could not choose the best candidate function between:
--     public.create_purchase(p_org => uuid, ..., p_discount_value => numeric)
--     public.create_purchase(p_org => uuid, ..., p_paid_cash => bigint, ...)
--
-- یعنی بدون این خط، ثبت خرید در کل برنامه از کار می‌افتاد — هم مسیر
-- جدید و هم صفحه‌ی /purchases/[id] که هنوز امضای قدیمی را صدا می‌زند.
drop function if exists public.create_purchase(
  uuid, uuid, uuid, jsonb, bigint, bigint, bigint, bigint, uuid, text, timestamptz, text, numeric
);

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

  /*
    تفکیک پرداخت.

    اگر هیچ‌کدام از پارامترهای جدید داده نشده باشد، یعنی فراخوانی از
    کد قدیمی است: کل p_paid نقدی حساب می‌شود — دقیقاً رفتار قبلی.

    greatest(...,0) لازم است چون مقدار منفی از سمت کلاینت نباید
    بتواند تراکنش وارونه بسازد.
  */
  if p_paid_cash is null and p_paid_card is null then
    v_cash := greatest(coalesce(p_paid, 0), 0);
    v_card := 0;
  else
    v_cash := greatest(coalesce(p_paid_cash, 0), 0);
    v_card := greatest(coalesce(p_paid_card, 0), 0);
  end if;
  v_paid_total := v_cash + v_card;

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
    p_tax, v_total, v_paid_total, 'confirmed', p_note, v_uid)
  returning id into v_purchase;

  for it in select * from jsonb_array_elements(p_items)
  loop
    v_line := (it->>'unit_price')::bigint * (it->>'qty')::int;

    insert into public.purchase_items(org_id, branch_id, purchase_id, variant_id, qty, unit_price, line_total, created_by)
    values (p_org, p_branch, v_purchase, (it->>'variant_id')::uuid, (it->>'qty')::int,
            (it->>'unit_price')::bigint, v_line, v_uid);

    insert into public.stock_movements(org_id, branch_id, variant_id, type, reason, qty, ref_table, ref_id, created_by)
    values (p_org, p_branch, (it->>'variant_id')::uuid, 'in', 'purchase', (it->>'qty')::int, 'purchases', v_purchase, v_uid);

    /*
      قیمت خرید و — در صورت ارسال — قیمت فروش کالا به‌روز می‌شود.

      این بخش از قبل وجود داشت و عمداً دست‌نخورده ماند. نکته اینکه
      کلاینت لازم نیست بعد از RPC یک update جداگانه بزند؛ آن کار هم
      تکراری است و هم بیرون از تراکنش انجام می‌شد، یعنی اگر شکست
      می‌خورد خرید ثبت شده بود ولی قیمت فروش نه.
    */
    update public.product_variants
      set purchase_price = (it->>'unit_price')::bigint,
          sale_price = case when it ? 'sale_price' then (it->>'sale_price')::bigint else sale_price end,
          updated_at = now()
      where id = (it->>'variant_id')::uuid;
  end loop;

  -- یک تراکنش برای هر روش پرداخت، تا گزارش مالی درست باشد.
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

comment on function public.create_purchase(uuid, uuid, uuid, jsonb, bigint, bigint, bigint, bigint, uuid, text, timestamptz, text, numeric, bigint, bigint)
  is 'ثبت فاکتور خرید. p_paid_cash/p_paid_card اختیاری‌اند؛ اگر داده نشوند p_paid کل مبلغ نقدی فرض می‌شود (سازگاری با کد قدیمی).';
