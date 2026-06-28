-- =============================================================
-- حساب‌یار - آپدیت ۵: امکانات پیشرفته مالی و فروشگاهی
-- برای مهرجامه - بر اساس لیست درخواستی
-- این فایل را در Supabase > SQL Editor اجرا کنید.
-- =============================================================

-- =============================================================
-- ۱) لاگ فعالیت‌ها (Activity Logs)
-- =============================================================
create table if not exists public.activity_logs (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,
  action      text not null,          -- 'create', 'update', 'delete', 'login', 'logout'
  entity_type text not null,          -- 'sale', 'purchase', 'product', 'contact', 'transaction'
  entity_id   uuid,
  old_data    jsonb,
  new_data    jsonb,
  ip_address  text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_activity_logs_org     on public.activity_logs(org_id);
create index if not exists idx_activity_logs_user    on public.activity_logs(user_id);
create index if not exists idx_activity_logs_entity  on public.activity_logs(entity_type, entity_id);
create index if not exists idx_activity_logs_date    on public.activity_logs(created_at);

-- trigger updated_at
drop trigger if exists trg_updated_activity_logs on public.activity_logs;
create trigger trg_updated_activity_logs before update on public.activity_logs
  for each row execute function public.set_updated_at();

-- RLS
alter table public.activity_logs enable row level security;
drop policy if exists activity_logs_policy on public.activity_logs;
create policy activity_logs_policy on public.activity_logs
  for all using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

-- =============================================================
-- ۲) سفارش‌های فروش (Sales Orders / Pre-Invoices)
-- =============================================================
create table if not exists public.sales_orders (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  branch_id     uuid references public.branches(id) on delete set null,
  customer_id   uuid references public.contacts(id) on delete set null,
  order_no      text,
  date          timestamptz not null default now(),
  expiry_date   timestamptz,
  subtotal      bigint not null default 0,
  discount      bigint not null default 0,
  tax           bigint not null default 0,
  total         bigint not null default 0,
  status        text not null default 'pending' 
                check (status in ('pending','confirmed','converted','cancelled','expired')),
  converted_to_id uuid references public.sales(id) on delete set null,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id)
);

create table if not exists public.sales_order_items (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  branch_id     uuid references public.branches(id) on delete set null,
  order_id      uuid not null references public.sales_orders(id) on delete cascade,
  variant_id    uuid not null references public.product_variants(id) on delete restrict,
  qty           int not null,
  unit_price    bigint not null default 0,
  discount      bigint not null default 0,
  line_total    bigint not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id)
);

create index if not exists idx_sales_orders_org_date   on public.sales_orders(org_id, date);
create index if not exists idx_sales_orders_customer   on public.sales_orders(customer_id);
create index if not exists idx_sales_order_items_order on public.sales_order_items(order_id);

drop trigger if exists trg_updated_sales_orders on public.sales_orders;
create trigger trg_updated_sales_orders before update on public.sales_orders
  for each row execute function public.set_updated_at();

drop trigger if exists trg_updated_sales_order_items on public.sales_order_items;
create trigger trg_updated_sales_order_items before update on public.sales_order_items
  for each row execute function public.set_updated_at();

alter table public.sales_orders enable row level security;
drop policy if exists sales_orders_policy on public.sales_orders;
create policy sales_orders_policy on public.sales_orders
  for all using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

alter table public.sales_order_items enable row level security;
drop policy if exists sales_order_items_policy on public.sales_order_items;
create policy sales_order_items_policy on public.sales_order_items
  for all using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

-- تولید خودکار شماره سفارش
create or replace function public.next_order_no(p_org uuid, p_prefix text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_count bigint;
begin
  select count(*) into v_count from public.sales_orders where org_id = p_org;
  return p_prefix || '-' || lpad((v_count + 1)::text, 5, '0');
end;
$$;

-- =============================================================
-- ۳) سفارش‌های خرید (Purchase Orders)
-- =============================================================
create table if not exists public.purchase_orders (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  branch_id     uuid references public.branches(id) on delete set null,
  supplier_id   uuid references public.contacts(id) on delete set null,
  order_no      text,
  date          timestamptz not null default now(),
  expiry_date   timestamptz,
  subtotal      bigint not null default 0,
  extra_total   bigint not null default 0,
  discount      bigint not null default 0,
  tax           bigint not null default 0,
  total         bigint not null default 0,
  status        text not null default 'pending'
                check (status in ('pending','confirmed','converted','cancelled','expired')),
  converted_to_id uuid references public.purchases(id) on delete set null,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id)
);

create table if not exists public.purchase_order_items (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  branch_id     uuid references public.branches(id) on delete set null,
  order_id      uuid not null references public.purchase_orders(id) on delete cascade,
  variant_id    uuid not null references public.product_variants(id) on delete restrict,
  qty           int not null,
  unit_price    bigint not null default 0,
  line_total    bigint not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id)
);

create index if not exists idx_purchase_orders_org_date  on public.purchase_orders(org_id, date);
create index if not exists idx_purchase_orders_supplier  on public.purchase_orders(supplier_id);
create index if not exists idx_purchase_order_items_order on public.purchase_order_items(order_id);

drop trigger if exists trg_updated_purchase_orders on public.purchase_orders;
create trigger trg_updated_purchase_orders before update on public.purchase_orders
  for each row execute function public.set_updated_at();

drop trigger if exists trg_updated_purchase_order_items on public.purchase_order_items;
create trigger trg_updated_purchase_order_items before update on public.purchase_order_items
  for each row execute function public.set_updated_at();

alter table public.purchase_orders enable row level security;
drop policy if exists purchase_orders_policy on public.purchase_orders;
create policy purchase_orders_policy on public.purchase_orders
  for all using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

alter table public.purchase_order_items enable row level security;
drop policy if exists purchase_order_items_policy on public.purchase_order_items;
create policy purchase_order_items_policy on public.purchase_order_items
  for all using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

-- =============================================================
-- ۴) مرجوعی فروش (Sales Returns)
-- =============================================================
create table if not exists public.sales_returns (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  branch_id     uuid references public.branches(id) on delete set null,
  original_sale_id uuid references public.sales(id) on delete set null,
  customer_id   uuid references public.contacts(id) on delete set null,
  return_no     text,
  date          timestamptz not null default now(),
  total         bigint not null default 0,
  refund_method text not null default 'cash' check (refund_method in ('cash','card','credit')),
  account_id    uuid references public.accounts(id) on delete set null,
  reason        text,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id)
);

create table if not exists public.sales_return_items (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  branch_id     uuid references public.branches(id) on delete set null,
  return_id     uuid not null references public.sales_returns(id) on delete cascade,
  sale_item_id  uuid references public.sale_items(id) on delete restrict,
  variant_id    uuid not null references public.product_variants(id) on delete restrict,
  qty           int not null,
  unit_price    bigint not null default 0,   -- قیمتی که برگشت داده شد
  line_total    bigint not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id)
);

create index if not exists idx_sales_returns_org_date on public.sales_returns(org_id, date);
create index if not exists idx_sales_returns_original  on public.sales_returns(original_sale_id);
create index if not exists idx_sales_return_items_return on public.sales_return_items(return_id);

drop trigger if exists trg_updated_sales_returns on public.sales_returns;
create trigger trg_updated_sales_returns before update on public.sales_returns
  for each row execute function public.set_updated_at();

drop trigger if exists trg_updated_sales_return_items on public.sales_return_items;
create trigger trg_updated_sales_return_items before update on public.sales_return_items
  for each row execute function public.set_updated_at();

alter table public.sales_returns enable row level security;
drop policy if exists sales_returns_policy on public.sales_returns;
create policy sales_returns_policy on public.sales_returns
  for all using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

alter table public.sales_return_items enable row level security;
drop policy if exists sales_return_items_policy on public.sales_return_items;
create policy sales_return_items_policy on public.sales_return_items
  for all using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

-- =============================================================
-- ۵) مرجوعی خرید (Purchase Returns)
-- =============================================================
create table if not exists public.purchase_returns (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  branch_id     uuid references public.branches(id) on delete set null,
  original_purchase_id uuid references public.purchases(id) on delete set null,
  supplier_id   uuid references public.contacts(id) on delete set null,
  return_no     text,
  date          timestamptz not null default now(),
  total         bigint not null default 0,
  refund_method text not null default 'cash' check (refund_method in ('cash','transfer','credit')),
  account_id    uuid references public.accounts(id) on delete set null,
  reason        text,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id)
);

create table if not exists public.purchase_return_items (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  branch_id     uuid references public.branches(id) on delete set null,
  return_id     uuid not null references public.purchase_returns(id) on delete cascade,
  purchase_item_id uuid references public.purchase_items(id) on delete restrict,
  variant_id    uuid not null references public.product_variants(id) on delete restrict,
  qty           int not null,
  unit_price    bigint not null default 0,
  line_total    bigint not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id)
);

create index if not exists idx_purchase_returns_org_date on public.purchase_returns(org_id, date);
create index if not exists idx_purchase_returns_original on public.purchase_returns(original_purchase_id);
create index if not exists idx_purchase_return_items_return on public.purchase_return_items(return_id);

drop trigger if exists trg_updated_purchase_returns on public.purchase_returns;
create trigger trg_updated_purchase_returns before update on public.purchase_returns
  for each row execute function public.set_updated_at();

drop trigger if exists trg_updated_purchase_return_items on public.purchase_return_items;
create trigger trg_updated_purchase_return_items before update on public.purchase_return_items
  for each row execute function public.set_updated_at();

alter table public.purchase_returns enable row level security;
drop policy if exists purchase_returns_policy on public.purchase_returns;
create policy purchase_returns_policy on public.purchase_returns
  for all using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

alter table public.purchase_return_items enable row level security;
drop policy if exists purchase_return_items_policy on public.purchase_return_items;
create policy purchase_return_items_policy on public.purchase_return_items
  for all using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

-- =============================================================
-- ۶) مدیریت چک‌ها (Check Management)
-- =============================================================
create table if not exists public.checks (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  branch_id       uuid references public.branches(id) on delete set null,
  type            text not null check (type in ('received','issued')),
  status          text not null default 'pending'
                  check (status in ('pending','deposited','returned','cashed','cancelled')),
  check_no        text,
  bank_name       text,
  account_no      text,
  amount          bigint not null,
  issue_date      timestamptz not null default now(),
  due_date        timestamptz not null,
  contact_id      uuid references public.contacts(id) on delete set null,
  account_id      uuid references public.accounts(id) on delete set null,
  -- برای چک دریافتی: وقتی وصول شد
  cashed_date     timestamptz,
  -- برای چک صادره: وقتی پرداخت شد
  paid_date       timestamptz,
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id)
);

create index if not exists idx_checks_org_type       on public.checks(org_id, type);
create index if not exists idx_checks_status         on public.checks(status);
create index if not exists idx_checks_contact        on public.checks(contact_id);
create index if not exists idx_checks_due_date       on public.checks(due_date);
create index if not exists idx_checks_account        on public.checks(account_id);

drop trigger if exists trg_updated_checks on public.checks;
create trigger trg_updated_checks before update on public.checks
  for each row execute function public.set_updated_at();

alter table public.checks enable row level security;
drop policy if exists checks_policy on public.checks;
create policy checks_policy on public.checks
  for all using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

-- =============================================================
-- ۷) تعاملات مشتری (Contact Interactions / CRM)
-- =============================================================
create table if not exists public.contact_interactions (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  contact_id    uuid not null references public.contacts(id) on delete cascade,
  type          text not null check (type in ('call','visit','email','sms','note','meeting','complaint','follow_up')),
  title         text,
  description   text,
  next_followup timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id)
);

create index if not exists idx_contact_interactions_contact on public.contact_interactions(contact_id);
create index if not exists idx_contact_interactions_type   on public.contact_interactions(type);
create index if not exists idx_contact_interactions_followup on public.contact_interactions(next_followup);

drop trigger if exists trg_updated_contact_interactions on public.contact_interactions;
create trigger trg_updated_contact_interactions before update on public.contact_interactions
  for each row execute function public.set_updated_at();

alter table public.contact_interactions enable row level security;
drop policy if exists contact_interactions_policy on public.contact_interactions;
create policy contact_interactions_policy on public.contact_interactions
  for all using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

-- =============================================================
-- ۸) قیمت‌گذاری چند سطحی (Price Lists)
-- =============================================================
create table if not exists public.price_lists (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null,
  type        text not null default 'customer_level' 
              check (type in ('customer_level','special','wholesale','seasonal')),
  discount_percent bigint not null default 0,  -- درصد تخفیف
  valid_from  timestamptz,
  valid_to    timestamptz,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id)
);

create table if not exists public.price_list_items (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  price_list_id   uuid not null references public.price_lists(id) on delete cascade,
  variant_id      uuid not null references public.product_variants(id) on delete cascade,
  price           bigint,      -- قیمت خاص (اگر null باشد، از درصد تخفیف استفاده می‌شود)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id)
);

create index if not exists idx_price_list_items_list on public.price_list_items(price_list_id);
create index if not exists idx_price_list_items_variant on public.price_list_items(variant_id);

drop trigger if exists trg_updated_price_lists on public.price_lists;
create trigger trg_updated_price_lists before update on public.price_lists
  for each row execute function public.set_updated_at();

drop trigger if exists trg_updated_price_list_items on public.price_list_items;
create trigger trg_updated_price_list_items before update on public.price_list_items
  for each row execute function public.set_updated_at();

alter table public.price_lists enable row level security;
drop policy if exists price_lists_policy on public.price_lists;
create policy price_lists_policy on public.price_lists
  for all using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

alter table public.price_list_items enable row level security;
drop policy if exists price_list_items_policy on public.price_list_items;
create policy price_list_items_policy on public.price_list_items
  for all using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

-- =============================================================
-- ۹) فیلدهای اضافی محصول (رنگ/سایز/فصل/جنس)
-- =============================================================
-- اضافه کردن ستون‌های جدید به product_variants اگر وجود ندارند
alter table public.product_variants add column if not exists season    text;
alter table public.product_variants add column if not exists material  text;
alter table public.product_variants add column if not exists collection text;

-- ایندکس برای گزارش‌گیری
create index if not exists idx_variants_color    on public.product_variants(color) where color is not null;
create index if not exists idx_variants_size     on public.product_variants(size) where size is not null;
create index if not exists idx_variants_season   on public.product_variants(season) where season is not null;

-- =============================================================
-- ۱۰) گزارش‌های پیشرفته (Views & Functions)
-- =============================================================

-- الف) کالاهای پرفروش (Top Selling Products)
create or replace view public.top_selling_products as
select 
  p.id as product_id,
  p.name as product_name,
  p.category_id,
  c.name as category_name,
  sum(si.qty) as total_sold_qty,
  sum(si.line_total) as total_sales_amount,
  sum(si.line_total - si.cost_price * si.qty) as total_profit,
  count(distinct s.id) as order_count
from public.sale_items si
join public.products p on p.id = si.variant_id
left join public.categories c on c.id = p.category_id
join public.sales s on s.id = si.sale_id
where s.status = 'confirmed'
group by p.id, p.name, p.category_id, c.name
order by total_sold_qty desc;

-- ب) فروش بر اساس دسته‌بندی
create or replace view public.sales_by_category as
select 
  p.category_id,
  c.name as category_name,
  date_trunc('month', s.date) as month,
  sum(si.qty) as total_qty,
  sum(si.line_total) as total_amount,
  sum(si.line_total - si.cost_price * si.qty) as total_profit
from public.sale_items si
join public.products p on p.id = si.variant_id
left join public.categories c on c.id = p.category_id
join public.sales s on s.id = si.sale_id
where s.status = 'confirmed'
group by p.category_id, c.name, date_trunc('month', s.date)
order by month desc, total_amount desc;

-- ج) فروش بر اساس رنگ (مخصوص پوشاک)
create or replace view public.sales_by_color as
select
  v.color,
  sum(si.qty) as total_sold_qty,
  sum(si.line_total) as total_amount
from public.sale_items si
join public.product_variants v on v.id = si.variant_id
join public.sales s on s.id = si.sale_id
where s.status = 'confirmed' and v.color is not null
group by v.color
order by total_sold_qty desc;

-- د) فروش بر اساس سایز
create or replace view public.sales_by_size as
select
  v.size,
  sum(si.qty) as total_sold_qty,
  sum(si.line_total) as total_amount
from public.sale_items si
join public.product_variants v on v.id = si.variant_id
join public.sales s on s.id = si.sale_id
where s.status = 'confirmed' and v.size is not null
group by v.size
order by total_sold_qty desc;

-- هـ) کالاهای کم‌فروش (Low Selling)
create or replace view public.low_selling_products as
select 
  p.id as product_id,
  p.name as product_name,
  p.category_id,
  c.name as category_name,
  coalesce(sum(si.qty), 0) as total_sold_qty,
  coalesce(sum(si.line_total), 0) as total_sales_amount
from public.products p
left join public.categories c on c.id = p.category_id
left join public.sale_items si on si.variant_id in (
  select id from public.product_variants where product_id = p.id
)
left join public.sales s on s.id = si.sale_id and s.status = 'confirmed'
group by p.id, p.name, p.category_id, c.name
having coalesce(sum(si.qty), 0) < 5
order by total_sold_qty asc;

-- و) سود و زیان تفصیلی (Profit & Loss)
create or replace function public.profit_loss_report(p_org uuid, p_start date, p_end date)
returns table(
  category text,
  amount bigint
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return query
  -- فروش
  select 'فروش'::text as category, 
         coalesce(sum(s.total), 0)::bigint as amount
  from public.sales s
  where s.org_id = p_org and s.status = 'confirmed' 
    and s.date::date >= p_start and s.date::date <= p_end
  union all
  -- برگشت از فروش
  select 'برگشت از فروش'::text,
         coalesce(sum(sr.total), 0)::bigint
  from public.sales_returns sr
  where sr.org_id = p_org and sr.date::date >= p_start and sr.date::date <= p_end
  union all
  -- بهای تمام شده کالاهای فروش رفته
  select 'بهای کالای فروش رفته'::text,
         coalesce(sum(si.cost_price * si.qty), 0)::bigint * -1
  from public.sale_items si
  join public.sales s on s.id = si.sale_id
  where s.org_id = p_org and s.status = 'confirmed'
    and s.date::date >= p_start and s.date::date <= p_end
  union all
  -- خرید
  select 'خرید'::text,
         coalesce(sum(pu.total), 0)::bigint * -1
  from public.purchases pu
  where pu.org_id = p_org and pu.status = 'confirmed'
    and pu.date::date >= p_start and pu.date::date <= p_end
  union all
  -- برگشت از خرید
  select 'برگشت از خرید'::text,
         coalesce(sum(pr.total), 0)::bigint
  from public.purchase_returns pr
  where pr.org_id = p_org and pr.date::date >= p_start and pr.date::date <= p_end
  union all
  -- هزینه‌ها
  select 'هزینه‌ها'::text,
         coalesce(sum(t.amount), 0)::bigint * -1
  from public.transactions t
  where t.org_id = p_org and t.type = 'expense'
    and t.date::date >= p_start and t.date::date <= p_end
  union all
  -- درآمدهای متفرقه
  select 'درآمد متفرقه'::text,
         coalesce(sum(t.amount), 0)::bigint
  from public.transactions t
  where t.org_id = p_org and t.type = 'income'
    and t.date::date >= p_start and t.date::date <= p_end;
end;
$$;

-- ز) کاردکس کالا (Stock Card / Movement History)
create or replace function public.stock_card(p_variant uuid)
returns table(
  date timestamptz,
  type text,
  reason text,
  qty int,
  balance int,
  ref text,
  note text
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_balance int := 0;
begin
  -- موجودی اولیه
  select stock_qty into v_balance from public.product_variants where id = p_variant;
  
  return query
  select 
    sm.created_at as date,
    sm.type,
    sm.reason,
    sm.qty,
    v_balance + sm.qty as balance,
    coalesce(sm.ref_table, '') || coalesce(' - ' || sm.ref_id::text, '') as ref,
    coalesce(sm.note, '') as note
  from public.stock_movements sm
  where sm.variant_id = p_variant
  order by sm.created_at;
end;
$$;

-- ح) گردش نقدینگی (Cash Flow)
create or replace function public.cash_flow(p_org uuid, p_start date, p_end date)
returns table(
  category text,
  amount bigint
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return query
  -- دریافت‌های نقدی
  select 'دریافت نقدی'::text,
         coalesce(sum(t.amount), 0)::bigint
  from public.transactions t
  where t.org_id = p_org and t.type = 'receipt' and t.method = 'cash'
    and t.date::date >= p_start and t.date::date <= p_end
  union all
  -- دریافت کارتی
  select 'دریافت کارتی'::text,
         coalesce(sum(t.amount), 0)::bigint
  from public.transactions t
  where t.org_id = p_org and t.type = 'receipt' and t.method = 'card'
    and t.date::date >= p_start and t.date::date <= p_end
  union all
  -- پرداخت‌های نقدی
  select 'پرداخت نقدی'::text,
         coalesce(sum(t.amount), 0)::bigint * -1
  from public.transactions t
  where t.org_id = p_org and t.type = 'payment' and t.method = 'cash'
    and t.date::date >= p_start and t.date::date <= p_end
  union all
  -- برگشت چک
  select 'برگشت چک'::text,
         coalesce(sum(ch.amount), 0)::bigint * -1
  from public.checks ch
  where ch.org_id = p_org and ch.type = 'received' and ch.status = 'returned'
    and ch.issue_date::date >= p_start and ch.issue_date::date <= p_end
  union all
  -- وصول چک
  select 'وصول چک'::text,
         coalesce(sum(ch.amount), 0)::bigint
  from public.checks ch
  where ch.org_id = p_org and ch.type = 'received' and ch.status = 'cashed'
    and ch.cashed_date::date >= p_start and ch.cashed_date::date <= p_end;
end;
$$;

-- =============================================================
-- ۱۱) ایندکس‌های جدید برای گزارش‌گیری سریع
-- =============================================================
create index if not exists idx_sale_items_variant    on public.sale_items(variant_id);
create index if not exists idx_sale_items_sale_date on public.sale_items(sale_id);
create index if not exists idx_products_category    on public.products(category_id);
create index if not exists idx_products_brand       on public.products(brand_id);

-- =============================================================
-- پایان آپدیت ۵
-- =============================================================