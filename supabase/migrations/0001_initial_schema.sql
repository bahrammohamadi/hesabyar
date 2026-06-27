-- =============================================================
-- حساب‌یار (Hesabyar) - اسکیمای اولیه دیتابیس
-- نسخه: 0001 | پایگاه داده: Supabase / PostgreSQL
-- این فایل کامل و اجراپذیر است. در Supabase > SQL Editor اجرا شود.
-- =============================================================

-- ---------- افزونه‌ها ----------
create extension if not exists "pgcrypto";   -- برای gen_random_uuid()

-- =============================================================
-- توابع کمکی عمومی
-- =============================================================

-- به‌روزرسانی خودکار updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================
-- گروه ۱: پایه و امنیت
-- =============================================================

-- سازمان (کسب‌وکار)
create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  currency    text not null default 'IRT',
  logo_url    text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id)
);

-- شعبه
create table if not exists public.branches (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null,
  address     text,
  phone       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id)
);

-- عضویت کاربر در سازمان (نقش + شعبه)
create table if not exists public.memberships (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  branch_id   uuid references public.branches(id) on delete set null,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'owner'
              check (role in ('owner','manager','cashier','inventory','accountant')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id),
  unique (org_id, user_id)
);

-- تابع کمکی: سازمان‌هایی که کاربر فعلی عضو فعال آن‌هاست
create or replace function public.user_org_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select org_id from public.memberships
  where user_id = auth.uid() and is_active = true;
$$;

-- =============================================================
-- گروه ۲: کالا و انبار
-- =============================================================

create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  branch_id   uuid references public.branches(id) on delete set null,
  name        text not null,
  parent_id   uuid references public.categories(id) on delete set null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id)
);

create table if not exists public.brands (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  branch_id   uuid references public.branches(id) on delete set null,
  name        text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id)
);

create table if not exists public.products (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizations(id) on delete cascade,
  branch_id           uuid references public.branches(id) on delete set null,
  name                text not null,
  category_id         uuid references public.categories(id) on delete set null,
  brand_id            uuid references public.brands(id) on delete set null,
  description         text,
  image_url           text,
  base_purchase_price bigint not null default 0,
  base_sale_price     bigint not null default 0,
  low_stock_threshold int not null default 3,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references auth.users(id)
);

create table if not exists public.product_variants (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  branch_id       uuid references public.branches(id) on delete set null,
  product_id      uuid not null references public.products(id) on delete cascade,
  color           text,
  size            text,
  sku             text,
  barcode         text,
  purchase_price  bigint,
  sale_price      bigint,
  stock_qty       int not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id),
  unique (org_id, sku)
);

create table if not exists public.stock_movements (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  branch_id       uuid references public.branches(id) on delete set null,
  variant_id      uuid not null references public.product_variants(id) on delete cascade,
  type            text not null check (type in ('in','out','adjust','transfer_in','transfer_out')),
  reason          text not null default 'manual'
                  check (reason in ('purchase','sale','manual','count','transfer','return','opening')),
  qty             int not null,                 -- مثبت برای ورود، منفی برای خروج
  ref_table       text,
  ref_id          uuid,
  from_branch_id  uuid references public.branches(id) on delete set null,
  to_branch_id    uuid references public.branches(id) on delete set null,
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id)
);

-- trigger: به‌روزرسانی موجودی تنوع پس از هر حرکت
create or replace function public.apply_stock_movement()
returns trigger
language plpgsql
as $$
begin
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

drop trigger if exists trg_apply_stock on public.stock_movements;
create trigger trg_apply_stock
  after insert or delete on public.stock_movements
  for each row execute function public.apply_stock_movement();

-- =============================================================
-- گروه ۳: اشخاص
-- =============================================================

create table if not exists public.contacts (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  branch_id     uuid references public.branches(id) on delete set null,
  name          text not null,
  type          text not null default 'customer' check (type in ('customer','supplier','both')),
  phone         text,
  address       text,
  description   text,
  credit_limit  bigint not null default 0,
  opening_balance bigint not null default 0,  -- مثبت=طلب ما از او (بدهکار)
  tags          text[] default '{}',
  meta          jsonb default '{}'::jsonb,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id)
);

-- =============================================================
-- گروه ۴: خرید
-- =============================================================

create table if not exists public.purchases (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  branch_id     uuid references public.branches(id) on delete set null,
  supplier_id   uuid references public.contacts(id) on delete set null,
  invoice_no    text,
  date          timestamptz not null default now(),
  subtotal      bigint not null default 0,
  extra_total   bigint not null default 0,
  discount      bigint not null default 0,
  tax           bigint not null default 0,
  total         bigint not null default 0,
  paid          bigint not null default 0,
  status        text not null default 'confirmed' check (status in ('draft','confirmed','cancelled')),
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id)
);

create table if not exists public.purchase_items (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  branch_id     uuid references public.branches(id) on delete set null,
  purchase_id   uuid not null references public.purchases(id) on delete cascade,
  variant_id    uuid not null references public.product_variants(id) on delete restrict,
  qty           int not null,
  unit_price    bigint not null default 0,
  line_total    bigint not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id)
);

create table if not exists public.purchase_extra_costs (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  branch_id     uuid references public.branches(id) on delete set null,
  purchase_id   uuid not null references public.purchases(id) on delete cascade,
  title         text not null,
  amount        bigint not null default 0,
  allocation    text not null default 'by_value' check (allocation in ('by_qty','by_value')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id)
);

-- =============================================================
-- گروه ۵: فروش
-- (نکته: جدول accounts قبل از sales تعریف می‌شود چون sales به آن ارجاع دارد)
-- =============================================================

create table if not exists public.accounts (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  branch_id       uuid references public.branches(id) on delete set null,
  name            text not null,
  type            text not null default 'cash' check (type in ('cash','bank')),
  bank_name       text,
  account_no      text,
  opening_balance bigint not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id)
);

create table if not exists public.sales (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  branch_id     uuid references public.branches(id) on delete set null,
  customer_id   uuid references public.contacts(id) on delete set null,
  invoice_no    text,
  date          timestamptz not null default now(),
  subtotal      bigint not null default 0,
  discount      bigint not null default 0,
  tax           bigint not null default 0,
  total         bigint not null default 0,
  paid_cash     bigint not null default 0,
  paid_card     bigint not null default 0,
  paid_credit   bigint not null default 0,
  account_id    uuid references public.accounts(id) on delete set null,
  status        text not null default 'confirmed' check (status in ('draft','confirmed','cancelled','returned')),
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id)
);

create table if not exists public.sale_items (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  branch_id     uuid references public.branches(id) on delete set null,
  sale_id       uuid not null references public.sales(id) on delete cascade,
  variant_id    uuid not null references public.product_variants(id) on delete restrict,
  qty           int not null,
  unit_price    bigint not null default 0,
  discount      bigint not null default 0,
  line_total    bigint not null default 0,
  cost_price    bigint not null default 0,   -- قیمت تمام‌شده لحظه فروش (برای سود)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id)
);

-- =============================================================
-- گروه ۶: مالی
-- (جدول accounts بالاتر و پیش از sales تعریف شده است)
-- =============================================================

create table if not exists public.expense_categories (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  branch_id   uuid references public.branches(id) on delete set null,
  name        text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id)
);

create table if not exists public.transactions (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references public.organizations(id) on delete cascade,
  branch_id             uuid references public.branches(id) on delete set null,
  type                  text not null check (type in ('receipt','payment','expense','transfer','income')),
  amount                bigint not null,            -- همیشه مثبت
  date                  timestamptz not null default now(),
  account_id            uuid references public.accounts(id) on delete set null,
  to_account_id         uuid references public.accounts(id) on delete set null,
  contact_id            uuid references public.contacts(id) on delete set null,
  expense_category_id   uuid references public.expense_categories(id) on delete set null,
  ref_table             text,
  ref_id                uuid,
  method                text not null default 'cash' check (method in ('cash','card','transfer','cheque')),
  note                  text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by            uuid references auth.users(id)
);

create table if not exists public.settings (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  branch_id   uuid references public.branches(id) on delete set null,
  key         text not null,
  value       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id),
  unique (org_id, key)
);

-- =============================================================
-- triggers: updated_at روی همه جداول
-- =============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'organizations','branches','memberships','categories','brands','products',
    'product_variants','stock_movements','contacts','purchases','purchase_items',
    'purchase_extra_costs','sales','sale_items','accounts','expense_categories',
    'transactions','settings'
  ]
  loop
    execute format('drop trigger if exists trg_updated_%1$s on public.%1$s;', t);
    execute format('create trigger trg_updated_%1$s before update on public.%1$s
                    for each row execute function public.set_updated_at();', t);
  end loop;
end$$;

-- =============================================================
-- ایندکس‌ها (سرعت)
-- =============================================================
create index if not exists idx_variants_org      on public.product_variants(org_id);
create index if not exists idx_variants_product   on public.product_variants(product_id);
create index if not exists idx_variants_barcode   on public.product_variants(barcode);
create index if not exists idx_movements_variant  on public.stock_movements(variant_id);
create index if not exists idx_movements_org      on public.stock_movements(org_id);
create index if not exists idx_sales_org_date     on public.sales(org_id, date);
create index if not exists idx_saleitems_sale     on public.sale_items(sale_id);
create index if not exists idx_purchases_org_date on public.purchases(org_id, date);
create index if not exists idx_purchitems_purch   on public.purchase_items(purchase_id);
create index if not exists idx_trans_org_date     on public.transactions(org_id, date);
create index if not exists idx_trans_account      on public.transactions(account_id);
create index if not exists idx_trans_contact      on public.transactions(contact_id);
create index if not exists idx_contacts_org       on public.contacts(org_id);
create index if not exists idx_products_org       on public.products(org_id);

-- =============================================================
-- ویوها (Views)
-- =============================================================

-- مانده حساب‌ها (صندوق/بانک)
create or replace view public.account_balances as
select
  a.id as account_id, a.org_id, a.name, a.type,
  a.opening_balance
  + coalesce((select sum(t.amount) from public.transactions t
              where t.account_id = a.id and t.type in ('receipt','income')),0)
  - coalesce((select sum(t.amount) from public.transactions t
              where t.account_id = a.id and t.type in ('payment','expense')),0)
  - coalesce((select sum(t.amount) from public.transactions t
              where t.account_id = a.id and t.type = 'transfer'),0)
  + coalesce((select sum(t.amount) from public.transactions t
              where t.to_account_id = a.id and t.type = 'transfer'),0)
  as balance
from public.accounts a;

-- مانده اشخاص: مثبت = او به ما بدهکار است
create or replace view public.contact_balances as
select
  c.id as contact_id, c.org_id, c.name, c.type,
  c.opening_balance
  + coalesce((select sum(s.paid_credit) from public.sales s
              where s.customer_id = c.id and s.status = 'confirmed'),0)   -- نسیه فروش = بدهی مشتری
  - coalesce((select sum(t.amount) from public.transactions t
              where t.contact_id = c.id and t.type = 'receipt'),0)        -- دریافت از مشتری
  - coalesce((select sum(p.total - p.paid) from public.purchases p
              where p.supplier_id = c.id and p.status = 'confirmed'),0)   -- طلب تامین‌کننده = بدهی ما
  + coalesce((select sum(t.amount) from public.transactions t
              where t.contact_id = c.id and t.type = 'payment'),0)        -- پرداخت به تامین‌کننده
  as balance
from public.contacts c;

-- کالاهای کم‌موجود
create or replace view public.low_stock_variants as
select v.id as variant_id, v.org_id, p.name as product_name,
       v.color, v.size, v.sku, v.stock_qty, p.low_stock_threshold
from public.product_variants v
join public.products p on p.id = v.product_id
where v.is_active = true and v.stock_qty <= p.low_stock_threshold;

-- =============================================================
-- فعال‌سازی RLS و سیاست‌ها
-- =============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'organizations','branches','memberships','categories','brands','products',
    'product_variants','stock_movements','contacts','purchases','purchase_items',
    'purchase_extra_costs','sales','sale_items','accounts','expense_categories',
    'transactions','settings'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
  end loop;
end$$;

-- سیاست برای جداول دارای org_id (همه به جز organizations و memberships که جدا تعریف می‌شوند)
do $$
declare t text;
begin
  foreach t in array array[
    'branches','categories','brands','products',
    'product_variants','stock_movements','contacts','purchases','purchase_items',
    'purchase_extra_costs','sales','sale_items','accounts','expense_categories',
    'transactions','settings'
  ]
  loop
    execute format('drop policy if exists org_isolation on public.%I;', t);
    execute format($f$
      create policy org_isolation on public.%I
      for all
      using (org_id in (select public.user_org_ids()))
      with check (org_id in (select public.user_org_ids()));
    $f$, t);
  end loop;
end$$;

-- organizations: کاربر سازمان‌هایی را می‌بیند که عضو آن است یا مالک آن است
drop policy if exists org_select on public.organizations;
create policy org_select on public.organizations
  for select using (id in (select public.user_org_ids()) or owner_id = auth.uid());

drop policy if exists org_insert on public.organizations;
create policy org_insert on public.organizations
  for insert with check (owner_id = auth.uid());

drop policy if exists org_update on public.organizations;
create policy org_update on public.organizations
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- memberships: کاربر عضویت‌های خود را می‌بیند؛ مالک سازمان می‌تواند مدیریت کند
drop policy if exists mem_select on public.memberships;
create policy mem_select on public.memberships
  for select using (user_id = auth.uid() or org_id in (select public.user_org_ids()));

drop policy if exists mem_insert on public.memberships;
create policy mem_insert on public.memberships
  for insert with check (
    user_id = auth.uid()
    or org_id in (select id from public.organizations where owner_id = auth.uid())
  );

drop policy if exists mem_update on public.memberships;
create policy mem_update on public.memberships
  for update using (org_id in (select id from public.organizations where owner_id = auth.uid()));

-- =============================================================
-- پایان اسکیمای اولیه
-- =============================================================
