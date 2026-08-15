-- 0045 — اعلان‌های کسب‌وکار و پوش دستگاه
--
-- سه مسئله را حل می‌کند:
--
-- ۱) 🔴 زنگوله پر از یادداشت انتشار است.
--    شمارش واقعی: ۲۷ نسخه با ۱۰۹ تغییر، که ۳۴ تای آن «رفع اشکال»
--    جزئی است. کاربر برای دیدن یک خبر مهم باید از ده تا «چسبیدن
--    تاریخ در فهرست پرداخت» رد شود. نتیجه: زنگوله را باز نمی‌کند.
--    → ستون `important` روی یادداشت‌ها (سمت کد) + این جدول برای
--      اعلان‌های واقعیِ کسب‌وکار.
--
-- ۲) اعلان از داده‌ی خودِ مجموعه: سررسید چک، مانده‌ی مشتری، پیگیری
--    CRM. الان هیچ‌کدام اعلان ندارند.
--
-- ۳) پوش روی دستگاه (گوشی) با Web Push استاندارد.
--
-- ⚠️ محدودیت iOS که باید در UI صادقانه گفته شود: پوش روی آیفون فقط
-- بعد از «افزودن به صفحه اصلی» و در iOS 16.4+ کار می‌کند. در تب
-- معمولی سافاری اصلاً `PushManager` وجود ندارد.

-- -------------------------------------------------------------
-- ۱) اعلان‌های درون‌برنامه‌ای
-- -------------------------------------------------------------
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  /*
    null یعنی «برای همه‌ی اعضای سازمان».
    سررسید چک به همه مربوط است؛ ولی «تیکت شما پاسخ داده شد» فقط به
    یک نفر.
  */
  user_id     uuid references auth.users(id) on delete cascade,
  kind        text not null check (kind in (
                'check_due','check_overdue','debt_reminder','crm_followup',
                'low_stock','order_pending','payment_received','system'
              )),
  title       text not null,
  body        text,
  /** مسیر داخل برنامه که با کلیک باز می‌شود. */
  link        text,
  /** اهمیت: high روی دستگاه پوش می‌شود، normal فقط داخل زنگوله. */
  priority    text not null default 'normal' check (priority in ('normal','high')),
  /*
    کلید یکتاسازی برای جلوگیری از تکرار.
    مثلاً 'check_due:<check_id>:1405-05-20' — اگر کرون دو بار در روز
    اجرا شود، اعلان دوم ساخته نمی‌شود.
  */
  dedupe_key  text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

/*
  🔴 یکتایی روی (org, dedupe_key).
  بدون این، هر اجرای زمان‌بند یک اعلان تکراری می‌ساخت و زنگوله ظرف
  یک هفته صد ردیف «چک فردا سررسید می‌شود» داشت — دقیقاً همان مشکلی
  که می‌خواهیم حلش کنیم.
*/
create unique index if not exists uq_notifications_dedupe
  on public.notifications(org_id, dedupe_key)
  where dedupe_key is not null;

create index if not exists idx_notifications_inbox
  on public.notifications(org_id, created_at desc);

create index if not exists idx_notifications_unread
  on public.notifications(org_id, read_at)
  where read_at is null;

alter table public.notifications enable row level security;

/*
  ⚠️ `security_invoker` نیست چون RLS مستقیم است: عضو سازمان ردیف‌های
  سازمان خودش را می‌بیند، به‌علاوه‌ی ردیف‌هایی که user_id شخص خودش
  است یا null (همگانی).
*/
drop policy if exists "notifications_select" on public.notifications;
create policy "notifications_select" on public.notifications
  for select to authenticated
  using (
    org_id in (select public.user_org_ids())
    and (user_id is null or user_id = auth.uid())
  );

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update to authenticated
  using (
    org_id in (select public.user_org_ids())
    and (user_id is null or user_id = auth.uid())
  );

/*
  ⛔ هیچ سیاست insert برای کاربر عادی.
  اعلان‌ها فقط با توابع security definer ساخته می‌شوند، وگرنه هر
  کاربری می‌توانست اعلان جعلی به همکارانش بفرستد.
*/

-- -------------------------------------------------------------
-- ۲) اشتراک پوش دستگاه
-- -------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  org_id      uuid references public.organizations(id) on delete cascade,
  /** endpoint یکتای مرورگر — کلید طبیعی اشتراک. */
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists idx_push_user on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_own_all" on public.push_subscriptions;
create policy "push_own_all" on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- -------------------------------------------------------------
-- ۳) ساخت اعلان (فقط از سمت سرور)
-- -------------------------------------------------------------
create or replace function public.push_notification(
  p_org uuid,
  p_kind text,
  p_title text,
  p_body text default null,
  p_link text default null,
  p_priority text default 'normal',
  p_dedupe text default null,
  p_user uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.notifications(org_id, user_id, kind, title, body, link, priority, dedupe_key)
  values (p_org, p_user, p_kind, left(p_title, 200), left(p_body, 500), p_link,
          case when p_priority = 'high' then 'high' else 'normal' end, p_dedupe)
  -- تکراری بی‌صدا نادیده گرفته می‌شود؛ زمان‌بند نباید با خطا بایستد.
  on conflict (org_id, dedupe_key) where dedupe_key is not null do nothing
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.push_notification(uuid, text, text, text, text, text, text, uuid) from public, anon, authenticated;

-- -------------------------------------------------------------
-- ۳.۵) مبلغ فارسی برای متن اعلان
-- -------------------------------------------------------------
--
-- 🔴 `to_char` ارقام لاتین می‌سازد و متن اعلان **مستقیم** به کاربر
-- نشان داده می‌شود — هم در زنگوله، هم در پوش دستگاه که هیچ لایه‌ی
-- نمایشی برای تبدیل ندارد. «500,000 تومان» وسط جمله‌ی فارسی هم زشت
-- است و هم با bidi جابه‌جا می‌شود.
--
-- در اسکرین‌شات دیده شد، نه در تست.
create or replace function public.fa_amount(p_rial bigint)
returns text
language sql
immutable
as $$
  select translate(to_char(p_rial / 10, 'FM999,999,999,999'),
                   '0123456789', '۰۱۲۳۴۵۶۷۸۹')
$$;

comment on function public.fa_amount(bigint) is 'ریال → تومان با ارقام فارسی، برای متن اعلان‌ها.';

-- -------------------------------------------------------------
-- ۴) ساخت اعلان از داده‌ی واقعی کسب‌وکار
-- -------------------------------------------------------------
--
-- این تابع همان منابع «کارهای امروز» را می‌خواند و برایشان اعلان
-- می‌سازد. جدا از action_center است چون آن فقط *می‌خواند* و این
-- *می‌نویسد*؛ قاطی‌کردنشان یعنی هر بار باز کردن داشبورد، اعلان
-- بسازد.
create or replace function public.generate_business_notifications(p_org uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
  v_today text := to_char(now(), 'YYYY-MM-DD');
  r record;
begin
  if not (p_org in (select public.user_org_ids())) then
    raise exception 'دسترسی غیرمجاز';
  end if;

  -- چک‌های سررسیدگذشته → اولویت بالا (عواقب قانونی دارد)
  for r in
    select c.id, c.check_no, c.amount, c.due_date, c.type, ct.name
    from public.checks c
    left join public.contacts ct on ct.id = c.contact_id
    where c.org_id = p_org
      and c.status in ('pending','deposited')
      and c.due_date < now()
    limit 20
  loop
    if public.push_notification(
      p_org, 'check_overdue',
      case when r.type = 'received' then 'چک دریافتی سررسید گذشته' else 'چک پرداختی سررسید گذشته' end,
      coalesce(r.name || ' — ', '') || public.fa_amount(r.amount) || ' تومان',
      '/checks', 'high',
      'check_overdue:' || r.id::text
    ) is not null then v_count := v_count + 1; end if;
  end loop;

  -- چک‌های سه روز آینده → هشدار زودهنگام
  for r in
    select c.id, c.amount, c.due_date, c.type, ct.name
    from public.checks c
    left join public.contacts ct on ct.id = c.contact_id
    where c.org_id = p_org
      and c.status in ('pending','deposited')
      and c.due_date >= now()
      and c.due_date <= now() + interval '3 days'
    limit 20
  loop
    if public.push_notification(
      p_org, 'check_due', 'چک نزدیک سررسید',
      coalesce(r.name || ' — ', '') || public.fa_amount(r.amount) || ' تومان',
      '/checks', 'high',
      -- تاریخ در کلید: هر روز یک یادآوری، نه بیشتر
      'check_due:' || r.id::text || ':' || v_today
    ) is not null then v_count := v_count + 1; end if;
  end loop;

  /*
    پیگیری‌های CRM که موعدشان رسیده.
    next_followup را کاربر خودش تعیین کرده، پس این دقیقاً چیزی است
    که خواسته یادآوری شود.
  */
  for r in
    select ci.id, ci.title, ci.next_followup, ct.name
    from public.contact_interactions ci
    left join public.contacts ct on ct.id = ci.contact_id
    where ci.org_id = p_org
      and ci.next_followup is not null
      and ci.next_followup <= now()
    limit 20
  loop
    if public.push_notification(
      p_org, 'crm_followup', 'پیگیری مشتری',
      coalesce(r.name, 'مشتری') || coalesce(' — ' || r.title, ''),
      '/crm/interactions', 'normal',
      'crm:' || r.id::text || ':' || v_today
    ) is not null then v_count := v_count + 1; end if;
  end loop;

  /*
    بدهی معوق بیش از ۳۰ روز.
    ۳۰ روز مرز عرفی است؛ زیر آن نسیه‌ی عادی است و اعلانش اعتماد
    کاربر به هشدارها را از بین می‌برد — درسی که از «موجودی کم» با
    ۳۶۱ مورد گرفتیم.
  */
  for r in
    select s.id, s.invoice_no, s.paid_credit, s.date, ct.name
    from public.sales s
    left join public.contacts ct on ct.id = s.customer_id
    where s.org_id = p_org
      and s.status <> 'cancelled'
      and s.paid_credit > 0
      and s.date < now() - interval '30 days'
    limit 20
  loop
    if public.push_notification(
      p_org, 'debt_reminder', 'بدهی معوق',
      coalesce(r.name, 'مشتری نقدی') || ' — ' || public.fa_amount(r.paid_credit) || ' تومان',
      '/sales/' || r.id::text, 'normal',
      -- هفتگی، نه روزانه: بدهی ۶۰ روزه هر روز یادآوری لازم ندارد
      'debt:' || r.id::text || ':' || to_char(now(), 'IYYY-IW')
    ) is not null then v_count := v_count + 1; end if;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.generate_business_notifications(uuid) from public, anon;
grant execute on function public.generate_business_notifications(uuid) to authenticated;

-- -------------------------------------------------------------
-- ۵) خواندن و علامت‌گذاری
-- -------------------------------------------------------------
create or replace function public.mark_notifications_read(p_org uuid, p_ids uuid[] default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v int;
begin
  if not (p_org in (select public.user_org_ids())) then
    raise exception 'دسترسی غیرمجاز';
  end if;

  update public.notifications
  set read_at = now()
  where org_id = p_org
    and read_at is null
    and (user_id is null or user_id = auth.uid())
    and (p_ids is null or id = any(p_ids));

  get diagnostics v = row_count;
  return v;
end;
$$;

revoke all on function public.mark_notifications_read(uuid, uuid[]) from public, anon;
grant execute on function public.mark_notifications_read(uuid, uuid[]) to authenticated;

comment on table public.notifications is 'اعلان‌های کسب‌وکار: سررسید چک، بدهی، پیگیری CRM. جدا از یادداشت انتشار.';
comment on table public.push_subscriptions is 'اشتراک Web Push هر دستگاه. iOS فقط پس از افزودن به صفحه اصلی.';
