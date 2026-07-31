-- 0023_security_hardening.sql
-- سه رخنه‌ی تأییدشده در ممیزی امنیتی را می‌بندد:
--   ۱. نشت داده: جدول‌های بدون RLS که با کلید anon از اینترنت خوانده می‌شدند.
--   ۲. رقابت همزمانی (race) در تولید شماره فاکتور + نبود قید یکتایی.
--   ۳. جدول audit_logs که RLS داشت ولی هیچ سیاستی نداشت (رفتار مبهم).
--
-- همه‌ی تغییرات idempotent هستند و داده‌ای را حذف نمی‌کنند.

begin;

-- ─────────────────────────────────────────────────────────────
-- ۱) نشت داده — stock_reset_snapshots
--    تأیید شده: بدون احراز هویت ۳۲۶ ردیف (نام کالا، موجودی، org_id) برمی‌گرداند.
-- ─────────────────────────────────────────────────────────────
alter table if exists public.stock_reset_snapshots enable row level security;

drop policy if exists stock_reset_snapshots_org_isolation on public.stock_reset_snapshots;
create policy stock_reset_snapshots_org_isolation
  on public.stock_reset_snapshots
  for select
  to authenticated
  using (
    org_id in (
      select m.org_id from public.memberships m
      where m.user_id = auth.uid() and m.is_active
    )
  );

-- نوشتن فقط از سمت سرور (service_role) یا توابع SECURITY DEFINER.
drop policy if exists stock_reset_snapshots_no_client_write on public.stock_reset_snapshots;
create policy stock_reset_snapshots_no_client_write
  on public.stock_reset_snapshots
  for all
  to authenticated
  using (false)
  with check (false);

-- ─────────────────────────────────────────────────────────────
-- ۲) جدول یتیم avahang_genres — به پروژه ربطی ندارد و بدون RLS باز بود.
--    حذفش نمی‌کنیم (ممکن است عمدی باشد)، فقط دسترسی عمومی را می‌بندیم.
-- ─────────────────────────────────────────────────────────────
alter table if exists public.avahang_genres enable row level security;

drop policy if exists avahang_genres_deny_all on public.avahang_genres;
create policy avahang_genres_deny_all
  on public.avahang_genres
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- ─────────────────────────────────────────────────────────────
-- ۳) audit_logs — RLS روشن بود ولی صفر سیاست داشت.
--    Postgres در این حالت همه‌چیز را رد می‌کند، اما نیت کد مبهم بود.
--    خواندن را صریحاً به اعضای همان سازمان محدود می‌کنیم؛ نوشتن فقط سروری.
-- ─────────────────────────────────────────────────────────────
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'audit_logs' and column_name = 'org_id'
  ) then
    execute $p$
      drop policy if exists audit_logs_org_read on public.audit_logs;
      create policy audit_logs_org_read
        on public.audit_logs
        for select
        to authenticated
        using (
          org_id in (
            select m.org_id from public.memberships m
            where m.user_id = auth.uid() and m.is_active
          )
        );
    $p$;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
-- ۴) شماره فاکتور — رفع رقابت همزمانی
--
--    پیاده‌سازی قبلی:  count(*) + 1
--    دو مشکل جدی داشت:
--      الف) دو فروش همزمان هر دو یک count می‌خواندند → شماره‌ی یکسان.
--      ب)  با حذف یک فاکتور، count کم می‌شد → شماره‌ی تکراری تولید می‌شد.
--
--    راه‌حل: جدول شمارنده‌ی مستقل با قفل سطری اتمیک.
--    UPDATE ... RETURNING روی یک ردیف، قفل انحصاری می‌گیرد؛ تراکنش دوم
--    تا پایان تراکنش اول منتظر می‌ماند و عدد بعدی را می‌گیرد.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.document_counters (
  org_id     uuid   not null references public.organizations(id) on delete cascade,
  doc_type   text   not null,
  last_value bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (org_id, doc_type)
);

alter table public.document_counters enable row level security;

drop policy if exists document_counters_no_direct_access on public.document_counters;
create policy document_counters_no_direct_access
  on public.document_counters
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- مقداردهی اولیه از روی بیشترین شماره‌ی موجود، نه از روی count.
-- به این ترتیب شماره‌های صادرشده‌ی فعلی هرگز تکرار نمی‌شوند.
insert into public.document_counters (org_id, doc_type, last_value)
select o.id,
       'sales',
       coalesce((
         select max((regexp_replace(s.invoice_no, '\D', '', 'g'))::bigint)
         from public.sales s
         where s.org_id = o.id
           and s.invoice_no ~ '\d'
       ), 0)
from public.organizations o
on conflict (org_id, doc_type) do update
  set last_value = greatest(public.document_counters.last_value, excluded.last_value);

insert into public.document_counters (org_id, doc_type, last_value)
select o.id,
       'purchases',
       coalesce((
         select max((regexp_replace(p.invoice_no, '\D', '', 'g'))::bigint)
         from public.purchases p
         where p.org_id = o.id
           and p.invoice_no ~ '\d'
       ), 0)
from public.organizations o
on conflict (org_id, doc_type) do update
  set last_value = greatest(public.document_counters.last_value, excluded.last_value);

create or replace function public.next_invoice_no(p_org uuid, p_prefix text, p_table text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_next bigint;
  v_type text;
begin
  -- ورودی را به فهرست سفید محدود می‌کنیم تا نام دلخواه وارد شمارنده نشود.
  v_type := case when p_table = 'purchases' then 'purchases' else 'sales' end;

  -- تخصیص اتمیک: قفل سطری تا پایان تراکنش نگه داشته می‌شود.
  insert into public.document_counters (org_id, doc_type, last_value)
  values (p_org, v_type, 1)
  on conflict (org_id, doc_type) do update
    set last_value = public.document_counters.last_value + 1,
        updated_at = now()
  returning last_value into v_next;

  return p_prefix || '-' || lpad(v_next::text, 5, '0');
end;
$function$;

-- ─────────────────────────────────────────────────────────────
-- ۵) قید یکتایی روی شماره فاکتور — خط دفاعی آخر.
--    حتی اگر منطق اپ اشتباه کند، دیتابیس فاکتور تکراری را رد می‌کند.
--    به‌صورت مشروط ساخته می‌شود تا اگر داده‌ی تکراری موجود باشد،
--    مایگریشن شکست نخورد و نیاز به پاک‌سازی دستی گزارش شود.
-- ─────────────────────────────────────────────────────────────
do $$
declare v_dupes bigint;
begin
  select count(*) into v_dupes from (
    select org_id, invoice_no from public.sales
    where invoice_no is not null
    group by org_id, invoice_no having count(*) > 1
  ) d;

  if v_dupes = 0 then
    create unique index if not exists uq_sales_org_invoice_no
      on public.sales (org_id, invoice_no)
      where invoice_no is not null;
  else
    raise warning 'ساخت قید یکتایی sales رد شد: % شماره تکراری وجود دارد', v_dupes;
  end if;

  select count(*) into v_dupes from (
    select org_id, invoice_no from public.purchases
    where invoice_no is not null
    group by org_id, invoice_no having count(*) > 1
  ) d;

  if v_dupes = 0 then
    create unique index if not exists uq_purchases_org_invoice_no
      on public.purchases (org_id, invoice_no)
      where invoice_no is not null;
  else
    raise warning 'ساخت قید یکتایی purchases رد شد: % شماره تکراری وجود دارد', v_dupes;
  end if;
end $$;

commit;
