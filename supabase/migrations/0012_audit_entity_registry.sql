-- =============================================================
-- Hesabyar Migration 0012 - زیرساخت Audit Log و Entity Registry
-- نوع: UP migration
-- ایمنی: idempotent، بدون حذف داده، بدون اتصال trigger به جداول عملیاتی
-- نکته: فروش و خرید فیزیکی ادغام نمی‌شوند؛ فقط registry معماری ایجاد می‌شود.
-- =============================================================

-- -------------------------------------------------------------
-- بخش ۱) افزونه‌ها
-- pgcrypto: برای gen_random_uuid()
-- pg_trgm: برای جستجوی partial/fuzzy فارسی و SKU/نام در آینده
-- -------------------------------------------------------------
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- -------------------------------------------------------------
-- بخش ۲) جدول audit_logs
-- هدف: ثبت تغییرات حساس و عمومی موجودیت‌ها به صورت snapshot قبل/بعد
-- توجه: این جدول فعلاً به هیچ trigger عملیاتی وصل نمی‌شود.
-- -------------------------------------------------------------
create table if not exists public.audit_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid null,
  entity_type   text not null,
  entity_id     text not null,
  action        text not null,
  before_json   jsonb null,
  after_json    jsonb null,
  source        text null,
  created_at    timestamptz not null default now()
);

-- -------------------------------------------------------------
-- تکمیل idempotent ستون‌ها در صورت وجود نسخه ناقص از جدول
-- این بخش داده موجود را تغییر یا حذف نمی‌کند.
-- -------------------------------------------------------------
alter table if exists public.audit_logs
  add column if not exists user_id uuid null,
  add column if not exists entity_type text,
  add column if not exists entity_id text,
  add column if not exists action text,
  add column if not exists before_json jsonb null,
  add column if not exists after_json jsonb null,
  add column if not exists source text null,
  add column if not exists created_at timestamptz not null default now();

-- -------------------------------------------------------------
-- محدودیت‌های سبک برای کیفیت داده audit
-- فقط اگر constraint قبلاً وجود نداشته باشد اضافه می‌شود.
-- -------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'audit_logs_action_check'
      and conrelid = 'public.audit_logs'::regclass
  ) then
    alter table public.audit_logs
      add constraint audit_logs_action_check
      check (action in ('create','update','delete','reverse'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'audit_logs_entity_type_not_blank'
      and conrelid = 'public.audit_logs'::regclass
  ) then
    alter table public.audit_logs
      add constraint audit_logs_entity_type_not_blank
      check (length(trim(entity_type)) > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'audit_logs_entity_id_not_blank'
      and conrelid = 'public.audit_logs'::regclass
  ) then
    alter table public.audit_logs
      add constraint audit_logs_entity_id_not_blank
      check (length(trim(entity_id)) > 0);
  end if;
end $$;

-- -------------------------------------------------------------
-- ایندکس‌ها برای گزارش‌گیری و drill-down موجودیت‌ها
-- -------------------------------------------------------------
create index if not exists idx_audit_logs_entity
  on public.audit_logs (entity_type, entity_id);

create index if not exists idx_audit_logs_created_at_desc
  on public.audit_logs (created_at desc);

-- -------------------------------------------------------------
-- RLS برای audit_logs
-- سیاست عمومی تعریف نمی‌شود تا audit مستقیم از کلاینت قابل خواندن/نوشتن نباشد.
-- دسترسی آینده بهتر است از طریق API امن/service-role انجام شود.
-- -------------------------------------------------------------
alter table if exists public.audit_logs enable row level security;

-- -------------------------------------------------------------
-- بخش ۳) تابع trigger عمومی audit
-- فعلاً به هیچ جدولی وصل نمی‌شود.
-- نحوه استفاده آینده:
-- create trigger ... execute function public.fn_audit_trigger('sale');
-- اگر entity_type به عنوان آرگومان نیاید، نام جدول به عنوان fallback ثبت می‌شود.
-- -------------------------------------------------------------
create or replace function public.fn_audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_entity_type text;
  v_entity_id text;
  v_before jsonb;
  v_after jsonb;
  v_action text;
begin
  -- گرفتن user_id از Supabase Auth؛ اگر در context وجود نداشت NULL ثبت می‌شود.
  begin
    v_user_id := auth.uid();
  exception when others then
    v_user_id := null;
  end;

  -- تعیین نوع موجودیت از آرگومان trigger یا نام جدول
  v_entity_type := coalesce(nullif(tg_argv[0], ''), tg_table_name);

  if tg_op = 'INSERT' then
    v_action := 'create';
    v_before := null;
    v_after := to_jsonb(new);
    v_entity_id := v_after ->> 'id';

  elsif tg_op = 'UPDATE' then
    v_action := 'update';
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
    v_entity_id := coalesce(v_after ->> 'id', v_before ->> 'id');

  elsif tg_op = 'DELETE' then
    v_action := 'delete';
    v_before := to_jsonb(old);
    v_after := null;
    v_entity_id := v_before ->> 'id';

  else
    raise exception 'Unsupported trigger operation for audit: %', tg_op;
  end if;

  insert into public.audit_logs (
    user_id,
    entity_type,
    entity_id,
    action,
    before_json,
    after_json,
    source,
    created_at
  ) values (
    v_user_id,
    v_entity_type,
    coalesce(v_entity_id, ''),
    v_action,
    v_before,
    v_after,
    'trigger',
    now()
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

comment on function public.fn_audit_trigger() is
'تابع عمومی audit برای ثبت snapshot قبل/بعد INSERT/UPDATE/DELETE؛ فعلاً به هیچ جدول عملیاتی متصل نیست.';

-- -------------------------------------------------------------
-- بخش ۴) جدول entity_registry
-- هدف: نگاشت نوع موجودیت معماری Entity/Panel به جدول فیزیکی فعلی
-- این جدول هیچ ادغام فیزیکی بین sales و purchases انجام نمی‌دهد.
-- -------------------------------------------------------------
create table if not exists public.entity_registry (
  entity_type      text primary key,
  physical_table   text not null,
  panel_component  text not null,
  is_document      boolean not null default false
);

-- -------------------------------------------------------------
-- تکمیل idempotent ستون‌ها در صورت وجود نسخه ناقص از جدول
-- -------------------------------------------------------------
alter table if exists public.entity_registry
  add column if not exists physical_table text,
  add column if not exists panel_component text,
  add column if not exists is_document boolean not null default false;

-- -------------------------------------------------------------
-- محدودیت‌های سبک برای جلوگیری از مقدار خالی
-- -------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'entity_registry_physical_table_not_blank'
      and conrelid = 'public.entity_registry'::regclass
  ) then
    alter table public.entity_registry
      add constraint entity_registry_physical_table_not_blank
      check (length(trim(physical_table)) > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'entity_registry_panel_component_not_blank'
      and conrelid = 'public.entity_registry'::regclass
  ) then
    alter table public.entity_registry
      add constraint entity_registry_panel_component_not_blank
      check (length(trim(panel_component)) > 0);
  end if;
end $$;

-- -------------------------------------------------------------
-- RLS برای registry
-- خواندن registry برای کاربران authenticated مجاز است؛ تغییر آن فقط از migration/server انجام شود.
-- -------------------------------------------------------------
alter table if exists public.entity_registry enable row level security;

drop policy if exists entity_registry_select_authenticated on public.entity_registry;
create policy entity_registry_select_authenticated on public.entity_registry
  for select
  to authenticated
  using (true);

-- -------------------------------------------------------------
-- داده اولیه registry
-- ON CONFLICT DO NOTHING باعث می‌شود اجرای دوباره خطا ندهد و مقدار موجود overwrite نشود.
-- -------------------------------------------------------------
insert into public.entity_registry (
  entity_type,
  physical_table,
  panel_component,
  is_document
) values
  ('contact', 'contacts', 'ContactPanel', false),
  ('product', 'products', 'ProductPanel', false),
  ('product_variant', 'product_variants', 'ProductPanel', false),
  ('sale', 'sales', 'InvoicePanel', true),
  ('purchase', 'purchases', 'InvoicePanel', true),
  ('transaction', 'transactions', 'TransactionPanel', false),
  ('stock_movement', 'stock_movements', 'StockMovementPanel', false)
on conflict (entity_type) do nothing;

-- =============================================================
-- پایان UP migration 0012
-- =============================================================
