-- =============================================================
-- Tarazoo Migration 0036 — تیکت پشتیبانی: تکمیل مدل داده
--
-- جدول‌های support_tickets و support_messages در مهاجرت ۰۰۲۸ ساخته
-- شدند ولی هیچ‌وقت رابط کاربری نگرفتند و چند شکاف در مدل داده باقی
-- ماند. این مهاجرت آن شکاف‌ها را می‌بندد.
--
-- نوع: افزایشی. هیچ ستون/policy/داده‌ی موجودی حذف نمی‌شود.
-- (تعداد تیکت‌های موجود هنگام نوشتن این مهاجرت: صفر.)
--
-- EMERGENCY ROLLBACK: supabase/rollbacks/0036_support_tickets.down.sql
-- =============================================================


-- -------------------------------------------------------------
-- بخش ۰) 🔴 باگ: مجوز tickets.reply از ماتریس افتاده بود
--
-- مهاجرت ۰۰۲۸ مجوز 'tickets.reply' را تعریف کرد. مهاجرت‌های ۰۰۳۱ و
-- ۰۰۳۳ کل تابع platform_admin_can را بازنویسی کردند و این سطر در
-- بازنویسی جا ماند. نتیجه: مجوز به `else false` می‌افتاد.
--
-- اندازه‌گیری روی دیتابیس زنده، پیش از این مهاجرت:
--   select platform_admin_can('tickets.reply', '<super_admin>')  → false
--   select platform_admin_can('orgs.view',     '<super_admin>')  → true
--
-- یعنی اگر رابط تیکت را بدون این اصلاح می‌ساختیم، حتی مدیر ارشد هم
-- ۴۰۳ می‌گرفت — همان اتفاقی که در ۰۰۳۱ برای users.view و impersonate
-- و announcements.manage افتاد و روی سایت زنده کشف شد.
--
-- درس ساختاری: تست tests/custom-roles.test.ts فقط فایل ۰۰۳۳ را
-- می‌خواند. در همین کامیت اصلاح شد تا همیشه *آخرین* مهاجرتی را که
-- ماتریس را بازنویسی می‌کند پیدا کند، وگرنه این باگ برای بار سوم
-- تکرار می‌شود.
-- -------------------------------------------------------------

insert into public.platform_permissions (key, label, description, category, risk, sort_order) values
  ('tickets.view',  'مشاهده تیکت‌ها', 'دیدن تیکت‌های پشتیبانی همه‌ی کسب‌وکارها',        'پشتیبانی', 'medium', 140),
  ('tickets.reply', 'پاسخ به تیکت',  'ارسال پاسخ و تغییر وضعیت تیکت‌های پشتیبانی',      'پشتیبانی', 'medium', 150)
on conflict (key) do update
  set label       = excluded.label,
      description = excluded.description,
      category    = excluded.category,
      risk        = excluded.risk,
      sort_order  = excluded.sort_order;

/*
  چرا دو مجوز جدا و نه یکی؟

  «دیدن» و «پاسخ‌دادن» دو سطح متفاوت‌اند. یک ادمین مالی ممکن است لازم
  باشد تیکت‌ها را بخواند تا زمینه‌ی یک اختلاف صورتحساب را بفهمد، بدون
  اینکه از طرف تیم پشتیبانی حرف بزند. پاسخ در تیکت به نام پلتفرم ثبت
  می‌شود و مشتری آن را رسمی تلقی می‌کند.
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

  /*
    🔴 گارد NULL — از مهاجرت ۰۰۲۸.
    `v_role not in (...)` وقتی v_role تهی است نتیجه‌اش NULL است نه
    TRUE، پس کاربر غیرادمین از گارد رد می‌شد.
  */
  if v_role is null then
    return false;
  end if;

  /*
    نقش سفارشی: فقط آرایه ملاک است.

    عمداً هیچ مجوز پیش‌فرضی — حتی orgs.view — داده نمی‌شود. اگر
    «مشاهده» را رایگان می‌دادیم، ساختن نقشی که *نتواند* کسب‌وکارها را
    ببیند ممکن نبود.
  */
  if v_role = 'custom' then
    return p_permission = any(coalesce(v_custom, '{}'));
  end if;

  -- ماتریس ثابت — سطرهای ۰۰۳۳ دست‌نخورده، فقط دو سطر تیکت اضافه شد.
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
    /* ── تیکت پشتیبانی ── */
    -- خواندن برای همه‌ی نقش‌های ثابت باز است؛ زمینه‌ی کار همه‌شان است.
    when 'tickets.view'     then true
    -- پاسخ به نام پلتفرم ثبت می‌شود، پس محدود به دو نقشی که «حرف
    -- پلتفرم» را می‌زنند.
    when 'tickets.reply'    then v_role in ('super_admin', 'support')
    else false
  end;
end;
$$;

comment on function public.platform_admin_can(text, uuid) is
  'ماتریس مجوز ادمین پلتفرم. نقش custom از custom_permissions می‌خواند، بقیه از ماتریس ثابت.';

grant execute on function public.platform_admin_can(text, uuid) to authenticated, service_role;


-- -------------------------------------------------------------
-- بخش ۱) ستون‌های تازه‌ی تیکت
-- -------------------------------------------------------------

alter table public.support_tickets
  -- دسته‌بندی برای مسیریابی: مشکل فنی به تیم فنی، صورتحساب به مالی.
  add column if not exists category text not null default 'other',
  -- ادمین مسئول. بدون این، همه فکر می‌کنند یکی دیگر جواب می‌دهد.
  add column if not exists assigned_to uuid references auth.users(id) on delete set null,
  /*
    زمان اولین پاسخ تیم پشتیبانی.

    این تنها شاخصی است که مشتری واقعاً حس می‌کند. «میانگین زمان بسته‌شدن»
    عدد قشنگی است ولی کسی که ۶ ساعت منتظر *اولین* جواب مانده، تیکت
    بسته‌شده در روز سوم راضی‌اش نمی‌کند.
  */
  add column if not exists first_response_at timestamptz,
  add column if not exists closed_at timestamptz,
  /*
    آخرین پیام: زمان و اینکه از کدام طرف بود.

    ذخیره می‌شود (نه محاسبه‌ی زنده) چون فهرست تیکت‌ها باید بر اساس
    «آخرین فعالیت» مرتب شود و مرتب‌سازی روی زیرکوئری، نمایه‌پذیر نیست.
  */
  add column if not exists last_message_at timestamptz,
  add column if not exists last_message_by text,
  /*
    نشانگر «خوانده‌نشده» برای هر طرف.

    چرا دو ستون تاریخ و نه یک boolean؟ boolean باید در دو جا (موقع
    ارسال پیام و موقع باز کردن) هماهنگ بماند و هر ناهماهنگی یعنی
    نشانگر دروغین. با مقایسه‌ی دو زمان، حقیقت همیشه یکتاست:
      unread  ⇔  last_message_at > read_at
  */
  add column if not exists staff_read_at timestamptz,
  add column if not exists customer_read_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'support_tickets_category_check'
  ) then
    alter table public.support_tickets add constraint support_tickets_category_check
      check (category in ('technical', 'billing', 'feature', 'data', 'other'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'support_tickets_last_by_check'
  ) then
    alter table public.support_tickets add constraint support_tickets_last_by_check
      check (last_message_by is null or last_message_by in ('staff', 'customer'));
  end if;
end $$;

comment on column public.support_tickets.first_response_at is
  'زمان اولین پاسخ تیم پشتیبانی — شاخص اصلی کیفیت پشتیبانی.';

-- فهرست ادمین بر اساس آخرین فعالیت مرتب می‌شود.
create index if not exists idx_ticket_last_msg
  on public.support_tickets(last_message_at desc nulls last);
create index if not exists idx_ticket_assigned
  on public.support_tickets(assigned_to) where assigned_to is not null;


-- -------------------------------------------------------------
-- بخش ۲) 🔴 امنیت: is_staff قابل جعل بود
--
-- policy موجود (p_msg_write) فقط عضویت در سازمان را چک می‌کند. ستون
-- is_staff مستقیم از بدنه‌ی درخواست می‌آمد، پس یک مشتری معمولی
-- می‌توانست با یک درخواست ساده به PostgREST پیامی با is_staff=true
-- بسازد و در نخ گفتگو *به‌جای تیم پشتیبانی* حرف بزند — با همان حباب
-- رنگی و همان اعتبار.
--
-- حالا مقدار این ستون هرگز از ورودی خوانده نمی‌شود؛ از روی author_id
-- محاسبه می‌شود.
--
-- ⚠️ چرا از auth.uid() استفاده نمی‌کنیم؟
--   روت‌های ادمین با کلید service_role کار می‌کنند و در آن مسیر
--   auth.uid() برابر NULL است. اگر مبنا auth.uid() بود، پاسخ خودِ تیم
--   پشتیبانی is_staff=false می‌گرفت و در سمت مشتری به‌عنوان پیام خودش
--   نمایش داده می‌شد. author_id در هر دو مسیر معتبر است.
-- -------------------------------------------------------------

create or replace function public.support_message_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- کاربر واردشده نمی‌تواند از طرف کس دیگری بنویسد.
  if auth.uid() is not null then
    new.author_id := auth.uid();
  end if;

  new.is_staff := exists (
    select 1 from public.platform_admins pa where pa.user_id = new.author_id
  );

  return new;
end;
$$;

drop trigger if exists trg_support_message_before_insert on public.support_messages;
create trigger trg_support_message_before_insert
  before insert on public.support_messages
  for each row execute function public.support_message_before_insert();


/**
 * پس از هر پیام، تیکت والد به‌روز می‌شود.
 *
 * چرخه‌ی وضعیت که پیاده می‌شود (مدل رایج میز پشتیبانی):
 *   پیام مشتری  → open    (توپ در زمین ماست)
 *   پاسخ پشتیبانی → pending (توپ در زمین مشتری)
 * تیکت closed با پیام تازه‌ی مشتری خودبه‌خود باز می‌شود؛ وگرنه مشتری
 * می‌نویسد و هیچ‌کس خبردار نمی‌شود.
 */
create or replace function public.support_message_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.support_tickets t
  set
    last_message_at = new.created_at,
    last_message_by = case when new.is_staff then 'staff' else 'customer' end,
    updated_at      = now(),
    -- فقط اولین پاسخ ثبت می‌شود؛ پاسخ‌های بعدی آن را عقب نمی‌برند.
    first_response_at = case
      when new.is_staff and t.first_response_at is null then new.created_at
      else t.first_response_at
    end,
    /*
      نویسنده‌ی پیام قطعاً آن را خوانده است. بدون این، فرستنده برای
      پیام خودش نشان «خوانده‌نشده» می‌دید.
    */
    staff_read_at    = case when new.is_staff then new.created_at else t.staff_read_at end,
    customer_read_at = case when new.is_staff then t.customer_read_at else new.created_at end,
    status = case
      when t.status = 'closed' and not new.is_staff then 'open'
      when t.status in ('open', 'pending', 'resolved') then
        case when new.is_staff then 'pending' else 'open' end
      else t.status
    end,
    closed_at = case when t.status = 'closed' and not new.is_staff then null else t.closed_at end
  where t.id = new.ticket_id;

  return null;
end;
$$;

drop trigger if exists trg_support_message_after_insert on public.support_messages;
create trigger trg_support_message_after_insert
  after insert on public.support_messages
  for each row execute function public.support_message_after_insert();


-- -------------------------------------------------------------
-- بخش ۳) گاردهای تیکت
-- -------------------------------------------------------------

create or replace function public.support_ticket_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- created_by در policy چک نمی‌شد؛ کاربر می‌توانست تیکت را به نام
  -- شخص دیگری ثبت کند.
  if auth.uid() is not null then
    new.created_by := auth.uid();
  end if;

  new.status     := 'open';
  new.created_at := now();
  new.updated_at := now();
  new.closed_at  := null;
  new.first_response_at := null;

  return new;
end;
$$;

drop trigger if exists trg_support_ticket_before_insert on public.support_tickets;
create trigger trg_support_ticket_before_insert
  before insert on public.support_tickets
  for each row execute function public.support_ticket_before_insert();


/**
 * محدودکردن تغییراتی که *مشتری* می‌تواند روی تیکت خودش انجام دهد.
 *
 * لازم شد چون برای «بستن تیکت» و «علامت‌زدن خوانده‌شده» ناچار بودیم
 * به مشتری حق UPDATE بدهیم — و UPDATE بدون قید یعنی مشتری می‌تواند
 * تیکتش را به سازمان دیگری منتقل کند یا خودش را ادمین مسئول بگذارد.
 *
 * ⚠️ وقتی auth.uid() تهی است یعنی مسیر service_role — یعنی روت
 *    /api/admin که پیش از هر کوئری requirePlatformPermission زده.
 *    آنجا گارد در لایه‌ی API است، نه اینجا.
 */
create or replace function public.support_ticket_guard_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();

  if auth.uid() is null then
    return new;                       -- service_role: گارد در لایه‌ی API
  end if;

  if exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()) then
    return new;                       -- ادمین پلتفرم
  end if;

  -- ── از اینجا به بعد: مشتری ──
  new.org_id      := old.org_id;
  new.created_by  := old.created_by;
  new.subject     := old.subject;
  new.created_at  := old.created_at;
  new.assigned_to := old.assigned_to;
  new.staff_read_at := old.staff_read_at;
  new.first_response_at := old.first_response_at;

  -- مشتری فقط می‌تواند ببندد یا دوباره باز کند.
  if new.status is distinct from old.status
     and new.status not in ('open', 'closed') then
    raise exception 'تغییر وضعیت مجاز نیست';
  end if;

  new.closed_at := case
    when new.status = 'closed' and old.status <> 'closed' then now()
    when new.status <> 'closed' then null
    else old.closed_at
  end;

  return new;
end;
$$;

drop trigger if exists trg_support_ticket_guard_update on public.support_tickets;
create trigger trg_support_ticket_guard_update
  before update on public.support_tickets
  for each row execute function public.support_ticket_guard_update();


-- مشتری باید بتواند تیکت خودش را ببندد و «خوانده‌شده» علامت بزند.
-- محدوده‌ی واقعی تغییرات را تریگر بالا تعیین می‌کند، نه این policy.
drop policy if exists p_ticket_owner_update on public.support_tickets;
create policy p_ticket_owner_update on public.support_tickets
  for update to authenticated
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));


-- -------------------------------------------------------------
-- بخش ۴) نمای فهرست تیکت برای پنل ادمین
--
-- ⚠️ security_invoker عمداً خاموش (پیش‌فرض definer) — این نما به
-- auth.users دست می‌زند و آن جدول به هیچ نقشی SELECT نمی‌دهد، حتی
-- service_role. همان درسی که در ۰۰۲۸ (v_admin_users)، ۰۰۳۲
-- (v_user_sessions) و ۰۰۳۵ (v_org_usage) گرفته شد.
-- -------------------------------------------------------------
drop view if exists public.v_support_tickets;
create view public.v_support_tickets as
select
  t.id,
  t.org_id,
  o.name              as org_name,
  o.owner_full_name,
  o.approval_status,
  t.created_by,
  u.email             as creator_email,
  (u.raw_user_meta_data ->> 'name') as creator_name,
  t.subject,
  t.status,
  t.priority,
  t.category,
  t.assigned_to,
  au.email            as assignee_email,
  t.created_at,
  t.updated_at,
  t.first_response_at,
  t.closed_at,
  t.last_message_at,
  t.last_message_by,
  t.staff_read_at,
  t.customer_read_at,
  (select count(*) from public.support_messages m where m.ticket_id = t.id) as message_count,
  /* خوانده‌نشده برای تیم پشتیبانی: آخرین پیام بعد از آخرین بازدید ما */
  (t.last_message_by = 'customer'
     and (t.staff_read_at is null or t.last_message_at > t.staff_read_at)) as unread_for_staff
from public.support_tickets t
left join public.organizations o on o.id = t.org_id
left join auth.users u  on u.id  = t.created_by
left join auth.users au on au.id = t.assigned_to;

comment on view public.v_support_tickets is
  'فهرست تیکت‌ها برای پنل مدیریت، همراه نام کسب‌وکار و ایمیل فرستنده.';

revoke all on public.v_support_tickets from anon, authenticated;
grant select on public.v_support_tickets to service_role;
