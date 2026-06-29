-- =============================================================
-- Hesabyar ERP - Retail Core Hardening
-- نسخه: 0006
-- هدف: اصلاح مدل پرداخت، تخفیف، تاریخچه قیمت و جلوگیری از overwrite موجودی
-- این migration backward-compatible است و قابلیت‌های قبلی را حذف نمی‌کند.
-- =============================================================

-- -------------------------------------------------------------
-- 1) پرداخت مستقل و لینک مستقیم به فاکتور فروش/خرید
-- -------------------------------------------------------------
alter table public.transactions
  add column if not exists sale_id uuid references public.sales(id) on delete restrict,
  add column if not exists purchase_id uuid references public.purchases(id) on delete restrict;

update public.transactions
set sale_id = ref_id
where sale_id is null and ref_table = 'sales' and ref_id is not null;

update public.transactions
set purchase_id = ref_id
where purchase_id is null and ref_table = 'purchases' and ref_id is not null;

create index if not exists idx_transactions_sale_id on public.transactions(sale_id);
create index if not exists idx_transactions_purchase_id on public.transactions(purchase_id);
create index if not exists idx_transactions_contact_date on public.transactions(contact_id, date desc);

-- -------------------------------------------------------------
-- 2) مدل تخفیف عددی/درصدی
-- discount = مبلغ نهایی اعمال‌شده به ریال
-- discount_type/value = مدل ورودی کاربر
-- -------------------------------------------------------------
alter table public.sales
  add column if not exists discount_type text not null default 'fixed' check (discount_type in ('fixed','percent')),
  add column if not exists discount_value numeric not null default 0;

alter table public.purchases
  add column if not exists discount_type text not null default 'fixed' check (discount_type in ('fixed','percent')),
  add column if not exists discount_value numeric not null default 0;

-- -------------------------------------------------------------
-- 3) تاریخچه قیمت کالا/تنوع
-- -------------------------------------------------------------
create table if not exists public.product_price_history (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  old_purchase_price bigint,
  new_purchase_price bigint,
  old_sale_price bigint,
  new_sale_price bigint,
  reason text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists idx_price_history_org_date on public.product_price_history(org_id, created_at desc);
create index if not exists idx_price_history_product_date on public.product_price_history(product_id, created_at desc);
create index if not exists idx_price_history_variant_date on public.product_price_history(variant_id, created_at desc);

alter table public.product_price_history enable row level security;
drop policy if exists product_price_history_policy on public.product_price_history;
create policy product_price_history_policy on public.product_price_history
  for all using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

-- -------------------------------------------------------------
-- 4) Permission function سبک برای write actions
-- توجه: UI هم فیلتر دارد، اما امنیت write باید سمت DB/RPC باشد.
-- -------------------------------------------------------------
create or replace function public.has_permission(p_permission text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  with active_roles as (
    select role
    from public.memberships
    where user_id = auth.uid() and is_active = true
  )
  select exists (
    select 1 from active_roles
    where role = 'owner'
       or (role = 'manager' and p_permission in (
          'contacts.view','contacts.edit','contacts.call','crm.create',
          'sales.view','sales.create','purchases.view','purchases.create',
          'products.view','products.edit','products.update_price',
          'inventory.view','inventory.adjust','finance.view','finance.create','reports.view'
       ))
       or (role = 'cashier' and p_permission in (
          'contacts.view','contacts.call','sales.view','sales.create','products.view','finance.create'
       ))
       or (role in ('inventory','warehouse') and p_permission in (
          'products.view','products.edit','inventory.view','inventory.adjust'
       ))
       or (role = 'accountant' and p_permission in (
          'contacts.view','sales.view','purchases.view','finance.view','finance.create','reports.view'
       ))
  );
$$;

-- -------------------------------------------------------------
-- 5) Summary views پرداخت؛ balance از transactions محاسبه می‌شود
-- -------------------------------------------------------------
create or replace view public.sales_payment_summary as
select
  s.id as sale_id,
  s.org_id,
  s.customer_id,
  s.invoice_no,
  s.date,
  s.total,
  coalesce(sum(t.amount) filter (where t.type = 'receipt'), 0)::bigint as paid_total,
  greatest(s.total - coalesce(sum(t.amount) filter (where t.type = 'receipt'), 0), 0)::bigint as balance,
  max(t.date) filter (where t.type = 'receipt') as last_payment_at,
  count(t.id) filter (where t.type = 'receipt')::int as payment_count
from public.sales s
left join public.transactions t on t.sale_id = s.id
where s.status <> 'cancelled'
group by s.id;

create or replace view public.purchase_payment_summary as
select
  p.id as purchase_id,
  p.org_id,
  p.supplier_id,
  p.invoice_no,
  p.date,
  p.total,
  coalesce(sum(t.amount) filter (where t.type = 'payment'), 0)::bigint as paid_total,
  greatest(p.total - coalesce(sum(t.amount) filter (where t.type = 'payment'), 0), 0)::bigint as balance,
  max(t.date) filter (where t.type = 'payment') as last_payment_at,
  count(t.id) filter (where t.type = 'payment')::int as payment_count
from public.purchases p
left join public.transactions t on t.purchase_id = p.id
where p.status <> 'cancelled'
group by p.id;

-- -------------------------------------------------------------
-- 6) جلوگیری از overwrite مستقیم stock_qty
-- stock_qty کش محاسباتی است و فقط trigger گردش انبار مجاز است آن را تغییر دهد.
-- -------------------------------------------------------------
create or replace function public.guard_stock_qty_update()
returns trigger
language plpgsql
as $$
begin
  if new.stock_qty is distinct from old.stock_qty
     and coalesce(current_setting('app.allow_stock_update', true), '') <> 'on' then
    raise exception 'stock_qty فقط از طریق stock_movements قابل تغییر است';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_stock_qty on public.product_variants;
create trigger trg_guard_stock_qty
  before update of stock_qty on public.product_variants
  for each row execute function public.guard_stock_qty_update();

create or replace function public.apply_stock_movement()
returns trigger
language plpgsql
as $$
begin
  perform set_config('app.allow_stock_update', 'on', true);

  if (tg_op = 'INSERT') then
    update public.product_variants
      set stock_qty = stock_qty + new.qty, updated_at = now()
      where id = new.variant_id;
  elsif (tg_op = 'DELETE') then
    update public.product_variants
      set stock_qty = stock_qty - old.qty, updated_at = now()
      where id = old.variant_id;
  end if;

  return null;
end;
$$;

-- -------------------------------------------------------------
-- 7) ثبت پرداخت فروش/خرید به عنوان Payment مستقل
-- -------------------------------------------------------------
create or replace function public.record_sale_payment(
  p_sale uuid,
  p_amount bigint,
  p_account uuid default null,
  p_method text default 'cash',
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
  v_tx uuid;
  v_sale record;
begin
  if not public.has_permission('finance.create') then
    raise exception 'دسترسی ثبت پرداخت وجود ندارد';
  end if;

  select * into v_sale from public.sales where id = p_sale;
  if not found then raise exception 'فاکتور فروش یافت نشد'; end if;
  if not (v_sale.org_id in (select public.user_org_ids())) then raise exception 'دسترسی غیرمجاز'; end if;
  if coalesce(p_amount,0) <= 0 then raise exception 'مبلغ پرداخت نامعتبر است'; end if;

  insert into public.transactions(org_id, branch_id, type, amount, date, account_id, contact_id, sale_id, ref_table, ref_id, method, note, created_by)
  values (v_sale.org_id, v_sale.branch_id, 'receipt', p_amount, p_date, p_account, v_sale.customer_id, p_sale, 'sales', p_sale, p_method, coalesce(p_note, 'دریافت بابت فاکتور ' || coalesce(v_sale.invoice_no,'')), v_uid)
  returning id into v_tx;

  return v_tx;
end;
$$;

create or replace function public.record_purchase_payment(
  p_purchase uuid,
  p_amount bigint,
  p_account uuid default null,
  p_method text default 'cash',
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
  v_tx uuid;
  v_purchase record;
begin
  if not public.has_permission('finance.create') then
    raise exception 'دسترسی ثبت پرداخت وجود ندارد';
  end if;

  select * into v_purchase from public.purchases where id = p_purchase;
  if not found then raise exception 'فاکتور خرید یافت نشد'; end if;
  if not (v_purchase.org_id in (select public.user_org_ids())) then raise exception 'دسترسی غیرمجاز'; end if;
  if coalesce(p_amount,0) <= 0 then raise exception 'مبلغ پرداخت نامعتبر است'; end if;

  insert into public.transactions(org_id, branch_id, type, amount, date, account_id, contact_id, purchase_id, ref_table, ref_id, method, note, created_by)
  values (v_purchase.org_id, v_purchase.branch_id, 'payment', p_amount, p_date, p_account, v_purchase.supplier_id, p_purchase, 'purchases', p_purchase, p_method, coalesce(p_note, 'پرداخت بابت خرید ' || coalesce(v_purchase.invoice_no,'')), v_uid)
  returning id into v_tx;

  return v_tx;
end;
$$;

-- -------------------------------------------------------------
-- 8) تغییر قیمت با ثبت تاریخچه
-- -------------------------------------------------------------
create or replace function public.change_product_price(
  p_product uuid,
  p_purchase_price bigint,
  p_sale_price bigint,
  p_apply_variants boolean default true,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_product record;
  v_variant record;
begin
  if not public.has_permission('products.update_price') then
    raise exception 'دسترسی تغییر قیمت وجود ندارد';
  end if;

  select * into v_product from public.products where id = p_product;
  if not found then raise exception 'کالا یافت نشد'; end if;
  if not (v_product.org_id in (select public.user_org_ids())) then raise exception 'دسترسی غیرمجاز'; end if;

  insert into public.product_price_history(org_id, product_id, old_purchase_price, new_purchase_price, old_sale_price, new_sale_price, reason, created_by)
  values (v_product.org_id, p_product, v_product.base_purchase_price, p_purchase_price, v_product.base_sale_price, p_sale_price, p_reason, v_uid);

  update public.products
    set base_purchase_price = p_purchase_price,
        base_sale_price = p_sale_price,
        updated_at = now()
    where id = p_product;

  if p_apply_variants then
    for v_variant in select * from public.product_variants where product_id = p_product and is_active = true
    loop
      insert into public.product_price_history(org_id, product_id, variant_id, old_purchase_price, new_purchase_price, old_sale_price, new_sale_price, reason, created_by)
      values (v_product.org_id, p_product, v_variant.id, v_variant.purchase_price, p_purchase_price, v_variant.sale_price, p_sale_price, p_reason, v_uid);

      update public.product_variants
        set purchase_price = p_purchase_price,
            sale_price = p_sale_price,
            updated_at = now()
        where id = v_variant.id;
    end loop;
  end if;
end;
$$;

-- -------------------------------------------------------------
-- 9) نسخه سخت‌تر create_sale با discount_type/value و sale_id در transactions
-- برای جلوگیری از overload مبهم در PostgREST، نسخه قبلی حذف می‌شود.
-- -------------------------------------------------------------
drop function if exists public.create_sale(uuid, uuid, uuid, jsonb, bigint, bigint, bigint, bigint, bigint, uuid, text, timestamptz);

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
  p_date timestamptz default now(),
  p_discount_type text default 'fixed',
  p_discount_value numeric default null
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
    v_line := ((it->>'unit_price')::bigint * (it->>'qty')::int) - coalesce((it->>'discount')::bigint,0);
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
    v_line := ((it->>'unit_price')::bigint * (it->>'qty')::int) - coalesce((it->>'discount')::bigint,0);

    insert into public.sale_items(org_id, branch_id, sale_id, variant_id, qty, unit_price, discount, line_total, cost_price, created_by)
    values (p_org, p_branch, v_sale, (it->>'variant_id')::uuid, (it->>'qty')::int,
            (it->>'unit_price')::bigint, coalesce((it->>'discount')::bigint,0), v_line,
            coalesce((it->>'cost_price')::bigint,0), v_uid);

    insert into public.stock_movements(org_id, branch_id, variant_id, type, reason, qty, ref_table, ref_id, created_by)
    values (p_org, p_branch, (it->>'variant_id')::uuid, 'out', 'sale', -1 * (it->>'qty')::int, 'sales', v_sale, v_uid);
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
$$;

-- -------------------------------------------------------------
-- 10) نسخه سخت‌تر create_purchase با purchase_id در transactions
-- برای جلوگیری از overload مبهم در PostgREST، نسخه قبلی حذف می‌شود.
-- -------------------------------------------------------------
drop function if exists public.create_purchase(uuid, uuid, uuid, jsonb, bigint, bigint, bigint, bigint, uuid, text, timestamptz);

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
set search_path = public
as $$
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
    v_subtotal, p_extra_total, v_discount, p_discount_type, coalesce(p_discount_value, case when p_discount_type='fixed' then v_discount else 0 end), p_tax, v_total, p_paid, 'confirmed', p_note, v_uid)
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
$$;

-- =============================================================
-- پایان migration 0006
-- =============================================================
