-- 0033 — نقش سفارشی برای ادمین‌های پلتفرم
--
-- مسئله:
--   چهار نقش ثابت (super_admin / support / finance / readonly) در خودِ
--   تابع platform_admin_can هاردکد شده‌اند. برای دادن یک مجوز اضافه به
--   یک نفر، راهی جز ارتقای او به super_admin وجود ندارد — یعنی دادن
--   *همه‌ی* اختیارات. این دقیقاً نقض اصل کمترین امتیاز است.
--
-- طراحی:
--   ۱. جدول `platform_permissions` — فهرست مجوزها با برچسب فارسی و
--      سطح خطر. تک‌منبع حقیقت برای UI و اعتبارسنجی.
--   ۲. ستون `custom_permissions` روی platform_admins — آرایه‌ی مجوز.
--   ۳. تابع بازنویسی می‌شود: اگر نقش سفارشی باشد از آرایه می‌خواند،
--      وگرنه همان ماتریس ثابت قبلی.
--
-- 🔴 قید اصلی: نقش‌های موجود نباید رفتارشان عوض شود.
--   تنها ادمین فعلی super_admin است و باید بعد از این مهاجرت دقیقاً
--   همان دسترسی‌ها را داشته باشد. ماتریس ثابت کاملاً حفظ شده و شاخه‌ی
--   custom فقط *اضافه* شده است.

/* ------------------------------------------------------------------ */
/* ۱. فهرست مجوزها                                                     */
/* ------------------------------------------------------------------ */

create table if not exists public.platform_permissions (
  key         text primary key,
  label       text not null,
  description text,
  /* گروه‌بندی برای نمایش در UI */
  category    text not null,
  /*
    سطح خطر:
      low    — فقط خواندن
      medium — تغییر وضعیت، برگشت‌پذیر
      high   — دسترسی به داده‌ی مشتری یا تصاحب حساب
  */
  risk        text not null default 'low'
              check (risk in ('low', 'medium', 'high')),
  sort_order  int not null default 100
);

comment on table public.platform_permissions is
  'فهرست مجوزهای پلتفرم — تک‌منبع حقیقت برای UI و اعتبارسنجی نقش سفارشی.';

/*
  ⚠️ این فهرست باید با مجوزهایی که روت‌ها واقعاً می‌خواهند یکی بماند.
  یک تست خودکار همه‌ی روت‌های /api/admin را می‌گردد و بررسی می‌کند هر
  مجوز اینجا تعریف شده باشد — همان درسی که در مهاجرت ۰۰۳۱ گرفتیم، جایی
  که سه مجوز تعریف‌نشده باعث ۴۰۳ روی سایت زنده شده بودند.
*/
insert into public.platform_permissions (key, label, description, category, risk, sort_order) values
  ('orgs.view',            'مشاهده کسب‌وکارها',      'دیدن فهرست و جزئیات کسب‌وکارها',                'کسب‌وکارها', 'low',    10),
  ('orgs.approve',         'تأیید و رد کسب‌وکار',     'تأیید ثبت‌نام یا رد آن',                        'کسب‌وکارها', 'medium', 20),
  ('orgs.suspend',         'تعلیق کسب‌وکار',          'معلق کردن یا فعال‌سازی مجدد یک کسب‌وکار',        'کسب‌وکارها', 'medium', 30),
  ('trial.extend',         'تمدید دوره آزمایشی',      'افزودن روز به دوره آزمایشی',                     'اشتراک',     'medium', 40),
  ('plan.change',          'تغییر پلن اشتراک',        'ارتقا یا تنزل پلن یک کسب‌وکار',                  'اشتراک',     'medium', 50),
  ('users.view',           'مشاهده کاربران',          'جستجو و دیدن فهرست کاربران پلتفرم',              'کاربران',    'low',    60),
  ('users.password',       'بازنشانی رمز کاربر',      'تعیین رمز جدید برای یک کاربر — معادل تصاحب حساب', 'کاربران',   'high',   70),
  ('impersonate',          'ورود به حساب کاربر',      'دیدن پنل از چشم کاربر؛ محدود به ۳۰ دقیقه و لاگ‌شده', 'کاربران', 'high',  80),
  ('invoice.view',         'مشاهده فاکتور مشتری',     'دیدن داده‌ی کسب‌وکار مشتری',                     'داده مشتری', 'high',   90),
  ('invoice.modify',       'ویرایش فاکتور مشتری',     'تغییر داده‌ی کسب‌وکار مشتری',                    'داده مشتری', 'high',  100),
  ('audit.view',           'مشاهده گزارش ممیزی',      'دیدن تاریخچه عملیات ادمین‌ها',                   'نظارت',      'low',   110),
  ('announcements.manage', 'مدیریت اعلان‌ها',         'انتشار پیام سراسری برای همه کاربران',            'نظارت',      'medium', 120),
  ('admins.manage',        'مدیریت ادمین‌ها',         'افزودن، حذف و تغییر نقش ادمین‌های پلتفرم',       'نظارت',      'high',  130)
on conflict (key) do update
  set label = excluded.label,
      description = excluded.description,
      category = excluded.category,
      risk = excluded.risk,
      sort_order = excluded.sort_order;

alter table public.platform_permissions enable row level security;

/*
  خواندن این جدول حساس نیست — فقط نام مجوزهاست، نه اینکه چه کسی آن‌ها
  را دارد. ولی محض احتیاط فقط به ادمین‌های پلتفرم داده می‌شود.
*/
drop policy if exists platform_permissions_read on public.platform_permissions;
create policy platform_permissions_read on public.platform_permissions
  for select to authenticated
  using (exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid()));

grant select on public.platform_permissions to authenticated, service_role;

/* ------------------------------------------------------------------ */
/* ۲. ستون مجوزهای سفارشی                                              */
/* ------------------------------------------------------------------ */

alter table public.platform_admins
  add column if not exists custom_permissions text[] not null default '{}';

comment on column public.platform_admins.custom_permissions is
  'فقط وقتی role = ''custom'' معنا دارد. آرایه‌ی کلیدهای platform_permissions.';

/*
  نقش 'custom' به قید موجود اضافه می‌شود.

  ⚠️ قید قبلی drop و دوباره ساخته می‌شود، نه اینکه قید دومی اضافه شود —
  دو قید هم‌زمان یعنی هیچ نقشی هر دو را راضی نمی‌کند.
*/
alter table public.platform_admins drop constraint if exists platform_admins_role_check;
alter table public.platform_admins add constraint platform_admins_role_check
  check (role in ('super_admin', 'support', 'finance', 'readonly', 'custom'));

/**
 * اعتبارسنجی: کلیدهای سفارشی باید واقعاً وجود داشته باشند.
 *
 * 🔴 بدون این، یک غلط املایی در UI («users.veiw») بی‌صدا ذخیره می‌شد و
 * ادمین بدون هیچ پیام خطایی دسترسی نمی‌گرفت — همان دسته باگی که در
 * مهاجرت ۰۰۳۱ سه روت را از کار انداخته بود.
 */
create or replace function public.validate_custom_permissions()
returns trigger
language plpgsql
as $$
declare
  v_bad text;
begin
  if new.role <> 'custom' then
    -- نقش غیرسفارشی نباید آرایه‌ی سرگردان داشته باشد.
    new.custom_permissions := '{}';
    return new;
  end if;

  select string_agg(p, ', ') into v_bad
  from unnest(new.custom_permissions) p
  where p not in (select key from public.platform_permissions);

  if v_bad is not null then
    raise exception 'مجوز نامعتبر: %', v_bad;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_custom_permissions on public.platform_admins;
create trigger trg_validate_custom_permissions
  before insert or update on public.platform_admins
  for each row execute function public.validate_custom_permissions();

/* ------------------------------------------------------------------ */
/* ۳. بازنویسی ماتریس مجوز                                             */
/* ------------------------------------------------------------------ */

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

  -- ماتریس ثابت — دست‌نخورده از مهاجرت ۰۰۳۱
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
    else false
  end;
end;
$$;

comment on function public.platform_admin_can(text, uuid) is
  'ماتریس مجوز ادمین پلتفرم. نقش custom از custom_permissions می‌خواند، بقیه از ماتریس ثابت.';

grant execute on function public.platform_admin_can(text, uuid) to authenticated, service_role;

/**
 * مجوزهای مؤثر یک ادمین — برای نمایش در UI.
 *
 * چرا تابع جدا و نه محاسبه در کلاینت؟ منطق «نقش ثابت در برابر سفارشی»
 * نباید دو جا نوشته شود؛ اختلافشان یعنی UI چیزی نشان دهد که سرور
 * قبول ندارد.
 */
create or replace function public.platform_admin_permissions(p_user uuid default null)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    array_agg(pp.key order by pp.sort_order)
      filter (where public.platform_admin_can(pp.key, coalesce(p_user, auth.uid()))),
    '{}'
  )
  from public.platform_permissions pp;
$$;

grant execute on function public.platform_admin_permissions(uuid) to authenticated, service_role;
