-- =============================================================
-- ROLLBACK مهاجرت 0039 — پنل فرماندهی سوپرادمین
--
-- ⚠️ اجرای این فایل جدول platform_error_logs و همه‌ی خطاهای
-- ثبت‌شده را حذف می‌کند. اگر می‌خواهید نگه دارید، پیش از اجرا:
--   create table platform_error_logs_backup as
--     select * from public.platform_error_logs;
--
-- هیچ داده‌ی کسب‌وکاری (فاکتور، کالا، مشتری) لمس نمی‌شود.
-- =============================================================

drop view if exists public.v_admin_invoice_items;
drop view if exists public.v_admin_invoices;

drop function if exists public.platform_health();
drop function if exists public.admin_cancel_sale(uuid, uuid, text, text);
drop function if exists public.prune_platform_errors(int);
drop function if exists public.log_platform_error(text, text, text, jsonb, text, text, int, uuid, uuid, text);

drop table if exists public.platform_error_logs;

-- -------------------------------------------------------------
-- بازگرداندن cancel_sale به نسخه‌ی خودبسنده‌ی مهاجرت ۰۰۰۷
--
-- ترتیب مهم است: اول cancel_sale بازنویسی می‌شود و بعد تابع
-- کمکی حذف. برعکسش یعنی بازه‌ای که cancel_sale به تابعی ارجاع
-- می‌دهد که دیگر وجود ندارد و ابطال فاکتور برای *کاربران عادی*
-- هم می‌شکند.
-- -------------------------------------------------------------
create or replace function public.cancel_sale(
  p_sale uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_sale record;
  v_item record;
  v_tx record;
begin
  if not public.has_permission('sales.create') then
    raise exception 'دسترسی ابطال فاکتور وجود ندارد';
  end if;

  select * into v_sale from public.sales where id = p_sale for update;
  if not found then
    raise exception 'فاکتور فروش یافت نشد';
  end if;

  if not (v_sale.org_id in (select public.user_org_ids())) then
    raise exception 'دسترسی غیرمجاز';
  end if;

  if v_sale.status = 'cancelled' then
    return;
  end if;

  for v_item in select * from public.sale_items where sale_id = p_sale loop
    insert into public.stock_movements(
      org_id, branch_id, variant_id, type, reason, qty, ref_table, ref_id, note, created_by
    ) values (
      v_item.org_id, v_item.branch_id, v_item.variant_id,
      'in', 'return', v_item.qty, 'sales_cancel', p_sale,
      coalesce(p_reason, 'ابطال فاکتور فروش'), v_uid
    );
  end loop;

  for v_tx in
    select * from public.transactions where sale_id = p_sale and type = 'receipt'
  loop
    insert into public.transactions(
      org_id, branch_id, type, amount, date, account_id, contact_id, sale_id,
      ref_table, ref_id, method, note, created_by
    ) values (
      v_tx.org_id, v_tx.branch_id, 'payment', v_tx.amount, now(),
      v_tx.account_id, v_tx.contact_id, p_sale, 'sales_cancel', p_sale, v_tx.method,
      coalesce(p_reason, 'برگشت دریافت بابت ابطال فاکتور')
        || coalesce(' - ' || v_sale.invoice_no, ''),
      v_uid
    );
  end loop;

  update public.sales
  set status = 'cancelled', cancelled_at = now(), cancelled_by = v_uid,
      cancel_reason = p_reason, updated_at = now()
  where id = p_sale;
end;
$$;

drop function if exists public.apply_sale_cancellation(uuid, uuid, text);

-- ماتریس مجوز به نسخه‌ی ۰۰۳۷ (بدون system.health و errors.view)
create or replace function public.platform_admin_can(
  p_permission text,
  p_user uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid    uuid := coalesce(p_user, auth.uid());
  v_role   text;
  v_custom text[];
begin
  select role, custom_permissions into v_role, v_custom
  from public.platform_admins where user_id = v_uid;

  if v_role is null then return false; end if;

  if v_role = 'custom' then
    return p_permission = any(coalesce(v_custom, '{}'));
  end if;

  return case p_permission
    when 'orgs.view'        then true
    when 'audit.view'       then true
    when 'orgs.approve'     then v_role in ('super_admin', 'support')
    when 'orgs.suspend'     then v_role in ('super_admin')
    when 'trial.extend'     then v_role in ('super_admin', 'support', 'finance')
    when 'plan.change'      then v_role in ('super_admin', 'finance')
    when 'invoice.view'     then v_role in ('super_admin', 'support')
    when 'invoice.modify'   then v_role in ('super_admin')
    when 'admins.manage'    then v_role = 'super_admin'
    when 'users.view'       then true
    when 'impersonate'      then v_role in ('super_admin', 'support')
    when 'announcements.manage' then v_role = 'super_admin'
    when 'users.password'   then v_role = 'super_admin'
    when 'tickets.view'     then true
    when 'tickets.reply'    then v_role in ('super_admin', 'support')
    when 'data.import'      then v_role = 'super_admin'
    else false
  end;
end;
$$;

grant execute on function public.platform_admin_can(text, uuid) to authenticated, service_role;

-- ⚠️ نقش‌های سفارشی که این دو مجوز را گرفته‌اند اول پاک می‌شوند،
-- وگرنه تریگر اعتبارسنجی platform_admins بعداً روی هر update
-- خطای «مجوز نامعتبر» می‌دهد.
update public.platform_admins
set custom_permissions = array_remove(
      array_remove(custom_permissions, 'system.health'), 'errors.view')
where custom_permissions && array['system.health', 'errors.view'];

delete from public.platform_permissions where key in ('system.health', 'errors.view');
