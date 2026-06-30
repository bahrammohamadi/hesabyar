-- =============================================================
-- Hesabyar ERP - Spend Customer Wallet Credit
-- نسخه: 0010
-- هدف: مصرف اعتبار کیف پول مشتری در فاکتور فروش به صورت اتمیک
-- =============================================================

create or replace function public.spend_customer_wallet(
  p_contact uuid,
  p_sale uuid,
  p_amount bigint,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_contact record;
  v_sale record;
  v_current_credit bigint;
  v_next_credit bigint;
begin
  if not public.has_permission('finance.create') then
    raise exception 'دسترسی مصرف اعتبار مشتری وجود ندارد';
  end if;

  if coalesce(p_amount, 0) <= 0 then
    raise exception 'مبلغ اعتبار نامعتبر است';
  end if;

  select * into v_contact
  from public.contacts
  where id = p_contact
  for update;

  if not found then
    raise exception 'مشتری یافت نشد';
  end if;

  select * into v_sale
  from public.sales
  where id = p_sale
  for update;

  if not found then
    raise exception 'فاکتور فروش یافت نشد';
  end if;

  if v_sale.customer_id is distinct from p_contact then
    raise exception 'اعتبار باید برای مشتری همان فاکتور مصرف شود';
  end if;

  if not (v_contact.org_id in (select public.user_org_ids())) then
    raise exception 'دسترسی غیرمجاز';
  end if;

  v_current_credit := coalesce((v_contact.meta->>'wallet_credit')::bigint, 0);

  if v_current_credit < p_amount then
    raise exception 'اعتبار کیف پول کافی نیست';
  end if;

  v_next_credit := v_current_credit - p_amount;

  update public.contacts
  set meta = jsonb_set(coalesce(meta, '{}'::jsonb), '{wallet_credit}', to_jsonb(v_next_credit), true),
      updated_at = now()
  where id = p_contact;

  insert into public.transactions(
    org_id, branch_id, type, amount, date, account_id, contact_id, sale_id,
    ref_table, ref_id, method, note, created_by
  ) values (
    v_sale.org_id,
    v_sale.branch_id,
    'receipt',
    p_amount,
    now(),
    null,
    p_contact,
    p_sale,
    'wallet',
    p_sale,
    'transfer',
    coalesce(p_note, 'پرداخت از اعتبار کیف پول'),
    v_uid
  );

  insert into public.activity_logs(org_id, user_id, action, entity_type, entity_id, old_data, new_data)
  values (
    v_sale.org_id,
    v_uid,
    'payment',
    'customer_wallet',
    p_contact,
    jsonb_build_object('wallet_credit', v_current_credit),
    jsonb_build_object('wallet_credit', v_next_credit, 'sale_id', p_sale, 'amount', p_amount)
  );
end;
$$;
