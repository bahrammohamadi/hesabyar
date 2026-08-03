-- =============================================================
-- Tarazoo Migration 0028 — پنل سوپرادمین فاز ۲
--
-- سه قابلیت که در فاز ۱ جا مانده بودند:
--   ۱. ورود به‌جای کاربر (impersonation) با ردپای کامل
--   ۲. اعلان سراسری برای همه یا یک سازمان
--   ۳. تیکت پشتیبانی دوطرفه
--
-- نوع: افزایشی. هیچ ستون/policy/داده‌ی موجودی حذف نمی‌شود.
--
-- EMERGENCY ROLLBACK: supabase/rollbacks/0028_admin_phase2.down.sql
-- =============================================================


-- -------------------------------------------------------------
-- بخش ۰) گسترش ماتریس مجوز برای قابلیت‌های فاز ۲
--
-- ماتریس در 0027 تعریف شد؛ اینجا فقط سه مجوز تازه اضافه می‌شود.
-- تعریف کامل بازنویسی می‌شود چون CASE یکپارچه است.
-- -------------------------------------------------------------
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
  v_role text := public.platform_admin_role(coalesce(p_user, auth.uid()));
begin
  if v_role is null then
    return false;
  end if;

  return case p_permission
    -- مشاهده: همه‌ی نقش‌ها
    when 'orgs.view'        then true
    when 'audit.view'       then true
    when 'users.view'       then true
    -- چرخه‌ی تأیید کسب‌وکار
    when 'orgs.approve'     then v_role in ('super_admin', 'support')
    when 'orgs.suspend'     then v_role in ('super_admin')
    -- اشتراک و مالی
    when 'trial.extend'     then v_role in ('super_admin', 'support', 'finance')
    when 'plan.change'      then v_role in ('super_admin', 'finance')
    -- داده‌ی کسب‌وکار مشتری (حساس‌ترین)
    when 'invoice.view'     then v_role in ('super_admin', 'support')
    when 'invoice.modify'   then v_role in ('super_admin')
    -- مدیریت خود ادمین‌ها
    when 'admins.manage'    then v_role = 'super_admin'
    /* ── فاز ۲ ── */
    -- ورود به‌جای کاربر: support فقط فقط‌خواندنی می‌گیرد (در تابع اعمال می‌شود)
    when 'impersonate'          then v_role in ('super_admin', 'support')
    when 'announcements.manage' then v_role in ('super_admin')
    when 'tickets.reply'        then v_role in ('super_admin', 'support')
    else false
  end;
end;
$$;

grant execute on function public.platform_admin_can(text, uuid) to authenticated, service_role;


-- -------------------------------------------------------------
-- بخش ۱) جلسه‌های ورود به‌جای کاربر
--
-- 🔴 حساس‌ترین قابلیت کل پنل. الزاماتی که از بررسی الگوی رایج
--    SaaS و استانداردهای ممیزی گرفته شد:
--
--    • هر جلسه باید actor واقعی (ادمین) را ثبت کند، نه کاربر
--      جعل‌شده. وگرنه لاگ‌های داخل جلسه به نام مشتری ثبت می‌شوند
--      و ردپا گم می‌شود.
--    • رویداد شروع و پایان باید جفت باشند. جلسه‌ی بازِ رهاشده
--      نشانه‌ی مشکل است.
--    • دلیل اجباری است — بدون آن، دسترسی به داده‌ی مشتری
--      غیرقابل‌توجیه می‌شود.
--    • سقف زمانی سخت‌گیرانه. اینجا ۳۰ دقیقه.
-- -------------------------------------------------------------
create table if not exists public.impersonation_sessions (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid not null references auth.users(id) on delete cascade,
  target_user  uuid not null references auth.users(id) on delete cascade,
  org_id       uuid references public.organizations(id) on delete set null,
  reason       text not null,
  -- فقط‌خواندنی: نقش support اجازه‌ی تغییر داده ندارد
  read_only    boolean not null default true,
  started_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  ended_at     timestamptz,
  ended_reason text,
  ip           text
);

comment on table public.impersonation_sessions is
  'جلسه‌های ورود ادمین به‌جای کاربر. actor_id همیشه ادمین واقعی است.';

create index if not exists idx_imp_actor  on public.impersonation_sessions(actor_id);
create index if not exists idx_imp_target on public.impersonation_sessions(target_user);
create index if not exists idx_imp_active on public.impersonation_sessions(expires_at)
  where ended_at is null;

alter table public.impersonation_sessions enable row level security;

drop policy if exists p_imp_admin on public.impersonation_sessions;
create policy p_imp_admin on public.impersonation_sessions
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());


/**
 * شروع جلسه‌ی ورود به‌جای کاربر.
 *
 * چرا تابع و نه INSERT مستقیم؟ چون چهار قانون باید هم‌زمان اعمال
 * شوند و فراموش‌کردن هرکدام یک حفره‌ی امنیتی است.
 */
create or replace function public.start_impersonation(
  p_target uuid,
  p_reason text,
  p_actor  uuid default null,
  p_ip     text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := coalesce(p_actor, auth.uid());
  v_role  text := public.platform_admin_role(v_actor);
  v_org   uuid;
  v_id    uuid;
  v_email text;
begin
  /*
    🔴 بررسی صریح NULL — نه فقط not in.

    برای کاربر غیرادمین، platform_admin_role برابر NULL است و در SQL
    عبارت `NULL not in (...)` مقدار NULL می‌دهد نه TRUE، پس شرط if
    اجرا نمی‌شد و اجرا تا خود INSERT پیش می‌رفت.
    (بازتولیدشده: کاربر test از این گارد رد شد و فقط تصادفاً به‌خاطر
    NOT NULL بودن ستون read_only شکست خورد — یعنی گارد واقعی نبود.)
  */
  if v_role is null or v_role not in ('super_admin', 'support') then
    raise exception 'برای ورود به‌جای کاربر دسترسی ندارید';
  end if;

  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'ثبت دلیل الزامی است';
  end if;

  -- ادمین نمی‌تواند به‌جای ادمین دیگر وارد شود (زنجیره‌ی مسئولیت).
  if public.platform_admin_role(p_target) is not null then
    raise exception 'ورود به‌جای یک ادمین دیگر مجاز نیست';
  end if;

  select email into v_email from auth.users where id = p_target;
  if v_email is null then
    raise exception 'کاربر یافت نشد';
  end if;

  /*
    جلسه‌ی باز قبلی همین ادمین بسته می‌شود.
    بدون این، جلسه‌های رهاشده روی هم انباشته می‌شدند و «آیا الان
    جلسه‌ی فعالی هست؟» پاسخ روشنی نداشت.
  */
  update public.impersonation_sessions
  set ended_at = now(), ended_reason = 'جلسه‌ی جدید جایگزین شد'
  where actor_id = v_actor and ended_at is null;

  select m.org_id into v_org
  from public.memberships m
  where m.user_id = p_target and m.is_active
  order by m.created_at
  limit 1;

  insert into public.impersonation_sessions
    (actor_id, target_user, org_id, reason, read_only, expires_at, ip)
  values
    (v_actor, p_target, v_org, trim(p_reason),
     -- support فقط تماشا می‌کند
     v_role = 'support',
     now() + interval '30 minutes', p_ip)
  returning id into v_id;

  perform public.log_platform_action(
    'impersonation.started', v_actor, 'user', p_target::text, v_email,
    trim(p_reason),
    jsonb_build_object('session_id', v_id, 'read_only', v_role = 'support'),
    p_ip
  );

  return v_id;
end;
$$;


/** پایان جلسه. رویداد پایان همیشه جفت رویداد شروع ثبت می‌شود. */
create or replace function public.end_impersonation(
  p_session uuid default null,
  p_actor   uuid default null,
  p_reason  text default 'پایان دستی'
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := coalesce(p_actor, auth.uid());
  v_count int := 0;
  r record;
begin
  for r in
    select s.id, s.target_user, u.email
    from public.impersonation_sessions s
    join auth.users u on u.id = s.target_user
    where s.ended_at is null
      and s.actor_id = v_actor
      and (p_session is null or s.id = p_session)
  loop
    update public.impersonation_sessions
    set ended_at = now(), ended_reason = p_reason
    where id = r.id;

    perform public.log_platform_action(
      'impersonation.ended', v_actor, 'user', r.target_user::text, r.email,
      p_reason, jsonb_build_object('session_id', r.id), null
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;


/**
 * جلسه‌ی فعال ادمین جاری.
 *
 * انقضا اینجا هم بررسی می‌شود، نه فقط با یک کار زمان‌بندی‌شده:
 * اگر جلسه منقضی شده باشد هیچ ردیفی برنمی‌گردد، پس دسترسی خودبه‌خود
 * قطع می‌شود حتی اگر پاک‌سازی اجرا نشده باشد.
 */
create or replace function public.active_impersonation(p_actor uuid default null)
returns table (
  session_id  uuid,
  target_user uuid,
  target_email text,
  org_id      uuid,
  org_name    text,
  read_only   boolean,
  reason      text,
  started_at  timestamptz,
  expires_at  timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.target_user, u.email, s.org_id, o.name,
         s.read_only, s.reason, s.started_at, s.expires_at
  from public.impersonation_sessions s
  join auth.users u on u.id = s.target_user
  left join public.organizations o on o.id = s.org_id
  where s.actor_id = coalesce(p_actor, auth.uid())
    and s.ended_at is null
    and s.expires_at > now()
  order by s.started_at desc
  limit 1;
$$;

grant execute on function public.start_impersonation(uuid, text, uuid, text) to authenticated, service_role;
grant execute on function public.end_impersonation(uuid, uuid, text)          to authenticated, service_role;
grant execute on function public.active_impersonation(uuid)                   to authenticated, service_role;


-- -------------------------------------------------------------
-- بخش ۲) اعلان سراسری
--
-- برای اطلاع‌رسانی قطعی سرویس، تغییر قیمت، یا پیام به یک مشتری خاص.
-- -------------------------------------------------------------
create table if not exists public.platform_announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text,
  -- info | success | warning | danger — هم‌راستا با توکن‌های UI
  tone       text not null default 'info'
             check (tone in ('info', 'success', 'warning', 'danger')),
  -- null یعنی همه‌ی سازمان‌ها
  org_id     uuid references public.organizations(id) on delete cascade,
  is_active  boolean not null default true,
  starts_at  timestamptz not null default now(),
  ends_at    timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

comment on table public.platform_announcements is
  'اعلان‌های سطح پلتفرم. org_id تهی یعنی برای همه.';

create index if not exists idx_ann_active on public.platform_announcements(is_active, starts_at);

alter table public.platform_announcements enable row level security;

/*
  خواندن: هر کاربر واردشده، فقط اعلان‌های فعالِ در بازه‌ی زمانی و
  مربوط به سازمان خودش (یا سراسری).
*/
drop policy if exists p_ann_read on public.platform_announcements;
create policy p_ann_read on public.platform_announcements
  for select to authenticated
  using (
    is_active
    and starts_at <= now()
    and (ends_at is null or ends_at > now())
    and (org_id is null or org_id in (select public.user_org_ids()))
  );

drop policy if exists p_ann_admin on public.platform_announcements;
create policy p_ann_admin on public.platform_announcements
  for all to authenticated
  using (public.platform_admin_can('announcements.manage'))
  with check (public.platform_admin_can('announcements.manage'));


-- -------------------------------------------------------------
-- بخش ۳) تیکت پشتیبانی
-- -------------------------------------------------------------
create table if not exists public.support_tickets (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references public.organizations(id) on delete cascade,
  created_by  uuid not null references auth.users(id) on delete cascade,
  subject     text not null,
  status      text not null default 'open'
              check (status in ('open', 'pending', 'resolved', 'closed')),
  priority    text not null default 'normal'
              check (priority in ('low', 'normal', 'high')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.support_messages (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid not null references public.support_tickets(id) on delete cascade,
  author_id  uuid not null references auth.users(id) on delete cascade,
  -- آیا نویسنده از تیم پلتفرم است؟ برای رنگ‌بندی حباب پیام
  is_staff   boolean not null default false,
  body       text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ticket_org    on public.support_tickets(org_id, status);
create index if not exists idx_msg_ticket    on public.support_messages(ticket_id, created_at);

alter table public.support_tickets  enable row level security;
alter table public.support_messages enable row level security;

-- مشتری تیکت‌های سازمان خودش را می‌بیند؛ ادمین همه را.
drop policy if exists p_ticket_read on public.support_tickets;
create policy p_ticket_read on public.support_tickets
  for select to authenticated
  using (org_id in (select public.user_org_ids()) or public.is_platform_admin());

drop policy if exists p_ticket_write on public.support_tickets;
create policy p_ticket_write on public.support_tickets
  for insert to authenticated
  with check (org_id in (select public.user_org_ids()));

drop policy if exists p_ticket_admin on public.support_tickets;
create policy p_ticket_admin on public.support_tickets
  for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists p_msg_read on public.support_messages;
create policy p_msg_read on public.support_messages
  for select to authenticated
  using (
    exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id
        and (t.org_id in (select public.user_org_ids()) or public.is_platform_admin())
    )
  );

drop policy if exists p_msg_write on public.support_messages;
create policy p_msg_write on public.support_messages
  for insert to authenticated
  with check (
    exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id
        and (t.org_id in (select public.user_org_ids()) or public.is_platform_admin())
    )
  );


-- -------------------------------------------------------------
-- بخش ۴) نمای جستجوی کاربران برای پنل ادمین
--
-- خواسته‌ی صریح: «جستجوی کاربر با روش‌های مختلف».
-- ایمیل، نام، شماره تماس و نام کسب‌وکار در یک ستون قابل جستجو
-- جمع می‌شوند تا یک کوئری ساده همه را پوشش دهد.
-- -------------------------------------------------------------
drop view if exists public.v_admin_users;
/*
  🔴 چرا security_invoker نیست؟

  این نما به auth.users نیاز دارد و آن جدول به هیچ نقشی جز postgres
  دسترسی SELECT نمی‌دهد — حتی service_role.
  با security_invoker=true خطای «permission denied for table users»
  می‌گرفتیم (بازتولیدشده: HTTP 500، کد 42501).

  پس نما با حقوق سازنده اجرا می‌شود، و به‌جای اتکا به RLS، دسترسی را
  صریح کنترل می‌کنیم:
    • EXECUTE/SELECT از anon و authenticated گرفته می‌شود
    • فقط service_role می‌خواند، و روت API پیش از آن
      requirePlatformPermission('users.view') را چک می‌کند
*/
create view public.v_admin_users
as
select
  u.id                as user_id,
  u.email,
  u.created_at        as joined_at,
  u.last_sign_in_at,
  u.email_confirmed_at is not null as email_verified,
  o.id                as org_id,
  o.name              as org_name,
  o.approval_status,
  o.owner_full_name,
  o.owner_phone,
  o.business_type,
  o.trial_ends_at,
  m.role              as member_role,
  pa.role             as platform_role,
  -- ستون یکپارچه‌ی جستجو
  lower(concat_ws(' ',
    u.email, o.name, o.owner_full_name, o.owner_phone
  ))                  as search_blob
from auth.users u
left join public.memberships m
       on m.user_id = u.id and m.is_active
left join public.organizations o on o.id = m.org_id
left join public.platform_admins pa on pa.user_id = u.id;

comment on view public.v_admin_users is
  'نمای کاربران برای پنل ادمین. security_invoker=true یعنی RLS اعمال می‌شود.';

-- هیچ نقش عمومی‌ای نباید مستقیم بخواند؛ فقط مسیر کنترل‌شده‌ی API.
revoke all on public.v_admin_users from anon, authenticated;
grant select on public.v_admin_users to service_role;


-- -------------------------------------------------------------
-- بخش ۵) شاخص‌های داشبورد ادمین
-- -------------------------------------------------------------
create or replace function public.platform_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'orgs_total',      (select count(*) from public.organizations),
    'orgs_approved',   (select count(*) from public.organizations where approval_status = 'approved'),
    'orgs_pending',    (select count(*) from public.organizations where approval_status = 'pending'),
    'orgs_suspended',  (select count(*) from public.organizations where approval_status = 'suspended'),
    'trials_active',   (select count(*) from public.organizations
                         where trial_ends_at is not null and trial_ends_at > now()),
    'trials_expiring', (select count(*) from public.organizations
                         where trial_ends_at is not null
                           and trial_ends_at > now()
                           and trial_ends_at < now() + interval '3 days'),
    'users_total',     (select count(*) from auth.users),
    'signups_7d',      (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'active_7d',       (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
    'tickets_open',    (select count(*) from public.support_tickets where status in ('open','pending')),
    'sales_total',     (select count(*) from public.sales),
    'admin_actions_7d',(select count(*) from public.platform_audit_logs
                         where created_at > now() - interval '7 days')
  );
$$;

grant execute on function public.platform_stats() to authenticated, service_role;
