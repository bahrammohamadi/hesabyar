-- 0051 — کدهای پشتیبان دومرحله‌ای، ترجیحات سازمان، و فهرست‌های قابل‌مدیریت
--
-- سه کار مرتبط در یک مهاجرت چون هر سه به `settings` و الگوی یکسان
-- تکیه می‌کنند.
--
-- =============================================================
-- ۱) کدهای پشتیبان ورود دومرحله‌ای
-- =============================================================
--
-- 🔴 شکافی که می‌بندد: پس از فعال‌سازی TOTP، گم‌شدن گوشی یعنی قفل
--   شدن کامل حساب. کد بازیابی رمزِ مدیر هم کمکی نمی‌کند چون
--   دومرحله‌ای را غیرفعال نمی‌کند.
--
-- استاندارد NIST SP 800-63B بخش ۴.۲.۱.۱ (Saved Recovery Codes):
--   • SHALL به‌صورت هش‌شده با تابع یک‌طرفه‌ی تأییدشده ذخیره شوند
--   • SHALL فقط یک بار قابل استفاده باشند
--   • SHALL مشمول محدودیت نرخ (throttling) باشند
--
-- ⚠️ همان‌جا می‌گوید کدهای با آنتروپی کمتر از ۱۱۲ بیت باید
--   **نمک‌دار** و با تابع مشتق‌سازی کلید هش شوند. کد ۱۰ نویسه‌ای
--   Base32 حدود ۵۰ بیت است، پس نمک الزامی است — اینجا با فلفل
--   سراسری به‌علاوه‌ی شناسه‌ی کاربر تأمین می‌شود.
create table if not exists public.mfa_backup_codes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  /*
    🔴 هش، نه کد خام. کد خام یعنی نشت پشتیبان = دور زدن کامل
    دومرحله‌ای برای هر حساب.
  */
  code_hash   text not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now(),
  unique (user_id, code_hash)
);

create index if not exists idx_backup_codes_user
  on public.mfa_backup_codes(user_id)
  where used_at is null;

alter table public.mfa_backup_codes enable row level security;

/*
  هیچ سیاستی — حتی خود کاربر نمی‌تواند بخواند.
  اگر می‌توانست، همان هش‌ها برای حمله‌ی آفلاین کافی بود. فقط
  service_role از روت سرور دسترسی دارد.
*/
revoke all on public.mfa_backup_codes from anon, authenticated;

comment on table public.mfa_backup_codes is
  'کدهای پشتیبان یک‌بارمصرف دومرحله‌ای. هش ذخیره می‌شود نه کد خام (NIST SP 800-63B).';


/**
 * جایگزینی کامل مجموعه‌ی کدها.
 *
 * ⚠️ ساخت مجموعه‌ی تازه، مجموعه‌ی قبلی را **کاملاً** باطل می‌کند.
 * استاندارد همین را می‌گوید: کاربری که کد تازه گرفته باید بداند
 * کاغذ قبلی دیگر بی‌ارزش است، وگرنه دو مجموعه‌ی معتبر همزمان
 * وجود دارد و یکی‌شان احتمالاً جایی رها شده.
 */
create or replace function public.replace_backup_codes(
  p_user_id uuid,
  p_hashes text[]
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_count int;
begin
  delete from public.mfa_backup_codes where user_id = p_user_id;

  insert into public.mfa_backup_codes(user_id, code_hash)
  select p_user_id, unnest(p_hashes)
  on conflict do nothing;

  select count(*) into v_count
  from public.mfa_backup_codes where user_id = p_user_id;

  return v_count;
end;
$$;

grant execute on function public.replace_backup_codes(uuid, text[]) to service_role;


/**
 * مصرف یک کد پشتیبان.
 *
 * ⚠️ فقط اعتبار را می‌سنجد و کد را می‌سوزاند؛ ساخت نشست کار
 * لایه‌ی بالاتر است.
 */
create or replace function public.consume_backup_code(
  p_user_id uuid,
  p_code_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid; v_left int;
begin
  select id into v_id
  from public.mfa_backup_codes
  where user_id = p_user_id and code_hash = p_code_hash and used_at is null
  limit 1;

  if v_id is null then
    return jsonb_build_object('ok', false);
  end if;

  update public.mfa_backup_codes set used_at = now() where id = v_id;

  select count(*) into v_left
  from public.mfa_backup_codes
  where user_id = p_user_id and used_at is null;

  -- تعداد باقی‌مانده برگردانده می‌شود تا به کاربر هشدار بدهیم.
  return jsonb_build_object('ok', true, 'remaining', v_left);
end;
$$;

grant execute on function public.consume_backup_code(uuid, text) to service_role;


/** چند کد استفاده‌نشده باقی مانده؟ برای نمایش در صفحه‌ی حساب. */
create or replace function public.my_backup_code_count()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.mfa_backup_codes
  where user_id = auth.uid() and used_at is null;
$$;

grant execute on function public.my_backup_code_count() to authenticated;


-- =============================================================
-- ۲) ترجیحات سازمان — واحد پول و شخصی‌سازی صنفی
-- =============================================================
--
-- در `settings` با کلید `org_prefs` ذخیره می‌شود، نه ستون جدید روی
-- `organizations`.
--
-- چرا jsonb و نه ستون؟
--   این ترجیحات مدام اضافه می‌شوند (واحد پول، واحد پیش‌فرض کالا،
--   برچسب‌ها، فیلدهای مخفی…). هر کدام یک ستون جدید یعنی یک مهاجرت
--   جدید روی جدولی که چهار سازمان واقعی دارد. با jsonb، افزودن
--   ترجیح تازه هیچ مهاجرتی لازم ندارد.
--
-- ⚠️ عمداً هیچ ستونی به `organizations` اضافه نمی‌شود: آن جدول در
--   شش نمای ادمین استفاده می‌شود و هر تغییرش همه را لمس می‌کند.

/**
 * خواندن ترجیحات سازمان جاری.
 *
 * ⚠️ اگر رکوردی نباشد، شیء خالی برمی‌گردد نه null — تا کلاینت
 * مجبور نباشد هر بار حالت تهی را جدا مدیریت کند.
 */
create or replace function public.get_org_prefs(p_org uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v jsonb;
begin
  if not (p_org in (select public.user_org_ids())) then
    raise exception 'دسترسی غیرمجاز به سازمان';
  end if;

  select value into v from public.settings
  where org_id = p_org and key = 'org_prefs';

  return coalesce(v, '{}'::jsonb);
end;
$$;

grant execute on function public.get_org_prefs(uuid) to authenticated;


/**
 * ذخیره‌ی ترجیحات.
 *
 * 🔴 فقط مالک و مدیر. این تنظیمات روی نمایش مبالغ **همه‌ی** کاربران
 * سازمان اثر می‌گذارد؛ اگر صندوق‌دار می‌توانست واحد پول را عوض کند،
 * بقیه ناگهان اعداد ده‌برابر یا یک‌دهم می‌دیدند.
 *
 * ⚠️ ادغام می‌کند (`||`) نه جایگزینی. اگر جایگزین می‌کرد، ذخیره‌ی
 * یک فرم، ترجیحات فرم دیگر را پاک می‌کرد.
 */
create or replace function public.save_org_prefs(p_org uuid, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_role text; v_new jsonb;
begin
  select role into v_role from public.memberships
  where org_id = p_org and user_id = auth.uid() and is_active
  limit 1;

  if v_role is null or v_role not in ('owner','manager') then
    raise exception 'فقط مالک یا مدیر مجموعه می‌تواند تنظیمات را تغییر دهد';
  end if;

  insert into public.settings(org_id, key, value, created_by)
  values (p_org, 'org_prefs', coalesce(p_patch, '{}'::jsonb), auth.uid())
  on conflict (org_id, key) do update
    set value = public.settings.value || coalesce(excluded.value, '{}'::jsonb),
        updated_at = now()
  returning value into v_new;

  return v_new;
end;
$$;

grant execute on function public.save_org_prefs(uuid, jsonb) to authenticated;


-- =============================================================
-- ۳) فهرست‌های قابل‌مدیریت (رنگ، سایز، فصل، جنس، واحد…)
-- =============================================================
--
-- الگوی سپیدار: «واحدهای سنجش» فهرستی است که کاربر خودش تعریف
-- می‌کند. سامانه‌ی مؤدیان هم کد استاندارد واحد می‌خواهد، پس این
-- فهرست بعداً باید به کد رسمی نگاشت شود — به همین دلیل ستون `code`
-- از الان هست حتی اگر فعلاً استفاده نشود.
create table if not exists public.option_lists (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  /* دسته: color | size | season | material | unit | payment_method … */
  kind        text not null,
  value       text not null,
  /* کد استاندارد برای نگاشت بعدی به سامانه‌ی مؤدیان. */
  code        text,
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id),
  unique (org_id, kind, value)
);

create index if not exists idx_option_lists_lookup
  on public.option_lists(org_id, kind, sort_order)
  where is_active;

alter table public.option_lists enable row level security;

drop policy if exists option_lists_read on public.option_lists;
create policy option_lists_read on public.option_lists
  for select using (org_id in (select public.user_org_ids()));

/*
  🔴 نوشتن فقط برای مالک و مدیر.

  اگر هر کاربری می‌توانست گزینه اضافه کند، فهرست رنگ‌ها خیلی زود
  پر از «مشکی»، «مشکي» و «سیاه» می‌شد — یعنی دقیقاً همان آشفتگی‌ای
  که این جدول قرار بود جلویش را بگیرد.
*/
drop policy if exists option_lists_write on public.option_lists;
create policy option_lists_write on public.option_lists
  for all using (
    exists (
      select 1 from public.memberships m
      where m.org_id = public.option_lists.org_id
        and m.user_id = auth.uid()
        and m.is_active
        and m.role in ('owner','manager')
    )
  )
  with check (
    exists (
      select 1 from public.memberships m
      where m.org_id = public.option_lists.org_id
        and m.user_id = auth.uid()
        and m.is_active
        and m.role in ('owner','manager')
    )
  );

comment on table public.option_lists is
  'گزینه‌های کشویی قابل‌مدیریت هر سازمان. ستون code برای نگاشت بعدی به سامانه‌ی مؤدیان.';
