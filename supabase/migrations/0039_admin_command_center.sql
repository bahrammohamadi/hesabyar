-- =============================================================
-- Tarazoo Migration 0039 — پنل فرماندهی سوپرادمین
--
-- سه شکاف را می‌بندد که کاربر صریحاً خواسته بود:
--   ۱. «دسترسی به فاکتورهای هر کسب‌وکار + تأیید/حذف/اصلاح فاکتور»
--   ۲. «وضعیت فنی سرویس»
--   ۳. «خطاهای زنده»
--
-- نوع: افزایشی. هیچ ستون، policy یا داده‌ی موجودی حذف نمی‌شود.
-- تنها تابعِ *موجودی* که بازنویسی می‌شود cancel_sale است و رفتار و
-- امضای عمومی‌اش دقیقاً ثابت می‌ماند (دلیلش در بخش ۳ توضیح داده شده).
--
-- EMERGENCY ROLLBACK: supabase/rollbacks/0039_admin_command_center.down.sql
-- =============================================================


-- -------------------------------------------------------------
-- بخش ۰) مجوزهای تازه
--
-- چرا مجوز جدا و نه استفاده از audit.view؟
--   audit.view در ماتریس برای *همه‌ی* نقش‌ها true است چون «چه کسی چه
--   کاری کرد» اطلاعات نظارتی بی‌خطری است. ولی صفحه‌ی وضعیت فنی و
--   فهرست خطاها چیز دیگری است: پیام خطای خام می‌تواند نام جدول،
--   ساختار کوئری و گاهی مقدار داده‌ی مشتری را نشان بدهد. این همان
--   چیزی است که safeError عمداً از کلاینت پنهان می‌کند؛ بی‌معنا بود
--   که از یک در پنهانش کنیم و از در دیگر به هر ادمینی نشان بدهیم.
--
-- invoice.view و invoice.modify از قبل در کاتالوگ و ماتریس بودند
-- (مهاجرت ۰۰۲۸) ولی هیچ روت و صفحه‌ای از آن‌ها استفاده نمی‌کرد —
-- مجوزهای مرده. این مهاجرت بالاخره به آن‌ها معنا می‌دهد.
-- -------------------------------------------------------------

insert into public.platform_permissions (key, label, description, category, risk, sort_order) values
  ('system.health', 'وضعیت فنی سرویس', 'مشاهده‌ی سلامت دیتابیس، نسخه، مصرف و شاخص‌های زیرساخت', 'نظارت', 'medium', 160),
  ('errors.view',   'خطاهای زنده',     'مشاهده‌ی خطاهای ثبت‌شده‌ی سرور همراه با جزئیات فنی',      'نظارت', 'high',   170)
on conflict (key) do update
  set label       = excluded.label,
      description = excluded.description,
      category    = excluded.category,
      risk        = excluded.risk,
      sort_order  = excluded.sort_order;


/*
  ماتریس مجوز — بازنویسی کامل.

  🔴 هشدار تکرارشونده: این تابع تا امروز در مهاجرت‌های ۰۰۲۸، ۰۰۳۱،
  ۰۰۳۳، ۰۰۳۶ و ۰۰۳۷ بازنویسی شده و *دو بار* در بازنویسی سطرهایی جا
  افتاده‌اند (users.view/impersonate/announcements.manage در ۰۰۳۱ و
  tickets.reply در ۰۰۳۳). سطرهای زیر عیناً از ۰۰۳۷ کپی شده‌اند و فقط
  دو سطر آخر تازه است. tests/custom-roles.test.ts خودکار آخرین
  بازنویسی را پیدا می‌کند و همه‌ی مجوزهای مصرف‌شده در روت‌ها را
  بررسی می‌کند، پس جاافتادن دوباره باید تست را بشکند.
*/
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
  from public.platform_admins
  where user_id = v_uid;

  -- 🔴 گارد NULL — از مهاجرت ۰۰۲۸.
  -- `v_role not in (...)` وقتی v_role تهی است NULL می‌دهد نه TRUE.
  if v_role is null then
    return false;
  end if;

  -- نقش سفارشی: فقط آرایه ملاک است (مهاجرت ۰۰۳۳).
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
    /* ── تازه در ۰۰۳۹ ── */
    -- شاخص‌های زیرساخت: مالی هم لازمش دارد (سنجش مصرف و ظرفیت).
    when 'system.health'    then v_role in ('super_admin', 'support', 'finance')
    -- متن خام خطا ممکن است داده‌ی مشتری داشته باشد؛ محدودتر.
    when 'errors.view'      then v_role in ('super_admin', 'support')
    else false
  end;
end;
$$;

comment on function public.platform_admin_can(text, uuid) is
  'ماتریس مجوز ادمین پلتفرم. نقش custom از custom_permissions می‌خواند، بقیه از ماتریس ثابت.';

grant execute on function public.platform_admin_can(text, uuid) to authenticated, service_role;


-- -------------------------------------------------------------
-- بخش ۱) ثبت خطاهای سرور
--
-- 🔴 مسئله‌ای که حل می‌کند:
--   safeError() تا امروز فقط console.error می‌زد. روی Vercel این لاگ
--   در پلن فعلی فقط چند ساعت نگه داشته می‌شود و از داخل خود محصول
--   اصلاً دیده نمی‌شود. یعنی وقتی کاربر می‌گفت «خطا داد»، تنها
--   سرنخ ما کد ۸ رقمی `ref` بود که هیچ‌جا قابل جستجو نبود.
--
--   حالا همان ref در دیتابیس ذخیره می‌شود و در /admin/system قابل
--   جستجوست: کاربر کد را می‌گوید، ادمین متن کامل خطا را می‌بیند.
-- -------------------------------------------------------------

create table if not exists public.platform_error_logs (
  id         uuid primary key default gen_random_uuid(),
  -- همان کد کوتاهی که به کاربر نشان داده می‌شود. کلید ارتباط
  -- «شکایت کاربر» با «خطای سرور» است، پس ایندکس دارد.
  ref        text not null,
  context    text not null,
  message    text,
  detail     jsonb not null default '{}'::jsonb,
  path       text,
  method     text,
  status     int,
  actor_id   uuid references auth.users(id) on delete set null,
  org_id     uuid references public.organizations(id) on delete set null,
  ip         text,
  created_at timestamptz not null default now()
);

comment on table public.platform_error_logs is
  'خطاهای سمت سرور. با ref به پیامی که کاربر دیده وصل می‌شود.';

create index if not exists idx_pel_created on public.platform_error_logs(created_at desc);
create index if not exists idx_pel_ref     on public.platform_error_logs(ref);
create index if not exists idx_pel_context on public.platform_error_logs(context);

alter table public.platform_error_logs enable row level security;

/*
  هیچ policy‌ای برای نوشتن تعریف نمی‌شود.

  نوشتن فقط از طریق تابع security definer پایین انجام می‌شود که از
  سرور با service_role صدا زده می‌شود. اگر policy insert می‌گذاشتیم،
  هر کاربر واردشده‌ای می‌توانست جدول را با میلیون‌ها ردیف جعلی پر کند
  و هم فضا را ببلعد و هم خطاهای واقعی را زیر انبوه نویز پنهان کند.
*/
drop policy if exists p_pel_admin_read on public.platform_error_logs;
create policy p_pel_admin_read on public.platform_error_logs
  for select to authenticated
  using (public.platform_admin_can('errors.view'));


/**
 * ثبت یک خطای سرور.
 *
 * تحمل‌پذیر در برابر خرابی: اگر ثبت خطا خودش خطا بدهد (مثلاً جدول
 * هنوز مهاجرت نشده) نباید درخواستِ کاربر را بترکاند. مسئولیت
 * catch با فراخوان است؛ اینجا فقط طول ورودی‌ها محدود می‌شود.
 *
 * چرا برش طول؟ یک stack trace طولانی یا payload بزرگ می‌تواند
 * ده‌ها کیلوبایت باشد. در پلن رایگان ۵۰۰ مگابایتی، چند هزار خطای
 * پرحجم کل فضا را می‌خورد.
 */
create or replace function public.log_platform_error(
  p_ref     text,
  p_context text,
  p_message text default null,
  p_detail  jsonb default '{}'::jsonb,
  p_path    text default null,
  p_method  text default null,
  p_status  int  default null,
  p_actor   uuid default null,
  p_org     uuid default null,
  p_ip      text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.platform_error_logs
    (ref, context, message, detail, path, method, status, actor_id, org_id, ip)
  values
    (left(coalesce(p_ref, '-'), 40),
     left(coalesce(p_context, '-'), 120),
     left(coalesce(p_message, ''), 4000),
     coalesce(p_detail, '{}'::jsonb),
     left(coalesce(p_path, ''), 400),
     left(coalesce(p_method, ''), 10),
     p_status,
     p_actor,
     p_org,
     left(coalesce(p_ip, ''), 60))
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.log_platform_error(text, text, text, jsonb, text, text, int, uuid, uuid, text)
  to service_role;


/**
 * پاک‌سازی خطاهای قدیمی.
 *
 * ⚠️ صادقانه: هیچ زمان‌بندی خودکاری (pg_cron) روی پلن رایگان نداریم.
 * این تابع از دکمه‌ی «پاک‌سازی» در /admin/system دستی صدا زده می‌شود.
 * تا وقتی cron نداریم، تظاهر به خودکار بودن بدتر از نبودنش است.
 */
create or replace function public.prune_platform_errors(p_days int default 30)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days int := greatest(coalesce(p_days, 30), 1);
  v_n    int;
begin
  delete from public.platform_error_logs
  where created_at < now() - make_interval(days => v_days);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

grant execute on function public.prune_platform_errors(int) to service_role;


-- -------------------------------------------------------------
-- بخش ۲) نمای فاکتورهای همه‌ی کسب‌وکارها
--
-- 🔴 چرا security_invoker نیست؟
--   سیاست RLS جدول sales کاربر را به سازمان‌های خودش محدود می‌کند
--   (user_org_ids). سوپرادمین عضو سازمان مشتری نیست، پس با invoker
--   همیشه صفر ردیف می‌گرفت. با definer نما RLS را دور می‌زند و
--   کنترل دسترسی صریحاً در لایه‌ی API انجام می‌شود:
--     • select از anon و authenticated گرفته می‌شود
--     • فقط service_role می‌خواند
--     • روت پیش از خواندن requirePlatformPermission('invoice.view')
--   همان الگوی v_admin_users در مهاجرت ۰۰۲۸.
-- -------------------------------------------------------------

drop view if exists public.v_admin_invoices;
create view public.v_admin_invoices as
select
  s.id,
  s.org_id,
  o.name                as org_name,
  o.approval_status     as org_status,
  s.invoice_no,
  s.date,
  s.created_at,
  s.status,
  s.total,
  s.discount,
  s.tax,
  (coalesce(s.paid_cash, 0) + coalesce(s.paid_card, 0)) as paid_amount,
  s.paid_credit,
  s.customer_id,
  c.name                as customer_name,
  c.phone               as customer_phone,
  s.cancelled_at,
  s.cancel_reason,
  s.note,
  s.created_by,
  (select count(*) from public.sale_items si where si.sale_id = s.id) as item_count,
  -- ستون یکپارچه‌ی جستجو: شماره فاکتور، نام کسب‌وکار، نام و تلفن مشتری
  lower(concat_ws(' ', s.invoice_no, o.name, c.name, c.phone)) as search_blob
from public.sales s
left join public.organizations o on o.id = s.org_id
left join public.contacts c      on c.id = s.customer_id;

comment on view public.v_admin_invoices is
  'فاکتورهای فروش همه‌ی کسب‌وکارها برای پنل سوپرادمین. definer است چون ادمین عضو سازمان مشتری نیست.';

revoke all on public.v_admin_invoices from anon, authenticated;
grant select on public.v_admin_invoices to service_role;


-- -------------------------------------------------------------
-- بخش ۳) ابطال فاکتور توسط سوپرادمین
--
-- مسئله: cancel_sale موجود دو گارد دارد که برای ادمین پلتفرم غلط‌اند:
--   ۱. has_permission('sales.create') → بر پایه‌ی memberships
--   ۲. org_id in (user_org_ids())     → ادمین عضو آن سازمان نیست
-- یعنی سوپرادمین *نمی‌تواند* فاکتور مشتری را باطل کند.
--
-- راه‌حل انتخاب‌شده: استخراج مکانیک ابطال در یک تابع داخلی و
-- فراخوانی آن از دو مسیر با دو مجوز متفاوت.
--
-- چرا کپی‌نکردن منطق؟ منطق برگشت موجودی و خنثی‌سازی دریافت‌ها حساس
-- است. دو نسخه یعنی روزی یکی اصلاح می‌شود و دیگری نه، و آن‌وقت
-- موجودی انبار بسته به اینکه *چه کسی* فاکتور را باطل کرده فرق می‌کند.
-- -------------------------------------------------------------

/**
 * مکانیک ابطال فاکتور — بدون هیچ بررسی دسترسی.
 *
 * ⚠️ هرگز مستقیم به کلاینت grant نشود. تنها فراخوان‌های مجاز
 * cancel_sale و admin_cancel_sale هستند که هرکدام گارد خودشان را
 * پیش از فراخوانی اجرا می‌کنند.
 *
 * برمی‌گرداند: true اگر واقعاً باطل شد، false اگر از قبل باطل بود.
 */
create or replace function public.apply_sale_cancellation(
  p_sale   uuid,
  p_actor  uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale record;
  v_item record;
  v_tx   record;
begin
  select * into v_sale from public.sales where id = p_sale for update;
  if not found then
    raise exception 'فاکتور فروش یافت نشد';
  end if;

  -- بی‌اثر بودن در تکرار: دو کلیک پشت‌سرهم نباید موجودی را دو بار برگرداند.
  if v_sale.status = 'cancelled' then
    return false;
  end if;

  -- برگشت موجودی: فروش خروج بوده، ابطال باید ورود ایجاد کند.
  for v_item in select * from public.sale_items where sale_id = p_sale loop
    insert into public.stock_movements(
      org_id, branch_id, variant_id, type, reason, qty, ref_table, ref_id, note, created_by
    ) values (
      v_item.org_id, v_item.branch_id, v_item.variant_id,
      'in', 'return', v_item.qty, 'sales_cancel', p_sale,
      coalesce(p_reason, 'ابطال فاکتور فروش'), p_actor
    );
  end loop;

  -- خنثی‌سازی دریافت‌های ثبت‌شده، برای اصلاح صندوق/بانک و مانده‌ی مشتری.
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
      p_actor
    );
  end loop;

  update public.sales
  set status        = 'cancelled',
      cancelled_at  = now(),
      cancelled_by  = p_actor,
      cancel_reason = p_reason,
      updated_at    = now()
  where id = p_sale;

  return true;
end;
$$;

revoke all on function public.apply_sale_cancellation(uuid, uuid, text) from public, anon, authenticated;


/*
  cancel_sale — امضا و رفتار عمومی دقیقاً مثل مهاجرت ۰۰۰۷.
  فقط بدنه‌اش حالا مکانیک مشترک را صدا می‌زند.
*/
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
  v_uid  uuid := auth.uid();
  v_org  uuid;
begin
  if not public.has_permission('sales.create') then
    raise exception 'دسترسی ابطال فاکتور وجود ندارد';
  end if;

  select org_id into v_org from public.sales where id = p_sale;
  if v_org is null then
    raise exception 'فاکتور فروش یافت نشد';
  end if;

  if not (v_org in (select public.user_org_ids())) then
    raise exception 'دسترسی غیرمجاز';
  end if;

  perform public.apply_sale_cancellation(p_sale, v_uid, p_reason);
end;
$$;

grant execute on function public.cancel_sale(uuid, text) to authenticated, service_role;


/**
 * ابطال فاکتور توسط ادمین پلتفرم.
 *
 * تفاوت‌های عمدی با cancel_sale:
 *   • مجوز از ماتریس پلتفرم می‌آید (invoice.modify)، نه memberships
 *   • دلیل *اجباری* است. وقتی کسی بیرون از کسب‌وکار سند مالی مشتری
 *     را دست‌کاری می‌کند، «چرا» بخشی از خود عمل است نه یادداشت
 *     اختیاری. همان قاعده‌ای که برای بازنشانی رمز گذاشتیم.
 *   • در platform_audit_logs ثبت می‌شود تا در گزارش فعالیت دیده شود
 */
create or replace function public.admin_cancel_sale(
  p_sale   uuid,
  p_actor  uuid,
  p_reason text,
  p_ip     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale    record;
  v_org     text;
  v_changed boolean;
begin
  if p_actor is null or not public.platform_admin_can('invoice.modify', p_actor) then
    raise exception 'دسترسی اصلاح فاکتور وجود ندارد';
  end if;

  if length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'ثبت دلیل الزامی است (حداقل ۵ نویسه)';
  end if;

  select s.*, o.name as org_name into v_sale
  from public.sales s
  left join public.organizations o on o.id = s.org_id
  where s.id = p_sale;

  if not found then
    raise exception 'فاکتور فروش یافت نشد';
  end if;

  v_org := coalesce(v_sale.org_name, '?');

  v_changed := public.apply_sale_cancellation(
    p_sale, p_actor, 'ابطال توسط پشتیبانی: ' || trim(p_reason)
  );

  /*
    حتی وقتی چیزی عوض نشد (فاکتور از قبل باطل بود) رویداد ثبت می‌شود.
    «ادمین تلاش کرد» خودش اطلاعات ممیزی است؛ سکوت در این حالت یعنی
    بعداً نتوانیم بفهمیم چه کسی سراغ این سند رفته بود.
  */
  perform public.log_platform_action(
    'invoice.cancel', p_actor, 'sale', p_sale::text,
    coalesce(v_sale.invoice_no, p_sale::text) || ' — ' || v_org,
    trim(p_reason),
    jsonb_build_object(
      'org_id',  v_sale.org_id,
      'total',   v_sale.total,
      'already_cancelled', not v_changed
    ),
    p_ip
  );

  return jsonb_build_object('cancelled', v_changed, 'invoice_no', v_sale.invoice_no);
end;
$$;

revoke all on function public.admin_cancel_sale(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_cancel_sale(uuid, uuid, text, text) to service_role;


-- -------------------------------------------------------------
-- بخش ۴) وضعیت فنی سرویس
--
-- هر عدد اینجا یک *اندازه‌گیری واقعی* است، نه تخمین. صفحه‌ی وضعیتی
-- که اعداد ساختگی یا همیشه-سبز نشان بدهد، بدتر از نداشتنش است:
-- باعث می‌شود موقع خرابی هم به آن نگاه کنیم و خیالمان راحت شود.
-- -------------------------------------------------------------

create or replace function public.platform_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_out jsonb;
begin
  select jsonb_build_object(
    'db', jsonb_build_object(
      'version',      (select current_setting('server_version')),
      'size_bytes',   (select pg_database_size(current_database())),
      'size_pretty',  (select pg_size_pretty(pg_database_size(current_database()))),
      -- سقف پلن رایگان Supabase؛ برای نوار پیشرفت لازم است.
      'quota_bytes',  500 * 1024 * 1024,
      'connections',  (select count(*) from pg_stat_activity where datname = current_database()),
      'active_queries', (select count(*) from pg_stat_activity
                          where datname = current_database() and state = 'active'),
      -- طولانی‌ترین کوئری در حال اجرا (ثانیه). نشانه‌ی قفل یا اسکن سنگین.
      'longest_query_sec', (select coalesce(max(extract(epoch from (now() - query_start)))::int, 0)
                             from pg_stat_activity
                            where datname = current_database() and state = 'active'
                              and query not ilike '%pg_stat_activity%')
    ),
    'tables', jsonb_build_object(
      'organizations',   (select count(*) from public.organizations),
      'users',           (select count(*) from auth.users),
      'sales',           (select count(*) from public.sales),
      'products',        (select count(*) from public.products),
      'contacts',        (select count(*) from public.contacts),
      'stock_movements', (select count(*) from public.stock_movements),
      'transactions',    (select count(*) from public.transactions),
      'audit_logs',      (select count(*) from public.platform_audit_logs)
    ),
    'errors', jsonb_build_object(
      'last_1h',  (select count(*) from public.platform_error_logs
                    where created_at > now() - interval '1 hour'),
      'last_24h', (select count(*) from public.platform_error_logs
                    where created_at > now() - interval '24 hours'),
      'last_7d',  (select count(*) from public.platform_error_logs
                    where created_at > now() - interval '7 days'),
      'total',    (select count(*) from public.platform_error_logs),
      'newest_at',(select max(created_at) from public.platform_error_logs)
    ),
    'auth', jsonb_build_object(
      'unconfirmed',  (select count(*) from auth.users where email_confirmed_at is null),
      'active_24h',   (select count(*) from auth.users
                        where last_sign_in_at > now() - interval '24 hours'),
      'never_signed_in', (select count(*) from auth.users where last_sign_in_at is null),
      /*
        ⚠️ login_attempts جدول «رویداد» نیست، جدول «شمارنده»ست:
        (login_id, failed_count, last_failed_at, blocked_until).
        نسخه‌ی اول این تابع فرض کرد created_at و success دارد و با
        خطای 42703 شکست خورد. پس دو عدد واقعی گزارش می‌شود:
        چند حسابِ متمایز اخیراً خطا خورده‌اند و چندتا الان قفل‌اند.
      */
      'accounts_failing_1h', (select count(*) from public.login_attempts
                               where last_failed_at > now() - interval '1 hour'),
      'accounts_locked', (select count(*) from public.login_attempts
                           where blocked_until is not null and blocked_until > now())
    ),
    'activity', jsonb_build_object(
      -- «آیا اصلاً کسی دارد کار می‌کند؟» مهم‌ترین سیگنال سلامتِ محصول.
      'last_sale_at',    (select max(created_at) from public.sales),
      'sales_24h',       (select count(*) from public.sales
                           where created_at > now() - interval '24 hours'),
      'open_tickets',    (select count(*) from public.support_tickets
                           where status in ('open', 'pending')),
      -- قدیمی‌ترین تیکت بی‌پاسخ (ساعت). اگر بزرگ شد یعنی صف رها شده.
      'oldest_unanswered_hours', (
        select coalesce(max(extract(epoch from (now() - created_at)) / 3600)::int, 0)
        from public.support_tickets
        where status = 'open' and first_response_at is null
      ),
      'trials_expiring_3d', (select count(*) from public.organizations
                              where trial_ends_at is not null
                                and trial_ends_at > now()
                                and trial_ends_at < now() + interval '3 days')
    ),
    'measured_at', now()
  ) into v_out;

  return v_out;
end;
$$;

grant execute on function public.platform_health() to service_role;


-- -------------------------------------------------------------
-- بخش ۵) اقلام یک فاکتور برای نمای ادمین
--
-- جداگانه از نمای فهرست، چون فقط هنگام باز کردن یک فاکتور لازم است
-- و join کردنش در فهرست، هزینه‌ی هر بار خواندن صفحه را بی‌دلیل
-- چند برابر می‌کرد.
-- -------------------------------------------------------------

drop view if exists public.v_admin_invoice_items;
create view public.v_admin_invoice_items as
select
  si.id,
  si.sale_id,
  si.org_id,
  si.qty,
  si.unit_price,
  si.discount,
  si.line_total,
  si.variant_id,
  p.name          as product_name,
  p.code          as product_code,
  v.sku,
  v.color,
  v.size
from public.sale_items si
left join public.product_variants v on v.id = si.variant_id
left join public.products p         on p.id = v.product_id;

comment on view public.v_admin_invoice_items is
  'اقلام فاکتور برای پنل سوپرادمین. definer، فقط service_role.';

revoke all on public.v_admin_invoice_items from anon, authenticated;
grant select on public.v_admin_invoice_items to service_role;
