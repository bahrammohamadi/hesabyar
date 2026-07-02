-- =============================================================
-- تست‌های فقط-خواندنی برای Migration 0012
-- این فایل هیچ داده‌ای تغییر نمی‌دهد.
-- =============================================================

-- -------------------------------------------------------------
-- ۱) بررسی نصب افزونه‌ها
-- -------------------------------------------------------------
select
  extname as extension_name,
  extversion as version
from pg_extension
where extname in ('pgcrypto', 'pg_trgm')
order by extname;

-- -------------------------------------------------------------
-- ۲) بررسی وجود جدول‌های audit_logs و entity_registry
-- -------------------------------------------------------------
select
  table_schema,
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('audit_logs', 'entity_registry')
order by table_name;

-- -------------------------------------------------------------
-- ۳) بررسی ستون‌های audit_logs
-- -------------------------------------------------------------
select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'audit_logs'
order by ordinal_position;

-- -------------------------------------------------------------
-- ۴) بررسی ایندکس‌های audit_logs
-- -------------------------------------------------------------
select
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'audit_logs'
order by indexname;

-- -------------------------------------------------------------
-- ۵) بررسی تابع عمومی audit
-- -------------------------------------------------------------
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'fn_audit_trigger';

-- -------------------------------------------------------------
-- ۶) بررسی داده‌های اولیه entity_registry
-- -------------------------------------------------------------
select
  entity_type,
  physical_table,
  panel_component,
  is_document
from public.entity_registry
order by entity_type;

-- -------------------------------------------------------------
-- ۷) بررسی وضعیت RLS
-- -------------------------------------------------------------
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('audit_logs', 'entity_registry')
order by c.relname;

-- -------------------------------------------------------------
-- ۸) بررسی policyهای مرتبط
-- -------------------------------------------------------------
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('audit_logs', 'entity_registry')
order by tablename, policyname;
