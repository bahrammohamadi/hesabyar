-- =============================================================
-- تست‌های مرحله ۵: Audit Triggers + Workflow + RLS
-- بخش‌های اصلی این فایل فقط SELECT هستند.
-- سناریوهای تغییر داده باید داخل transaction و با ROLLBACK اجرا شوند.
-- =============================================================

-- -------------------------------------------------------------
-- ۱) بررسی audit triggerها
-- -------------------------------------------------------------
select
  event_object_table as table_name,
  trigger_name,
  string_agg(event_manipulation, ',' order by event_manipulation) as events,
  action_timing,
  action_statement
from information_schema.triggers
where event_object_schema='public'
  and trigger_name like 'trg_audit_%'
group by event_object_table, trigger_name, action_timing, action_statement
order by event_object_table, trigger_name;

-- -------------------------------------------------------------
-- ۲) بررسی وجود Workflow RPC
-- -------------------------------------------------------------
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public'
  and p.proname='fn_transition_document';

-- -------------------------------------------------------------
-- ۳) بررسی RLS و policyها
-- -------------------------------------------------------------
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public'
  and c.relname in ('sales','sale_items','purchases','purchase_items','contacts','products','product_variants','transactions','stock_movements')
order by c.relname;

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname='public'
  and tablename in ('sales','sale_items','purchases','purchase_items','contacts','products','product_variants','transactions','stock_movements')
order by tablename, policyname;

-- -------------------------------------------------------------
-- ۴) بررسی stock movement refs برای workflow
-- -------------------------------------------------------------
select
  ref_table,
  reason,
  type,
  count(*)::bigint as rows_count,
  sum(qty)::numeric as qty_sum
from public.stock_movements
where ref_table is not null
group by ref_table, reason, type
order by ref_table, reason, type;

-- -------------------------------------------------------------
-- ۵) وضعیت audit_logs اخیر
-- -------------------------------------------------------------
select
  entity_type,
  action,
  source,
  count(*)::bigint as rows_count,
  max(created_at) as last_at
from public.audit_logs
group by entity_type, action, source
order by last_at desc nulls last;

-- -------------------------------------------------------------
-- سناریوی Audit Trigger با ROLLBACK - نمونه دستی:
-- این بلوک باید یکجا اجرا شود؛ در انتها ROLLBACK دارد و تغییر دائمی نمی‌گذارد.
-- -------------------------------------------------------------
/*
begin;
with target as (
  select id from public.contacts order by created_at limit 1
), before_count as (
  select count(*)::bigint as c from public.audit_logs where entity_type='contact'
), upd as (
  update public.contacts
     set name = name
   where id in (select id from target)
   returning id
), after_count as (
  select count(*)::bigint as c from public.audit_logs where entity_type='contact'
)
select
  (select c from before_count) as audit_before,
  (select c from after_count) as audit_after,
  ((select c from after_count) > (select c from before_count)) as audit_created;
rollback;
*/

-- -------------------------------------------------------------
-- سناریوی Workflow با ROLLBACK - نمونه دستی:
-- یک sale تستی draft می‌سازد، confirmed و reversed می‌کند، سپس rollback.
-- -------------------------------------------------------------
/*
begin;
-- این تست در گزارش اجرا توسط Agent به صورت خودکار اجرا می‌شود.
rollback;
*/
