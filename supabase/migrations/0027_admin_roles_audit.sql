-- =============================================================
-- Tarazoo Migration 0027 — نقش‌های تفکیک‌شده‌ی ادمین + لاگ ممیزی پلتفرم
--
-- نوع: افزایشی. هیچ ستون/policy/داده‌ی موجودی حذف نمی‌شود.
--
-- دو کمبود که با بررسی واقعی پیدا شد:
--
--  ۱. جدول platform_admins ستون role دارد ('admin' | 'support') ولی
--     is_platform_admin() بین آن‌ها هیچ تفاوتی نمی‌گذاشت — یعنی
--     «پشتیبانی» دقیقاً همان اختیارات سوپرادمین را داشت.
--
--  ۲. هیچ عمل سطح-پلتفرمی لاگ نمی‌شد:
--       select count(*) from audit_logs
--        where entity_type in ('organization','platform')  →  0
--     یعنی تأیید/رد سازمان هیچ ردی از خود به‌جا نمی‌گذاشت: چه کسی،
--     کِی، چرا. برای پنلی که قرار است فاکتور مشتریان را هم اصلاح کند
--     این پذیرفتنی نیست.
--
-- EMERGENCY ROLLBACK: supabase/rollbacks/0027_admin_roles_audit.down.sql
-- =============================================================


-- -------------------------------------------------------------
-- بخش ۱) نقش‌های ادمین
--
-- چهار سطح، از بررسی الگوی رایج پنل‌های SaaS:
--   super_admin — همه‌چیز، از جمله مدیریت خود ادمین‌ها
--   support     — مشاهده + تمدید تست؛ بدون تغییر مالی و بدون حذف
--   finance     — اشتراک و پلن؛ بدون دسترسی به داده‌ی کسب‌وکار
--   readonly    — فقط مشاهده
--
-- ⚠️ مقدار قبلی 'admin' به 'super_admin' نگاشت می‌شود تا حساب فعلی
--    شما دسترسی‌اش را از دست ندهد. قید check قدیمی هم باید برداشته
--    شود وگرنه UPDATE رد می‌شود.
-- -------------------------------------------------------------
alter table public.platform_admins
  drop constraint if exists platform_admins_role_check;

update public.platform_admins set role = 'super_admin' where role = 'admin';

alter table public.platform_admins
  add constraint platform_admins_role_check
  check (role in ('super_admin', 'support', 'finance', 'readonly'));

comment on column public.platform_admins.role is
  'سطح دسترسی ادمین پلتفرم: super_admin | support | finance | readonly';


-- -------------------------------------------------------------
-- بخش ۲) توابع بررسی سطح دسترسی
--
-- is_platform_admin() دست‌نخورده می‌ماند (هر چهار نقش true) تا
-- گاردهای موجود نشکنند؛ توابع ریزدانه کنارش اضافه می‌شوند.
-- -------------------------------------------------------------

/** نقش ادمینِ کاربر، یا null اگر ادمین نباشد. */
create or replace function public.platform_admin_role(p_user uuid default null)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.platform_admins
  where user_id = coalesce(p_user, auth.uid());
$$;

/**
 * آیا این کاربر مجوز مشخصی دارد؟
 *
 * ماتریس دسترسی در یک جا متمرکز است تا هر روت API همان قاعده را
 * ببیند و تفسیرهای متفاوت پیش نیاید.
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
  v_role text := public.platform_admin_role(coalesce(p_user, auth.uid()));
begin
  if v_role is null then
    return false;
  end if;

  return case p_permission
    -- مشاهده: همه‌ی نقش‌ها
    when 'orgs.view'        then true
    when 'audit.view'       then true
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
    else false
  end;
end;
$$;

comment on function public.platform_admin_can(text, uuid) is
  'ماتریس مجوز ادمین پلتفرم — تک‌منبع حقیقت برای همه‌ی روت‌های /api/admin.';

grant execute on function public.platform_admin_role(uuid) to authenticated, service_role;
grant execute on function public.platform_admin_can(text, uuid) to authenticated, service_role;


-- -------------------------------------------------------------
-- بخش ۳) لاگ ممیزی سطح پلتفرم
--
-- چرا جدول جدا و نه audit_logs موجود؟
--   audit_logs برای رویدادهای *داخل* یک سازمان است و ستون‌هایش
--   (entity_type/entity_id) با نیاز اینجا هم‌خوان نیست: باید بدانیم
--   کدام ادمین، روی کدام سازمان، با چه دلیلی، از چه IP.
--   قاطی‌کردنشان یعنی هر دو گزارش خراب می‌شود.
--
-- append-only است: نه UPDATE، نه DELETE. لاگی که بشود پاکش کرد
-- ارزش ممیزی ندارد.
-- -------------------------------------------------------------
create table if not exists public.platform_audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth.users(id),
  actor_role  text,
  action      text not null,
  target_type text,
  target_id   text,
  target_name text,
  reason      text,
  meta        jsonb not null default '{}'::jsonb,
  ip          text,
  created_at  timestamptz not null default now()
);

comment on table public.platform_audit_logs is
  'لاگ عملیات سوپرادمین. فقط ستون ip پس از درج پر می‌شود؛ بقیه تغییرناپذیرند.';

/*
  تریگر تغییرناپذیری.

  رکورد ممیزی نباید بعد از ثبت دستکاری شود. تنها استثنا ستون ip
  است: RPCها داخل دیتابیس اجرا می‌شوند و به هدر HTTP دسترسی ندارند،
  پس روت API بلافاصله پس از عمل، IP را روی همان رکورد می‌نویسد.
  (رکورد دوم ساختن، گزارش را با رویداد تکراری خراب می‌کرد.)
*/
create or replace function public.guard_audit_immutable()
returns trigger
language plpgsql
as $$
begin
  if (new.id, new.actor_id, new.action, new.target_id, new.reason, new.created_at)
     is distinct from
     (old.id, old.actor_id, old.action, old.target_id, old.reason, old.created_at)
  then
    raise exception 'رکورد ممیزی تغییرناپذیر است؛ فقط ip قابل تکمیل است';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_audit_immutable on public.platform_audit_logs;
create trigger trg_audit_immutable
  before update on public.platform_audit_logs
  for each row execute function public.guard_audit_immutable();
comment on column public.platform_audit_logs.actor_id is
  'ادمینی که عمل را انجام داد — نه کاربری که تحت تأثیر قرار گرفت.';

create index if not exists idx_pal_created  on public.platform_audit_logs(created_at desc);
create index if not exists idx_pal_actor    on public.platform_audit_logs(actor_id);
create index if not exists idx_pal_target   on public.platform_audit_logs(target_type, target_id);
create index if not exists idx_pal_action   on public.platform_audit_logs(action);

alter table public.platform_audit_logs enable row level security;

-- فقط ادمین‌ها می‌خوانند. نوشتن از سرور با service_role انجام می‌شود.
drop policy if exists p_pal_admin_read on public.platform_audit_logs;
create policy p_pal_admin_read on public.platform_audit_logs
  for select to authenticated
  using (public.is_platform_admin());

/**
 * ثبت یک رویداد ممیزی.
 *
 * security definer است تا حتی وقتی از سمت سرور با service_role
 * فراخوانی می‌شود (که auth.uid() تهی است) actor صریح ثبت شود.
 */
create or replace function public.log_platform_action(
  p_action      text,
  p_actor       uuid default null,
  p_target_type text default null,
  p_target_id   text default null,
  p_target_name text default null,
  p_reason      text default null,
  p_meta        jsonb default '{}'::jsonb,
  p_ip          text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := coalesce(p_actor, auth.uid());
  v_id    uuid;
begin
  insert into public.platform_audit_logs
    (actor_id, actor_role, action, target_type, target_id, target_name, reason, meta, ip)
  values
    (v_actor,
     public.platform_admin_role(v_actor),
     p_action,
     p_target_type,
     p_target_id,
     p_target_name,
     nullif(trim(coalesce(p_reason, '')), ''),
     coalesce(p_meta, '{}'::jsonb),
     p_ip)
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.log_platform_action(text, uuid, text, text, text, text, jsonb, text)
  to service_role;

/*
  نمای خوانا با ایمیل ادمین.

  🔴 security_invoker عمداً *خاموش* است (پیش‌فرض definer).

  با invoker، نما با مجوز فراخوان اجرا می‌شود و service_role حق
  خواندن auth.users را ندارد:
    ERROR 42501: permission denied for table users
  این خطا فقط در تست واقعی از سمت روت API دیده شد؛ اجرای همان
  کوئری در SQL Editor (با نقش postgres) بی‌مشکل بود.

  امنیت حفظ می‌شود چون:
    • جدول پایه platform_audit_logs خودش RLS دارد و policy آن
      is_platform_admin() را چک می‌کند
    • دسترسی anon صریح گرفته شده
    • روت API پیش از هر کوئری requirePlatformPermission می‌زند
*/
create or replace view public.v_platform_audit as
select
  l.id,
  l.created_at,
  l.action,
  l.actor_id,
  l.actor_role,
  u.email as actor_email,
  l.target_type,
  l.target_id,
  l.target_name,
  l.reason,
  l.meta,
  l.ip
from public.platform_audit_logs l
left join auth.users u on u.id = l.actor_id;

revoke all on public.v_platform_audit from anon, authenticated;
grant select on public.v_platform_audit to service_role;


-- -------------------------------------------------------------
-- بخش ۴) RPCهای موجود، حالا با ثبت لاگ و بررسی نقش
--
-- approve/reject از 0022 بازنویسی می‌شوند تا:
--   • مجوز ریزدانه بررسی شود (نه فقط «ادمین هست یا نه»)
--   • هر عمل در لاگ بیفتد
-- امضا حفظ شده تا کد فعلی نشکند؛ فقط p_reason به approve اضافه شد.
-- -------------------------------------------------------------
create or replace function public.approve_organization(p_org uuid, p_actor uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := coalesce(p_actor, auth.uid());
  v_name  text;
  v_prev  text;
begin
  if v_actor is null or not public.platform_admin_can('orgs.approve', v_actor) then
    raise exception 'دسترسی تأیید کسب‌وکار وجود ندارد';
  end if;

  select name, approval_status into v_name, v_prev
  from public.organizations where id = p_org;
  if v_name is null then
    raise exception 'سازمان یافت نشد';
  end if;

  update public.organizations
  set approval_status = 'approved',
      approved_at     = now(),
      approved_by     = v_actor,
      rejection_note  = null
  where id = p_org;

  perform public.log_platform_action(
    'org.approve', v_actor, 'organization', p_org::text, v_name, null,
    jsonb_build_object('from', v_prev, 'to', 'approved')
  );
end;
$$;

create or replace function public.reject_organization(
  p_org uuid,
  p_reason text default null,
  p_actor uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := coalesce(p_actor, auth.uid());
  v_name  text;
  v_prev  text;
begin
  if v_actor is null or not public.platform_admin_can('orgs.approve', v_actor) then
    raise exception 'دسترسی رد کسب‌وکار وجود ندارد';
  end if;

  select name, approval_status into v_name, v_prev
  from public.organizations where id = p_org;
  if v_name is null then
    raise exception 'سازمان یافت نشد';
  end if;

  update public.organizations
  set approval_status = 'rejected',
      rejection_note  = p_reason,
      approved_at     = null,
      approved_by     = v_actor
  where id = p_org;

  perform public.log_platform_action(
    'org.reject', v_actor, 'organization', p_org::text, v_name, p_reason,
    jsonb_build_object('from', v_prev, 'to', 'rejected')
  );
end;
$$;

-- تمدید تست هم لاگ می‌شود
create or replace function public.extend_trial(
  p_org   uuid,
  p_days  int,
  p_actor uuid default null
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := coalesce(p_actor, auth.uid());
  v_new   timestamptz;
  v_name  text;
begin
  if v_actor is null or not public.platform_admin_can('trial.extend', v_actor) then
    raise exception 'دسترسی تمدید دوره آزمایشی وجود ندارد';
  end if;

  if p_days is null or p_days < 1 or p_days > 365 then
    raise exception 'تعداد روز باید بین ۱ تا ۳۶۵ باشد';
  end if;

  update public.organizations
  set trial_ends_at = greatest(coalesce(trial_ends_at, now()), now())
                      + (p_days || ' days')::interval
  where id = p_org
  returning trial_ends_at, name into v_new, v_name;

  if v_new is null then
    raise exception 'سازمان یافت نشد';
  end if;

  update public.subscriptions
  set expires_at = v_new, status = 'trial'
  where org_id = p_org and status in ('trial', 'expired');

  perform public.log_platform_action(
    'trial.extend', v_actor, 'organization', p_org::text, v_name, null,
    jsonb_build_object('days', p_days, 'new_expiry', v_new)
  );

  return v_new;
end;
$$;


-- -------------------------------------------------------------
-- بخش ۵) تعلیق و رفع تعلیق
--
-- تا امروز تنها راه تعلیق، UPDATE دستی روی جدول بود.
-- -------------------------------------------------------------
create or replace function public.set_organization_status(
  p_org    uuid,
  p_status text,
  p_reason text default null,
  p_actor  uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := coalesce(p_actor, auth.uid());
  v_name  text;
  v_prev  text;
begin
  if p_status not in ('approved', 'suspended') then
    raise exception 'وضعیت نامعتبر: %', p_status;
  end if;
  if v_actor is null or not public.platform_admin_can('orgs.suspend', v_actor) then
    raise exception 'دسترسی تعلیق کسب‌وکار وجود ندارد';
  end if;

  select name, approval_status into v_name, v_prev
  from public.organizations where id = p_org;
  if v_name is null then
    raise exception 'سازمان یافت نشد';
  end if;

  update public.organizations
  set approval_status = p_status,
      rejection_note  = case when p_status = 'suspended' then p_reason else null end
  where id = p_org;

  perform public.log_platform_action(
    case when p_status = 'suspended' then 'org.suspend' else 'org.reactivate' end,
    v_actor, 'organization', p_org::text, v_name, p_reason,
    jsonb_build_object('from', v_prev, 'to', p_status)
  );
end;
$$;

grant execute on function public.set_organization_status(uuid, text, text, uuid)
  to authenticated, service_role;


-- -------------------------------------------------------------
-- بخش ۶) نمای تک‌سازمان برای صفحه‌ی جزئیات
-- -------------------------------------------------------------
create or replace view public.v_admin_org_detail
with (security_invoker = true)
as
select
  o.id,
  o.name,
  o.approval_status,
  o.is_demo,
  o.is_active,
  o.created_at,
  o.approved_at,
  o.rejection_note,
  o.owner_id,
  o.business_type,
  o.owner_full_name,
  o.owner_phone,
  o.trial_ends_at,
  o.onboarded_at,
  case
    when o.trial_ends_at is null then null
    else ceil(extract(epoch from (o.trial_ends_at - now())) / 86400.0)::int
  end                                                                        as trial_days_left,
  (select count(*) from public.memberships m where m.org_id = o.id and m.is_active) as members_count,
  (select count(*) from public.sales s      where s.org_id = o.id)           as sales_count,
  (select count(*) from public.products p   where p.org_id = o.id)           as products_count,
  (select count(*) from public.contacts c   where c.org_id = o.id)           as contacts_count,
  -- ستون درست `total` است نه total_amount؛ و فاکتور باطل‌شده نباید
  -- در جمع فروش بیاید وگرنه رقم گمراه‌کننده می‌شود.
  (select coalesce(sum(s.total), 0) from public.sales s
     where s.org_id = o.id and s.cancelled_at is null)                       as sales_total,
  (select max(s.created_at) from public.sales s where s.org_id = o.id)       as last_sale_at,
  (select p.name from public.subscriptions sub
     join public.plans p on p.id = sub.plan_id
    where sub.org_id = o.id order by sub.created_at desc limit 1)            as current_plan,
  (select sub.status from public.subscriptions sub
    where sub.org_id = o.id order by sub.created_at desc limit 1)            as subscription_status
from public.organizations o;

comment on view public.v_admin_org_detail is
  'نمای کامل یک سازمان برای صفحه‌ی جزئیات پنل ادمین.';

revoke all on public.v_admin_org_detail from anon;
