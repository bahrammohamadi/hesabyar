-- =============================================================
-- Hesabyar Migration 0015 - لایه پرداخت و مانده روی Cashbook موجود
-- نوع: UP migration
-- ایمنی: idempotent، بدون حذف داده، بدون تغییر مخرب، بدون trigger عملیاتی
-- نکته: transactions از قبل amount/method/ref_table/ref_id/sale_id/purchase_id دارد.
--       ستون direction ساخته نمی‌شود؛ direction از روی transactions.type نرمال می‌شود.
-- =============================================================

-- -------------------------------------------------------------
-- بخش ۱) استانداردسازی غیرمخرب transactions
-- method از قبل وجود دارد؛ فقط constraint آن سازگارتر می‌شود.
-- مقادیر legacy مثل cheque و wallet هم حفظ می‌شوند.
-- -------------------------------------------------------------
do $$
declare
  v_attnum int;
  r record;
begin
  select attnum into v_attnum
  from pg_attribute
  where attrelid = 'public.transactions'::regclass
    and attname = 'method'
    and not attisdropped;

  if v_attnum is not null then
    for r in
      select conname
      from pg_constraint
      where conrelid = 'public.transactions'::regclass
        and contype = 'c'
        and v_attnum = any(conkey)
        and conname <> 'transactions_method_standard_check'
    loop
      execute format('alter table public.transactions drop constraint if exists %I', r.conname);
    end loop;

    if not exists (
      select 1 from pg_constraint
      where conname = 'transactions_method_standard_check'
        and conrelid = 'public.transactions'::regclass
    ) then
      alter table public.transactions
        add constraint transactions_method_standard_check
        check (method in ('cash','card','credit','transfer','other','cheque','wallet'));
    end if;
  end if;
end $$;

-- -------------------------------------------------------------
-- ایندکس‌های کمکی برای اتصال پرداخت‌ها به اسناد
-- -------------------------------------------------------------
create index if not exists idx_transactions_ref
  on public.transactions (ref_table, ref_id);

create index if not exists idx_transactions_type_method
  on public.transactions (type, method);

-- -------------------------------------------------------------
-- بخش ۲) View مانده سند: v_document_balance
-- paid_amount شفاف‌سازی:
--   فروش: GREATEST(sales.paid_cash + sales.paid_card, net receipt transactions)
--   خرید: GREATEST(purchases.paid, net payment transactions)
-- دلیل GREATEST: جلوگیری از double-count چون برخی RPCهای قدیمی هم ستون پرداخت سند را پر می‌کنند هم transaction می‌سازند.
-- paid_credit در فروش پرداخت واقعی نیست و در paid_amount لحاظ نمی‌شود.
-- -------------------------------------------------------------
drop view if exists public.v_contact_balance;
drop view if exists public.v_document_balance;

create or replace view public.v_document_balance
with (security_invoker = true)
as
with sale_tx as (
  select
    s.id as doc_id,
    coalesce(sum(
      case
        when t.type in ('receipt','income') then t.amount
        when t.type in ('payment','expense') then -1 * t.amount
        else 0
      end
    ), 0)::bigint as tx_paid
  from public.sales s
  left join public.transactions t
    on (
      t.sale_id = s.id
      or (t.ref_table in ('sales','sale') and t.ref_id = s.id)
      or (t.ref_table in ('sales_cancel','sale_cancel') and t.ref_id = s.id)
    )
  group by s.id
), purchase_tx as (
  select
    p.id as doc_id,
    coalesce(sum(
      case
        when t.type in ('payment','expense') then t.amount
        when t.type in ('receipt','income') then -1 * t.amount
        else 0
      end
    ), 0)::bigint as tx_paid
  from public.purchases p
  left join public.transactions t
    on (
      t.purchase_id = p.id
      or (t.ref_table in ('purchases','purchase') and t.ref_id = p.id)
      or (t.ref_table in ('purchase_cancel','purchases_cancel') and t.ref_id = p.id)
    )
  group by p.id
)
select
  'sale'::text as doc_type,
  s.id::uuid as doc_id,
  coalesce(s.total, 0)::bigint as total,
  greatest(
    (coalesce(s.paid_cash,0) + coalesce(s.paid_card,0))::bigint,
    greatest(coalesce(st.tx_paid,0),0)::bigint
  )::bigint as paid_amount,
  greatest(
    coalesce(s.total,0)::bigint - greatest(
      (coalesce(s.paid_cash,0) + coalesce(s.paid_card,0))::bigint,
      greatest(coalesce(st.tx_paid,0),0)::bigint
    ),
    0
  )::bigint as remaining,
  case
    when greatest((coalesce(s.paid_cash,0) + coalesce(s.paid_card,0))::bigint, greatest(coalesce(st.tx_paid,0),0)::bigint) <= 0 then 'unpaid'
    when greatest((coalesce(s.paid_cash,0) + coalesce(s.paid_card,0))::bigint, greatest(coalesce(st.tx_paid,0),0)::bigint) >= coalesce(s.total,0)::bigint then 'paid'
    else 'partial'
  end::text as payment_status
from public.sales s
left join sale_tx st on st.doc_id = s.id

union all

select
  'purchase'::text as doc_type,
  p.id::uuid as doc_id,
  coalesce(p.total, 0)::bigint as total,
  greatest(
    coalesce(p.paid,0)::bigint,
    greatest(coalesce(pt.tx_paid,0),0)::bigint
  )::bigint as paid_amount,
  greatest(
    coalesce(p.total,0)::bigint - greatest(coalesce(p.paid,0)::bigint, greatest(coalesce(pt.tx_paid,0),0)::bigint),
    0
  )::bigint as remaining,
  case
    when greatest(coalesce(p.paid,0)::bigint, greatest(coalesce(pt.tx_paid,0),0)::bigint) <= 0 then 'unpaid'
    when greatest(coalesce(p.paid,0)::bigint, greatest(coalesce(pt.tx_paid,0),0)::bigint) >= coalesce(p.total,0)::bigint then 'paid'
    else 'partial'
  end::text as payment_status
from public.purchases p
left join purchase_tx pt on pt.doc_id = p.id;

comment on view public.v_document_balance is
'مانده سند روی sales/purchases. paid_amount با GREATEST پرداخت embedded و transaction محاسبه می‌شود تا double-count رخ ندهد.';

-- -------------------------------------------------------------
-- بخش ۳) View مانده مشتری: v_contact_balance
-- قرارداد علامت:
--   balance مثبت = مشتری بدهکار است
--   balance صفر = تسویه
--   balance منفی = مشتری بستانکار/اضافه‌پرداخت دارد
-- تمرکز این view روی فروش/مشتری است؛ مانده تامین‌کننده در فاز جداگانه قابل توسعه است.
-- -------------------------------------------------------------
create or replace view public.v_contact_balance
with (security_invoker = true)
as
with sales_by_contact as (
  select
    s.customer_id as contact_id,
    coalesce(sum(s.total),0)::bigint as total_sales,
    max(s.date) as last_sale_at
  from public.sales s
  where s.customer_id is not null
    and coalesce(s.status,'confirmed') not in ('cancelled','returned','reversed')
  group by s.customer_id
), received_by_contact as (
  select
    s.customer_id as contact_id,
    coalesce(sum(vdb.paid_amount),0)::bigint as total_received,
    max(greatest(s.date, coalesce(tx.last_tx_at, s.date))) as last_payment_at
  from public.sales s
  join public.v_document_balance vdb on vdb.doc_type = 'sale' and vdb.doc_id = s.id
  left join lateral (
    select max(t.date) as last_tx_at
    from public.transactions t
    where t.sale_id = s.id
       or (t.ref_table in ('sales','sale') and t.ref_id = s.id)
  ) tx on true
  where s.customer_id is not null
    and coalesce(s.status,'confirmed') not in ('cancelled','returned','reversed')
  group by s.customer_id
)
select
  c.id::uuid as contact_id,
  coalesce(sbc.total_sales,0)::bigint as total_sales,
  coalesce(rbc.total_received,0)::bigint as total_received,
  (coalesce(sbc.total_sales,0)::bigint - coalesce(rbc.total_received,0)::bigint) as balance,
  greatest(
    coalesce(sbc.last_sale_at, '-infinity'::timestamptz),
    coalesce(rbc.last_payment_at, '-infinity'::timestamptz),
    coalesce(c.updated_at, c.created_at)
  )::timestamptz as last_activity_at
from public.contacts c
left join sales_by_contact sbc on sbc.contact_id = c.id
left join received_by_contact rbc on rbc.contact_id = c.id;

comment on view public.v_contact_balance is
'مانده مشتری بر اساس فروش و دریافتی. balance مثبت یعنی مشتری بدهکار است؛ منفی یعنی بستانکار.';

-- -------------------------------------------------------------
-- بخش ۴) RPC ثبت پرداخت
-- sale  → transaction.type='receipt' و جهت مفهومی in
-- purchase → transaction.type='payment' و جهت مفهومی out
-- در صورت تسویه کامل، status سند به settled تغییر می‌کند.
-- -------------------------------------------------------------
create or replace function public.fn_register_payment(
  p_doc_type text,
  p_doc_id uuid,
  p_amount numeric,
  p_method text default 'cash'
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid;
  v_doc_type text;
  v_method text;
  v_amount_bigint bigint;
  v_tx_id uuid;
  v_remaining bigint;
  v_after jsonb;
  v_sale record;
  v_purchase record;
begin
  v_doc_type := lower(trim(coalesce(p_doc_type,'')));
  v_method := lower(trim(coalesce(p_method,'cash')));

  if v_doc_type not in ('sale','purchase') then
    raise exception 'نوع سند نامعتبر است: %', p_doc_type;
  end if;

  if p_doc_id is null then
    raise exception 'شناسه سند الزامی است';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'مبلغ پرداخت باید بزرگتر از صفر باشد';
  end if;

  if p_amount <> trunc(p_amount) then
    raise exception 'در schema فعلی transactions.amount از نوع bigint است؛ مبلغ اعشاری مجاز نیست: %', p_amount;
  end if;

  if v_method not in ('cash','card','credit','transfer','other','cheque','wallet') then
    raise exception 'روش پرداخت نامعتبر است: %', p_method;
  end if;

  v_amount_bigint := p_amount::bigint;

  begin
    v_uid := auth.uid();
  exception when others then
    v_uid := null;
  end;

  if v_doc_type = 'sale' then
    select * into v_sale
    from public.sales
    where id = p_doc_id;

    if v_sale.id is null then
      raise exception 'فاکتور فروش یافت نشد: %', p_doc_id;
    end if;

    insert into public.transactions (
      org_id,
      branch_id,
      type,
      amount,
      date,
      account_id,
      contact_id,
      sale_id,
      ref_table,
      ref_id,
      method,
      note,
      created_by
    ) values (
      v_sale.org_id,
      v_sale.branch_id,
      'receipt',
      v_amount_bigint,
      now(),
      v_sale.account_id,
      v_sale.customer_id,
      v_sale.id,
      'sales',
      v_sale.id,
      v_method,
      'دریافت وجه از طریق fn_register_payment',
      v_uid
    ) returning id into v_tx_id;

  else
    select * into v_purchase
    from public.purchases
    where id = p_doc_id;

    if v_purchase.id is null then
      raise exception 'فاکتور خرید یافت نشد: %', p_doc_id;
    end if;

    insert into public.transactions (
      org_id,
      branch_id,
      type,
      amount,
      date,
      account_id,
      contact_id,
      purchase_id,
      ref_table,
      ref_id,
      method,
      note,
      created_by
    ) values (
      v_purchase.org_id,
      v_purchase.branch_id,
      'payment',
      v_amount_bigint,
      now(),
      null,
      v_purchase.supplier_id,
      v_purchase.id,
      'purchases',
      v_purchase.id,
      v_method,
      'ثبت پرداخت خرید از طریق fn_register_payment',
      v_uid
    ) returning id into v_tx_id;
  end if;

  -- محاسبه مانده پس از insert از read-model استاندارد
  select remaining into v_remaining
  from public.v_document_balance
  where doc_type = v_doc_type
    and doc_id = p_doc_id;

  if coalesce(v_remaining, 0) <= 0 then
    if v_doc_type = 'sale' then
      update public.sales
        set status = 'settled', updated_at = now()
      where id = p_doc_id;
    else
      update public.purchases
        set status = 'settled', updated_at = now()
      where id = p_doc_id;
    end if;
  end if;

  select to_jsonb(t) into v_after
  from public.transactions t
  where t.id = v_tx_id;

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
    v_uid,
    'transaction',
    v_tx_id::text,
    'create',
    null,
    v_after,
    'rpc',
    now()
  );

  return v_tx_id;
end;
$$;

comment on function public.fn_register_payment(text, uuid, numeric, text) is
'ثبت پرداخت روی مدل cashbook موجود. sale=receipt، purchase=payment، همراه با audit و settled کردن سند در صورت تسویه کامل.';

grant execute on function public.fn_register_payment(text, uuid, numeric, text)
  to authenticated, service_role;

-- =============================================================
-- پایان UP migration 0015
-- =============================================================
