-- =============================================================
-- Hesabyar Migration 0021 — پنل سوپرادمین، تأیید کسب‌وکار، پلن‌ها، دمو
--
-- نوع: افزایشی و غیرمخرب. هیچ ستون/policy موجودی حذف نمی‌شود.
--
-- ⚠️ نکته‌ی مهم درباره‌ی «تأیید اجباری»:
--    طبق تصمیم شما، کسب‌وکار جدید تا تأیید نباید وارد شود.
--    اما سازمان‌های *موجود* نباید قفل شوند. برای همین:
--      • پیش‌فرض ستون = 'approved'  → همه‌ی ردیف‌های فعلی approved می‌مانند
--      • تابع bootstrap_org برای ثبت‌نام‌های *جدید* مقدار 'pending' درج می‌کند
--    یعنی سختگیری فقط از این به بعد اعمال می‌شود.
--
-- EMERGENCY ROLLBACK: supabase/rollbacks/0021_platform_admin.down.sql
-- =============================================================

-- -------------------------------------------------------------
-- بخش ۱) نقش سطح پلتفرم
-- سوپرادمین به هیچ سازمانی تعلق ندارد، پس جدول جداست و با
-- memberships قاطی نمی‌شود (که مدل RLS فعلی را خراب می‌کرد).
-- -------------------------------------------------------------
create table if not exists public.platform_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'admin' check (role in ('admin','support')),
  note       text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

comment on table public.platform_admins is
  'ادمین‌های سطح پلتفرم (فرا-سازمانی). عضویت اینجا یعنی دسترسی به /admin.';

-- تابع کمکی: آیا کاربر جاری سوپرادمین است؟
-- security definer لازم است چون خود جدول RLS دارد.
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins where user_id = auth.uid()
  );
$$;

comment on function public.is_platform_admin() is
  'true اگر کاربر جاری در platform_admins باشد. مبنای همه‌ی policyهای سوپرادمین.';

-- -------------------------------------------------------------
-- بخش ۲) چرخه‌ی تأیید سازمان
-- is_active موجود معنای «حذف نرم» دارد و دست نمی‌خورد؛
-- وضعیت تأیید یک محور مستقل است.
-- -------------------------------------------------------------
alter table public.organizations
  add column if not exists approval_status text not null default 'approved'
    check (approval_status in ('pending','approved','rejected','suspended')),
  add column if not exists approved_at    timestamptz,
  add column if not exists approved_by    uuid references auth.users(id),
  add column if not exists rejection_note text,
  add column if not exists is_demo        boolean not null default false;

comment on column public.organizations.approval_status is
  'pending=منتظر تأیید ادمین · approved=فعال · rejected=رد شده · suspended=معلق';
comment on column public.organizations.is_demo is
  'سازمان نمایشی؛ فقط برای دمو به مشتری. عملیات مخرب باید در UI مسدود شود.';

create index if not exists idx_org_approval_status
  on public.organizations(approval_status);

-- -------------------------------------------------------------
-- بخش ۳) پلن‌ها و اشتراک
-- قیمت‌ها bigint ریال، هم‌راستا با قرارداد موجود پروژه.
-- -------------------------------------------------------------
create table if not exists public.plans (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  name         text not null,
  price_rial   bigint not null default 0,
  period_days  int,
  max_invoices int,
  max_products int,
  description  text,
  features     jsonb not null default '[]'::jsonb,
  is_featured  boolean not null default false,
  is_active    boolean not null default true,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

comment on table public.plans is
  'پلن‌های اشتراک. price_rial به ریال است (نمایش تومان در UI).';
comment on column public.plans.max_invoices is
  'سقف فاکتور در دوره. null یعنی نامحدود. فعلاً فقط نمایشی — اعمال نمی‌شود.';

create table if not exists public.subscriptions (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  plan_id    uuid not null references public.plans(id),
  status     text not null default 'trial'
             check (status in ('trial','active','expired','cancelled')),
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  note       text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists idx_subscriptions_org    on public.subscriptions(org_id);
create index if not exists idx_subscriptions_status on public.subscriptions(status);

comment on table public.subscriptions is
  'اشتراک فعال هر سازمان. فعلاً دستی مدیریت می‌شود؛ درگاه پرداخت وصل نیست.';

-- -------------------------------------------------------------
-- بخش ۴) داده‌ی اولیه — همان چهار پلن لندینگ
-- تا داده‌ی hardcode شده در MarketingPieces.tsx جایگزین شود.
-- -------------------------------------------------------------
insert into public.plans (code, name, price_rial, period_days, max_invoices, max_products, description, features, is_featured, sort_order)
values
  ('free', 'پایه', 0, null, 100, 50,
   'مناسب برای فریلنسرها و کسب‌وکارهای کوچک.',
   '["۱۰۰ فاکتور ماهانه","پشتیبانی معمولی","گزارش‌های پایه فروش"]'::jsonb, false, 1),
  ('monthly', 'یک ماهه', 1490000, 30, null, 100,
   'شروع حرفه‌ای برای فروشگاه‌های کوچک.',
   '["صدور فاکتور نامحدود","مدیریت ۱۰۰ محصول","گزارش‌های پایه فروش"]'::jsonb, false, 2),
  ('biannual', 'شش ماهه', 7490000, 180, null, null,
   'بهترین گزینه برای شرکت‌های در حال رشد.',
   '["محصولات نامحدود","مدیریت کامل انبارداری","پنل پیامکی رایگان","۱۵٪ تخفیف اقتصادی"]'::jsonb, true, 3),
  ('enterprise', 'سازمانی', 0, null, null, null,
   'راه‌کار اختصاصی برای هولدینگ‌ها.',
   '["نصب روی سرور اختصاصی","پشتیبانی VIP","ماژول وفاداری مشتریان"]'::jsonb, false, 4)
on conflict (code) do nothing;

-- -------------------------------------------------------------
-- بخش ۵) اولین سوپرادمین
-- bahram@hesabyar.app — قدیمی‌ترین حساب و مالک سازمان «مزون پوشاک».
-- با ایمیل درج می‌شود تا وابسته به uuid ثابت نباشد.
-- اگر حساب پیدا نشود migration بی‌صدا رد می‌شود (خطا نمی‌دهد).
-- -------------------------------------------------------------
insert into public.platform_admins (user_id, role, note)
select id, 'admin', 'اولین سوپرادمین — درج‌شده در migration 0021'
from auth.users
where email = 'bahram@hesabyar.app'
on conflict (user_id) do nothing;

-- -------------------------------------------------------------
-- بخش ۶) RLS
-- ⚠️ policyهای موجود organizations حذف نمی‌شوند؛ فقط یک policy
-- اضافه برای سوپرادمین گذاشته می‌شود. PostgreSQL چند policy را
-- با OR ترکیب می‌کند، پس دسترسی فعلی اپ قطع نمی‌شود.
-- -------------------------------------------------------------
alter table public.platform_admins enable row level security;
alter table public.plans           enable row level security;
alter table public.subscriptions   enable row level security;

-- پلن‌ها: خواندن برای همه (لندینگ عمومی باید ببیند)
drop policy if exists p_plans_public_read on public.plans;
create policy p_plans_public_read on public.plans
  for select using (true);

-- پلن‌ها: نوشتن فقط سوپرادمین
drop policy if exists p_plans_admin_write on public.plans;
create policy p_plans_admin_write on public.plans
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- اشتراک: سازمان خودش را می‌بیند، سوپرادمین همه را
drop policy if exists p_subs_read on public.subscriptions;
create policy p_subs_read on public.subscriptions
  for select to authenticated
  using (org_id in (select public.user_org_ids()) or public.is_platform_admin());

drop policy if exists p_subs_admin_write on public.subscriptions;
create policy p_subs_admin_write on public.subscriptions
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- جدول ادمین‌ها: فقط خود ادمین‌ها
drop policy if exists p_platform_admins_all on public.platform_admins;
create policy p_platform_admins_all on public.platform_admins
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- سازمان‌ها: policy اضافه (نه جایگزین) تا سوپرادمین همه را ببیند
drop policy if exists p_org_platform_admin on public.organizations;
create policy p_org_platform_admin on public.organizations
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- -------------------------------------------------------------
-- بخش ۷) ثبت‌نام جدید → در انتظار تأیید
-- فقط ردیف‌های تازه؛ سازمان‌های موجود دست‌نخورده می‌مانند.
-- -------------------------------------------------------------
create or replace function public.bootstrap_org(p_org_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_branch uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'کاربر وارد نشده است';
  end if;

  -- سازمان جدید در حالت «منتظر تأیید» ساخته می‌شود.
  insert into public.organizations(name, owner_id, created_by, approval_status)
  values (p_org_name, v_uid, v_uid, 'pending')
  returning id into v_org;

  insert into public.branches(org_id, name, created_by)
  values (v_org, 'شعبه اصلی', v_uid)
  returning id into v_branch;

  insert into public.memberships(org_id, branch_id, user_id, role, created_by)
  values (v_org, v_branch, v_uid, 'owner', v_uid);

  insert into public.accounts(org_id, branch_id, name, type, created_by)
  values
    (v_org, v_branch, 'صندوق', 'cash', v_uid),
    (v_org, v_branch, 'حساب بانکی', 'bank', v_uid);

  -- اشتراک پیش‌فرض روی پلن رایگان
  insert into public.subscriptions(org_id, plan_id, status, created_by)
  select v_org, p.id, 'trial', v_uid
  from public.plans p where p.code = 'free'
  on conflict do nothing;

  return v_org;
end;
$$;

-- -------------------------------------------------------------
-- بخش ۸) RPCهای مدیریتی — تأیید و رد
-- -------------------------------------------------------------
create or replace function public.approve_organization(p_org uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'دسترسی مدیریت پلتفرم وجود ندارد';
  end if;

  update public.organizations
  set approval_status = 'approved',
      approved_at     = now(),
      approved_by     = auth.uid(),
      rejection_note  = null
  where id = p_org;
end;
$$;

create or replace function public.reject_organization(p_org uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'دسترسی مدیریت پلتفرم وجود ندارد';
  end if;

  update public.organizations
  set approval_status = 'rejected',
      rejection_note  = p_reason,
      approved_at     = null,
      approved_by     = auth.uid()
  where id = p_org;
end;
$$;

grant execute on function public.is_platform_admin()                to authenticated, service_role;
grant execute on function public.approve_organization(uuid)         to authenticated, service_role;
grant execute on function public.reject_organization(uuid, text)    to authenticated, service_role;

-- -------------------------------------------------------------
-- بخش ۹) نمای کمکی برای پنل ادمین
-- -------------------------------------------------------------
drop view if exists public.v_admin_organizations;
create or replace view public.v_admin_organizations
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
  o.approved_by,
  o.rejection_note,
  o.owner_id,
  (select count(*) from public.memberships m where m.org_id = o.id and m.is_active) as members_count,
  (select count(*) from public.sales s where s.org_id = o.id)                       as sales_count,
  (select p.name from public.subscriptions sub
     join public.plans p on p.id = sub.plan_id
    where sub.org_id = o.id order by sub.created_at desc limit 1)                   as current_plan
from public.organizations o;

comment on view public.v_admin_organizations is
  'خلاصه سازمان‌ها برای پنل ادمین. security_invoker=true یعنی RLS اعمال می‌شود.';
