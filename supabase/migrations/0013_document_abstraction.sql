-- =============================================================
-- Hesabyar Migration 0013 - لایه یکپارچه Document Read-Model
-- نوع: UP migration
-- ایمنی: idempotent، بدون حذف/ادغام فیزیکی sales و purchases، بدون trigger عملیاتی
-- هدف: ساخت registry اسناد و viewهای v_documents و v_document_lines روی جداول فعلی
-- =============================================================

-- -------------------------------------------------------------
-- بخش ۱) جدول document_registry
-- این جدول فقط نگاشت معماری Document به جدول‌های فیزیکی فعلی را نگه می‌دارد.
-- هیچ داده عملیاتی فروش/خرید ادغام یا منتقل نمی‌شود.
-- -------------------------------------------------------------
create table if not exists public.document_registry (
  doc_type        text primary key,
  physical_table  text not null,
  lines_table     text not null,
  direction       text not null,
  stock_effect    int not null,
  is_active       boolean not null default true
);

-- تکمیل idempotent در صورت وجود نسخه ناقص از جدول
alter table if exists public.document_registry
  add column if not exists physical_table text,
  add column if not exists lines_table text,
  add column if not exists direction text,
  add column if not exists stock_effect int,
  add column if not exists is_active boolean not null default true;

-- محدودیت‌های سبک و سازگار برای کیفیت registry
-- از DO استفاده شده تا اجرای دوباره migration خطا ندهد.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'document_registry_direction_check'
      and conrelid = 'public.document_registry'::regclass
  ) then
    alter table public.document_registry
      add constraint document_registry_direction_check
      check (direction in ('in', 'out'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'document_registry_stock_effect_check'
      and conrelid = 'public.document_registry'::regclass
  ) then
    alter table public.document_registry
      add constraint document_registry_stock_effect_check
      check (stock_effect in (-1, 0, 1));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'document_registry_physical_table_not_blank'
      and conrelid = 'public.document_registry'::regclass
  ) then
    alter table public.document_registry
      add constraint document_registry_physical_table_not_blank
      check (length(trim(physical_table)) > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'document_registry_lines_table_not_blank'
      and conrelid = 'public.document_registry'::regclass
  ) then
    alter table public.document_registry
      add constraint document_registry_lines_table_not_blank
      check (length(trim(lines_table)) > 0);
  end if;
end $$;

-- RLS برای registry سند: خواندن برای کاربران authenticated مجاز است.
-- تغییر registry باید فقط از migration/server انجام شود.
alter table if exists public.document_registry enable row level security;

drop policy if exists document_registry_select_authenticated on public.document_registry;
create policy document_registry_select_authenticated on public.document_registry
  for select
  to authenticated
  using (true);

-- داده اولیه: فعلاً فقط sale و purchase فعال می‌شوند.
-- فروش خروجی انبار دارد، خرید ورودی انبار دارد.
insert into public.document_registry (
  doc_type,
  physical_table,
  lines_table,
  direction,
  stock_effect,
  is_active
) values
  ('sale', 'sales', 'sale_items', 'out', -1, true),
  ('purchase', 'purchases', 'purchase_items', 'in', 1, true)
on conflict (doc_type) do nothing;

-- -------------------------------------------------------------
-- بخش ۲) افزودن ستون‌های استاندارد به sales و purchases
-- ستون branch_id از قبل وجود دارد، اما ADD COLUMN IF NOT EXISTS ایمن است.
-- warehouse_id فعلاً nullable است چون جدول warehouse هنوز در schema فعلی وجود ندارد.
-- reversed_at/reversed_by برای استانداردسازی reverse در کنار cancelled_at/cancelled_by اضافه می‌شود.
-- -------------------------------------------------------------
alter table if exists public.sales
  add column if not exists status text not null default 'confirmed',
  add column if not exists branch_id uuid null,
  add column if not exists warehouse_id uuid null,
  add column if not exists reversed_at timestamptz null,
  add column if not exists reversed_by uuid null;

alter table if exists public.purchases
  add column if not exists status text not null default 'confirmed',
  add column if not exists branch_id uuid null,
  add column if not exists warehouse_id uuid null,
  add column if not exists reversed_at timestamptz null,
  add column if not exists reversed_by uuid null;

-- -------------------------------------------------------------
-- سازگاری status با معماری جدید Document
-- نکته مهم: در schema فعلی status از قبل با check legacy وجود دارد:
-- sales: draft/confirmed/cancelled/returned
-- purchases: draft/confirmed/cancelled
-- برای جلوگیری از شکست داده‌های موجود و کد فعلی، constraint سازگار شامل statusهای جدید و legacy است.
-- read-model در v_documents مقدار legacy cancelled/returned را به reversed نرمال می‌کند.
-- -------------------------------------------------------------
do $$
declare
  v_attnum int;
  r record;
begin
  -- sales: حذف checkهای قبلی متصل به ستون status، سپس افزودن check سازگار
  select attnum into v_attnum
  from pg_attribute
  where attrelid = 'public.sales'::regclass
    and attname = 'status'
    and not attisdropped;

  if v_attnum is not null then
    for r in
      select conname
      from pg_constraint
      where conrelid = 'public.sales'::regclass
        and contype = 'c'
        and v_attnum = any(conkey)
        and conname <> 'sales_status_document_compat_check'
    loop
      execute format('alter table public.sales drop constraint if exists %I', r.conname);
    end loop;

    if not exists (
      select 1 from pg_constraint
      where conname = 'sales_status_document_compat_check'
        and conrelid = 'public.sales'::regclass
    ) then
      alter table public.sales
        add constraint sales_status_document_compat_check
        check (status in ('draft','confirmed','paid','settled','reversed','cancelled','returned'));
    end if;
  end if;

  -- purchases: حذف checkهای قبلی متصل به ستون status، سپس افزودن check سازگار
  select attnum into v_attnum
  from pg_attribute
  where attrelid = 'public.purchases'::regclass
    and attname = 'status'
    and not attisdropped;

  if v_attnum is not null then
    for r in
      select conname
      from pg_constraint
      where conrelid = 'public.purchases'::regclass
        and contype = 'c'
        and v_attnum = any(conkey)
        and conname <> 'purchases_status_document_compat_check'
    loop
      execute format('alter table public.purchases drop constraint if exists %I', r.conname);
    end loop;

    if not exists (
      select 1 from pg_constraint
      where conname = 'purchases_status_document_compat_check'
        and conrelid = 'public.purchases'::regclass
    ) then
      alter table public.purchases
        add constraint purchases_status_document_compat_check
        check (status in ('draft','confirmed','paid','settled','reversed','cancelled'));
    end if;
  end if;
end $$;

-- -------------------------------------------------------------
-- بخش ۳) View یکپارچه v_documents
-- این view فقط read-model است و هیچ داده‌ای را جابه‌جا نمی‌کند.
-- paid_amount فروش = paid_cash + paid_card؛ paid_credit نسیه/مانده است و پرداخت محسوب نمی‌شود.
-- statusهای legacy مثل cancelled/returned به reversed نرمال می‌شوند.
-- -------------------------------------------------------------
drop view if exists public.v_document_lines;
drop view if exists public.v_documents;

create or replace view public.v_documents
with (security_invoker = true)
as
select
  s.id::uuid as doc_id,
  'sale'::text as doc_type,
  'sales'::text as physical_table,
  s.customer_id::uuid as contact_id,
  s.date::timestamptz as doc_date,
  coalesce(s.subtotal, 0)::bigint as subtotal,
  coalesce(s.discount, 0)::bigint as discount_amount,
  coalesce(s.total, 0)::bigint as total,
  (coalesce(s.paid_cash, 0) + coalesce(s.paid_card, 0))::bigint as paid_amount,
  case
    when s.status in ('cancelled', 'returned') then 'reversed'
    else coalesce(s.status, 'confirmed')
  end::text as status
from public.sales s

union all

select
  p.id::uuid as doc_id,
  'purchase'::text as doc_type,
  'purchases'::text as physical_table,
  p.supplier_id::uuid as contact_id,
  p.date::timestamptz as doc_date,
  coalesce(p.subtotal, 0)::bigint as subtotal,
  coalesce(p.discount, 0)::bigint as discount_amount,
  coalesce(p.total, 0)::bigint as total,
  coalesce(p.paid, 0)::bigint as paid_amount,
  case
    when p.status = 'cancelled' then 'reversed'
    else coalesce(p.status, 'confirmed')
  end::text as status
from public.purchases p;

comment on view public.v_documents is
'Read-model یکپارچه اسناد روی sales و purchases؛ بدون ادغام فیزیکی داده.';

-- -------------------------------------------------------------
-- بخش ۴) View یکپارچه v_document_lines
-- product_id از طریق product_variants استخراج می‌شود.
-- unit_price در sale_items و purchase_items snapshot است.
-- purchase_items ستون discount ندارد؛ مقدار 0 نرمال می‌شود.
-- -------------------------------------------------------------
create or replace view public.v_document_lines
with (security_invoker = true)
as
select
  si.id::uuid as line_id,
  si.sale_id::uuid as doc_id,
  'sale'::text as doc_type,
  pv.product_id::uuid as product_id,
  si.variant_id::uuid as product_variant_id,
  coalesce(si.qty, 0)::numeric as qty,
  coalesce(si.unit_price, 0)::bigint as unit_price,
  coalesce(si.discount, 0)::bigint as discount,
  coalesce(si.line_total, 0)::bigint as line_total
from public.sale_items si
left join public.product_variants pv on pv.id = si.variant_id

union all

select
  pi.id::uuid as line_id,
  pi.purchase_id::uuid as doc_id,
  'purchase'::text as doc_type,
  pv.product_id::uuid as product_id,
  pi.variant_id::uuid as product_variant_id,
  coalesce(pi.qty, 0)::numeric as qty,
  coalesce(pi.unit_price, 0)::bigint as unit_price,
  0::bigint as discount,
  coalesce(pi.line_total, 0)::bigint as line_total
from public.purchase_items pi
left join public.product_variants pv on pv.id = pi.variant_id;

comment on view public.v_document_lines is
'Read-model یکپارچه اقلام اسناد روی sale_items و purchase_items؛ قیمت واحد snapshot خط سند است.';

-- -------------------------------------------------------------
-- بخش ۵) Snapshot قیمت
-- نتیجه بررسی ساختار: unit_price در هر دو جدول sale_items و purchase_items وجود دارد.
-- بنابراین backfill اجباری لازم نیست.
-- قانون معماری: تغییر قیمت محصول نباید فاکتورهای قدیمی را تغییر دهد.
-- -------------------------------------------------------------

-- =============================================================
-- پایان UP migration 0013
-- =============================================================
