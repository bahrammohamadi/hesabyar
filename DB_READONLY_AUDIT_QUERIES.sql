-- =============================================================
-- گزارش‌گیری فقط-خواندنی از وضعیت فعلی دیتابیس Supabase/PostgreSQL
-- پروژه: hesabyar
-- نکته مهم: این فایل هیچ دستور تغییردهنده‌ای ندارد.
-- مجاز: SELECT / WITH فقط
-- غیرمجاز در این فایل: CREATE / ALTER / DROP / INSERT / UPDATE / DELETE
-- =============================================================

-- -------------------------------------------------------------
-- 0) اطلاعات کلی دیتابیس و زمان اجرای گزارش
-- -------------------------------------------------------------
select
  current_database() as database_name,
  current_schema() as current_schema,
  current_user as current_user,
  now() as generated_at;

-- -------------------------------------------------------------
-- 1-A) تعداد تقریبی رکوردهای تمام جداول public
-- نکته: این روش سریع است و از pg_class.reltuples استفاده می‌کند.
-- برای تعداد دقیق، خروجی کوئری 1-B را اجرا کنید.
-- -------------------------------------------------------------
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.reltuples::bigint as estimated_rows,
  pg_size_pretty(pg_total_relation_size(c.oid)) as total_size,
  pg_size_pretty(pg_relation_size(c.oid)) as table_size,
  pg_size_pretty(pg_indexes_size(c.oid)) as indexes_size
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relname;

-- -------------------------------------------------------------
-- 1-B) تولید SQL برای شمارش دقیق رکوردهای تمام جداول public
-- این کوئری خودش داده را تغییر نمی‌دهد؛ فقط یک SQL دیگر تولید می‌کند.
-- خروجی generated_sql را کپی و اجرا کنید تا count دقیق بگیرید.
-- -------------------------------------------------------------
select string_agg(
  format(
    'select %L as schema_name, %L as table_name, count(*)::bigint as exact_rows from %I.%I',
    schemaname,
    tablename,
    schemaname,
    tablename
  ),
  E'\nunion all\n'
  order by tablename
) || E'\norder by table_name;' as generated_sql
from pg_tables
where schemaname = 'public';

-- -------------------------------------------------------------
-- 2) ساختار کامل ستون‌های هر جدول public
-- شامل: نام ستون، نوع، nullable، default، primary key، ordinal
-- -------------------------------------------------------------
with primary_keys as (
  select
    kcu.table_schema,
    kcu.table_name,
    kcu.column_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name
   and tc.table_schema = kcu.table_schema
   and tc.table_name = kcu.table_name
  where tc.constraint_type = 'PRIMARY KEY'
    and tc.table_schema = 'public'
)
select
  c.table_schema,
  c.table_name,
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.udt_name,
  c.character_maximum_length,
  c.numeric_precision,
  c.numeric_scale,
  c.is_nullable,
  c.column_default,
  case when pk.column_name is not null then true else false end as is_primary_key
from information_schema.columns c
left join primary_keys pk
  on pk.table_schema = c.table_schema
 and pk.table_name = c.table_name
 and pk.column_name = c.column_name
where c.table_schema = 'public'
order by c.table_name, c.ordinal_position;

-- -------------------------------------------------------------
-- 3) تمام Foreign Key ها و روابط بین جداول
-- -------------------------------------------------------------
select
  tc.constraint_name,
  tc.table_schema as source_schema,
  tc.table_name as source_table,
  kcu.column_name as source_column,
  ccu.table_schema as target_schema,
  ccu.table_name as target_table,
  ccu.column_name as target_column,
  rc.update_rule,
  rc.delete_rule
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
 and ccu.table_schema = tc.table_schema
left join information_schema.referential_constraints rc
  on rc.constraint_name = tc.constraint_name
 and rc.constraint_schema = tc.constraint_schema
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
order by tc.table_name, kcu.column_name;

-- -------------------------------------------------------------
-- 4) تمام Index های موجود در public
-- -------------------------------------------------------------
select
  schemaname as schema_name,
  tablename as table_name,
  indexname as index_name,
  indexdef as index_definition
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;

-- -------------------------------------------------------------
-- 5) تمام Function/RPC های موجود در public
-- شامل نام، آرگومان‌ها، نوع خروجی، زبان، volatility، security definer
-- -------------------------------------------------------------
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type,
  l.lanname as language,
  case p.provolatile
    when 'i' then 'immutable'
    when 's' then 'stable'
    when 'v' then 'volatile'
  end as volatility,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_language l on l.oid = p.prolang
where n.nspname = 'public'
order by p.proname, arguments;

-- -------------------------------------------------------------
-- 6) تمام Trigger های موجود در public
-- -------------------------------------------------------------
select
  event_object_schema as schema_name,
  event_object_table as table_name,
  trigger_name,
  event_manipulation,
  action_timing,
  action_orientation,
  action_statement
from information_schema.triggers
where event_object_schema = 'public'
order by event_object_table, trigger_name, event_manipulation;

-- -------------------------------------------------------------
-- 7) تمام View های موجود در public
-- -------------------------------------------------------------
select
  table_schema as schema_name,
  table_name as view_name,
  view_definition
from information_schema.views
where table_schema = 'public'
order by table_name;

-- -------------------------------------------------------------
-- 8-A) وضعیت RLS روی هر جدول public
-- relrowsecurity = RLS فعال است؟
-- relforcerowsecurity = RLS اجباری است؟
-- -------------------------------------------------------------
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relname;

-- -------------------------------------------------------------
-- 8-B) لیست Policy های RLS در public
-- -------------------------------------------------------------
select
  schemaname as schema_name,
  tablename as table_name,
  policyname as policy_name,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- -------------------------------------------------------------
-- 9) Extension های نصب‌شده
-- -------------------------------------------------------------
select
  e.extname as extension_name,
  e.extversion as version,
  n.nspname as schema_name
from pg_extension e
join pg_namespace n on n.oid = e.extnamespace
order by e.extname;

-- -------------------------------------------------------------
-- 10) enum/type های سفارشی public، برای تکمیل گزارش معماری
-- -------------------------------------------------------------
select
  n.nspname as schema_name,
  t.typname as type_name,
  e.enumlabel as enum_value,
  e.enumsortorder
from pg_type t
join pg_namespace n on n.oid = t.typnamespace
join pg_enum e on e.enumtypid = t.oid
where n.nspname = 'public'
order by t.typname, e.enumsortorder;

-- -------------------------------------------------------------
-- 11) اندازه و آمار تقریبی استفاده از جدول‌ها، برای شناسایی جداول سنگین
-- -------------------------------------------------------------
select
  schemaname as schema_name,
  relname as table_name,
  n_live_tup as estimated_live_rows,
  n_dead_tup as estimated_dead_rows,
  seq_scan,
  seq_tup_read,
  idx_scan,
  idx_tup_fetch,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
from pg_stat_user_tables
where schemaname = 'public'
order by n_live_tup desc;
