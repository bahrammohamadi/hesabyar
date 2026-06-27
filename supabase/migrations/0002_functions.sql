-- =============================================================
-- حساب‌یار - توابع تجاری (RPC) و داشبورد
-- نسخه: 0002 | بعد از 0001 اجرا شود
-- =============================================================

-- -------------------------------------------------------------
-- راه‌اندازی سازمان جدید: ساخت سازمان + شعبه اصلی + عضویت مالک
-- + صندوق و بانک پیش‌فرض + دسته‌های هزینه نمونه
-- پس از ثبت‌نام کاربر، یک‌بار صدا زده می‌شود.
-- -------------------------------------------------------------
create or replace function public.bootstrap_org(p_org_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_branch uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'کاربر وارد نشده است';
  end if;

  insert into public.organizations(name, owner_id, created_by)
  values (p_org_name, v_uid, v_uid)
  returning id into v_org;

  insert into public.branches(org_id, name, created_by)
  values (v_org, 'شعبه اصلی', v_uid)
  returning id into v_branch;

  insert into public.memberships(org_id, branch_id, user_id, role, created_by)
  values (v_org, v_branch, v_uid, 'owner', v_uid);

  insert into public.accounts(org_id, branch_id, name, type, created_by)
  values
    (v_org, v_branch, 'صندوق', 'cash', v_uid),
    (v_org, v_branch, 'حساب بانکی', 'bank', v_uid);

  insert into public.expense_categories(org_id, branch_id, name, created_by)
  values
    (v_org, v_branch, 'اجاره', v_uid),
    (v_org, v_branch, 'حقوق', v_uid),
    (v_org, v_branch, 'حمل و نقل', v_uid),
    (v_org, v_branch, 'تبلیغات', v_uid),
    (v_org, v_branch, 'قبوض', v_uid),
    (v_org, v_branch, 'متفرقه', v_uid);

  return v_org;
end;
$$;

-- -------------------------------------------------------------
-- تولید شماره فاکتور دنباله‌دار به ازای سازمان
-- -------------------------------------------------------------
create or replace function public.next_invoice_no(p_org uuid, p_prefix text, p_table text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_count bigint;
begin
  if p_table = 'sales' then
    select count(*) into v_count from public.sales where org_id = p_org;
  else
    select count(*) into v_count from public.purchases where org_id = p_org;
  end if;
  return p_prefix || '-' || lpad((v_count + 1)::text, 5, '0');
end;
$$;

-- -------------------------------------------------------------
-- ثبت اتمیک فروش
-- ورودی items به صورت jsonb:
--  [{"variant_id":"...","qty":2,"unit_price":150000,"discount":0,"cost_price":90000}, ...]
-- payments: مبالغ نقد/کارت/نسیه + حساب دریافت
-- -------------------------------------------------------------
create or replace function public.create_sale(
  p_org uuid,
  p_branch uuid,
  p_customer uuid,
  p_items jsonb,
  p_discount bigint default 0,
  p_tax bigint default 0,
  p_paid_cash bigint default 0,
  p_paid_card bigint default 0,
  p_paid_credit bigint default 0,
  p_account uuid default null,
  p_note text default null,
  p_date timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_sale uuid;
  v_subtotal bigint := 0;
  v_total bigint := 0;
  v_inv text;
  it jsonb;
  v_line bigint;
begin
  if not (p_org in (select public.user_org_ids())) then
    raise exception 'دسترسی غیرمجاز به سازمان';
  end if;

  -- جمع اقلام
  for it in select * from jsonb_array_elements(p_items)
  loop
    v_line := ((it->>'unit_price')::bigint * (it->>'qty')::int) - coalesce((it->>'discount')::bigint,0);
    v_subtotal := v_subtotal + v_line;
  end loop;

  v_total := v_subtotal - coalesce(p_discount,0) + coalesce(p_tax,0);
  v_inv := public.next_invoice_no(p_org, 'F', 'sales');

  insert into public.sales(org_id, branch_id, customer_id, invoice_no, date,
    subtotal, discount, tax, total, paid_cash, paid_card, paid_credit, account_id, status, note, created_by)
  values (p_org, p_branch, p_customer, v_inv, p_date,
    v_subtotal, p_discount, p_tax, v_total, p_paid_cash, p_paid_card, p_paid_credit, p_account, 'confirmed', p_note, v_uid)
  returning id into v_sale;

  -- اقلام + کاهش موجودی
  for it in select * from jsonb_array_elements(p_items)
  loop
    v_line := ((it->>'unit_price')::bigint * (it->>'qty')::int) - coalesce((it->>'discount')::bigint,0);

    insert into public.sale_items(org_id, branch_id, sale_id, variant_id, qty, unit_price, discount, line_total, cost_price, created_by)
    values (p_org, p_branch, v_sale, (it->>'variant_id')::uuid, (it->>'qty')::int,
            (it->>'unit_price')::bigint, coalesce((it->>'discount')::bigint,0), v_line,
            coalesce((it->>'cost_price')::bigint,0), v_uid);

    insert into public.stock_movements(org_id, branch_id, variant_id, type, reason, qty, ref_table, ref_id, created_by)
    values (p_org, p_branch, (it->>'variant_id')::uuid, 'out', 'sale', -1 * (it->>'qty')::int, 'sales', v_sale, v_uid);
  end loop;

  -- تراکنش‌های مالی دریافت نقد/کارت
  if coalesce(p_paid_cash,0) > 0 then
    insert into public.transactions(org_id, branch_id, type, amount, date, account_id, contact_id, ref_table, ref_id, method, note, created_by)
    values (p_org, p_branch, 'receipt', p_paid_cash, p_date, p_account, p_customer, 'sales', v_sale, 'cash', 'دریافت نقدی فروش '||v_inv, v_uid);
  end if;
  if coalesce(p_paid_card,0) > 0 then
    insert into public.transactions(org_id, branch_id, type, amount, date, account_id, contact_id, ref_table, ref_id, method, note, created_by)
    values (p_org, p_branch, 'receipt', p_paid_card, p_date, p_account, p_customer, 'sales', v_sale, 'card', 'دریافت کارتی فروش '||v_inv, v_uid);
  end if;
  -- نسیه (paid_credit) بدهی مشتری است و در contact_balances محاسبه می‌شود.

  return v_sale;
end;
$$;

-- -------------------------------------------------------------
-- ثبت اتمیک خرید
-- items: [{"variant_id":"...","qty":5,"unit_price":90000}, ...]
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
  p_date timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_purchase uuid;
  v_subtotal bigint := 0;
  v_total bigint := 0;
  v_inv text;
  it jsonb;
  v_line bigint;
begin
  if not (p_org in (select public.user_org_ids())) then
    raise exception 'دسترسی غیرمجاز به سازمان';
  end if;

  for it in select * from jsonb_array_elements(p_items)
  loop
    v_subtotal := v_subtotal + ((it->>'unit_price')::bigint * (it->>'qty')::int);
  end loop;

  v_total := v_subtotal + coalesce(p_extra_total,0) - coalesce(p_discount,0) + coalesce(p_tax,0);
  v_inv := public.next_invoice_no(p_org, 'P', 'purchases');

  insert into public.purchases(org_id, branch_id, supplier_id, invoice_no, date,
    subtotal, extra_total, discount, tax, total, paid, status, note, created_by)
  values (p_org, p_branch, p_supplier, v_inv, p_date,
    v_subtotal, p_extra_total, p_discount, p_tax, v_total, p_paid, 'confirmed', p_note, v_uid)
  returning id into v_purchase;

  for it in select * from jsonb_array_elements(p_items)
  loop
    v_line := (it->>'unit_price')::bigint * (it->>'qty')::int;

    insert into public.purchase_items(org_id, branch_id, purchase_id, variant_id, qty, unit_price, line_total, created_by)
    values (p_org, p_branch, v_purchase, (it->>'variant_id')::uuid, (it->>'qty')::int,
            (it->>'unit_price')::bigint, v_line, v_uid);

    insert into public.stock_movements(org_id, branch_id, variant_id, type, reason, qty, ref_table, ref_id, created_by)
    values (p_org, p_branch, (it->>'variant_id')::uuid, 'in', 'purchase', (it->>'qty')::int, 'purchases', v_purchase, v_uid);

    -- به‌روزرسانی قیمت خرید تنوع
    update public.product_variants
      set purchase_price = (it->>'unit_price')::bigint
      where id = (it->>'variant_id')::uuid;
  end loop;

  -- پرداخت به تامین‌کننده
  if coalesce(p_paid,0) > 0 then
    insert into public.transactions(org_id, branch_id, type, amount, date, account_id, contact_id, ref_table, ref_id, method, note, created_by)
    values (p_org, p_branch, 'payment', p_paid, p_date, p_account, p_supplier, 'purchases', v_purchase, 'cash', 'پرداخت بابت خرید '||v_inv, v_uid);
  end if;

  return v_purchase;
end;
$$;

-- -------------------------------------------------------------
-- خلاصه داشبورد
-- -------------------------------------------------------------
create or replace function public.dashboard_summary(p_org uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v jsonb;
  v_today_start timestamptz := date_trunc('day', now());
  v_month_start timestamptz := date_trunc('month', now());
begin
  if not (p_org in (select public.user_org_ids())) then
    raise exception 'دسترسی غیرمجاز';
  end if;

  select jsonb_build_object(
    'sales_today',      coalesce((select sum(total) from public.sales where org_id=p_org and status='confirmed' and date >= v_today_start),0),
    'sales_today_count',coalesce((select count(*) from public.sales where org_id=p_org and status='confirmed' and date >= v_today_start),0),
    'sales_month',      coalesce((select sum(total) from public.sales where org_id=p_org and status='confirmed' and date >= v_month_start),0),
    'expenses_month',   coalesce((select sum(amount) from public.transactions where org_id=p_org and type in ('expense','payment') and date >= v_month_start),0),
    'profit_month',     coalesce((select sum(si.line_total - (si.cost_price*si.qty)) from public.sale_items si
                                   join public.sales s on s.id=si.sale_id
                                   where s.org_id=p_org and s.status='confirmed' and s.date >= v_month_start),0),
    'inventory_value',  coalesce((select sum(v.stock_qty * coalesce(v.purchase_price, p.base_purchase_price))
                                   from public.product_variants v join public.products p on p.id=v.product_id
                                   where v.org_id=p_org and v.is_active),0),
    'low_stock_count',  coalesce((select count(*) from public.low_stock_variants where org_id=p_org),0),
    'cash_total',       coalesce((select sum(balance) from public.account_balances where org_id=p_org),0),
    'customers_debt',   coalesce((select sum(balance) from public.contact_balances where org_id=p_org and balance > 0),0),
    'suppliers_credit', coalesce((select -sum(balance) from public.contact_balances where org_id=p_org and balance < 0),0)
  ) into v;

  return v;
end;
$$;

-- -------------------------------------------------------------
-- نمودار فروش ۳۰ روز اخیر
-- -------------------------------------------------------------
create or replace function public.sales_chart_30d(p_org uuid)
returns table(day date, total bigint)
language sql
security definer
set search_path = public
stable
as $$
  select (date_trunc('day', s.date))::date as day, coalesce(sum(s.total),0)::bigint as total
  from public.sales s
  where s.org_id = p_org and s.status='confirmed' and s.date >= now() - interval '30 days'
  group by 1 order by 1;
$$;

-- =============================================================
-- پایان توابع
-- =============================================================
