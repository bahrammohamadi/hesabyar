-- =============================================================
-- تست‌های فقط-خواندنی برای Migration 0015 - Payment & Balance
-- این فایل هیچ داده‌ای تغییر نمی‌دهد.
-- =============================================================

-- -------------------------------------------------------------
-- ۱) بررسی ستون‌های کلیدی transactions
-- -------------------------------------------------------------
select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'transactions'
  and column_name in ('type','amount','method','ref_table','ref_id','sale_id','purchase_id','contact_id','org_id','branch_id')
order by ordinal_position;

-- -------------------------------------------------------------
-- ۲) بررسی constraintهای type/method
-- -------------------------------------------------------------
select
  conname,
  contype,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.transactions'::regclass
  and contype = 'c'
order by conname;

-- -------------------------------------------------------------
-- ۳) بررسی وجود viewها
-- -------------------------------------------------------------
select
  table_schema,
  table_name
from information_schema.views
where table_schema = 'public'
  and table_name in ('v_document_balance','v_contact_balance')
order by table_name;

-- -------------------------------------------------------------
-- ۴) نمونه مانده اسناد
-- -------------------------------------------------------------
select
  doc_type,
  doc_id,
  total,
  paid_amount,
  remaining,
  payment_status
from public.v_document_balance
order by doc_type, remaining desc, total desc
limit 20;

-- -------------------------------------------------------------
-- ۵) خلاصه وضعیت پرداخت اسناد
-- -------------------------------------------------------------
select
  doc_type,
  payment_status,
  count(*)::bigint as docs_count,
  sum(total)::numeric as total_sum,
  sum(paid_amount)::numeric as paid_sum,
  sum(remaining)::numeric as remaining_sum
from public.v_document_balance
group by doc_type, payment_status
order by doc_type, payment_status;

-- -------------------------------------------------------------
-- ۶) نمونه مانده مشتریان
-- قرارداد: balance مثبت = بدهکار، منفی = بستانکار
-- -------------------------------------------------------------
select
  vcb.contact_id,
  c.name,
  vcb.total_sales,
  vcb.total_received,
  vcb.balance,
  vcb.last_activity_at
from public.v_contact_balance vcb
join public.contacts c on c.id = vcb.contact_id
where vcb.total_sales <> 0 or vcb.total_received <> 0 or vcb.balance <> 0
order by vcb.balance desc, vcb.last_activity_at desc nulls last
limit 20;

-- -------------------------------------------------------------
-- ۷) خلاصه مانده مشتریان
-- -------------------------------------------------------------
select
  count(*) filter (where balance > 0)::bigint as debtor_contacts,
  count(*) filter (where balance = 0)::bigint as settled_contacts,
  count(*) filter (where balance < 0)::bigint as creditor_contacts,
  coalesce(sum(balance) filter (where balance > 0),0)::numeric as total_debt,
  coalesce(sum(balance) filter (where balance < 0),0)::numeric as total_credit
from public.v_contact_balance;

-- -------------------------------------------------------------
-- ۸) بررسی وجود تابع RPC
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
  and p.proname = 'fn_register_payment';

-- -------------------------------------------------------------
-- ۹) توزیع تراکنش‌های فعلی
-- -------------------------------------------------------------
select
  type,
  method,
  ref_table,
  count(*)::bigint as rows_count,
  sum(amount)::numeric as amount_sum
from public.transactions
group by type, method, ref_table
order by rows_count desc, type, method, ref_table;

-- -------------------------------------------------------------
-- ۱۰) چک جلوگیری از double-count برای فروش‌ها
-- embedded_paid و tx_net جداگانه نمایش داده می‌شوند.
-- paid_amount نهایی در v_document_balance باید max این دو باشد.
-- -------------------------------------------------------------
with sale_tx as (
  select
    s.id as sale_id,
    coalesce(sum(case when t.type in ('receipt','income') then t.amount when t.type in ('payment','expense') then -1*t.amount else 0 end),0)::bigint as tx_net
  from public.sales s
  left join public.transactions t
    on t.sale_id = s.id or (t.ref_table in ('sales','sale') and t.ref_id = s.id)
  group by s.id
)
select
  s.id as sale_id,
  (coalesce(s.paid_cash,0)+coalesce(s.paid_card,0))::bigint as embedded_paid,
  st.tx_net,
  vdb.paid_amount,
  vdb.remaining,
  vdb.payment_status
from public.sales s
left join sale_tx st on st.sale_id = s.id
join public.v_document_balance vdb on vdb.doc_type='sale' and vdb.doc_id=s.id
order by s.date desc
limit 20;
