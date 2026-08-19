-- 0050 — سخت‌سازی احراز هویت: بازیابی رمز و سابقه‌ی ورود
--
-- تصمیم‌ها و دلیلشان در AUTH_ARCHITECTURE.md آمده. خلاصه‌ی آنچه این
-- مهاجرت حل می‌کند:
--
-- 🔴 ۱) بازیابی رمز اصلاً وجود نداشت.
--   FAQ می‌گفت «با پشتیبانی تماس بگیرید» و صفحه‌ی ورود حتی لینک
--   «فراموشی رمز» نداشت. یعنی کاربری که رمزش را گم می‌کرد، از
--   داده‌ی مالی خودش بیرون می‌ماند.
--
--   دو اندازه‌گیری که معماری را تعیین کرد:
--     rate_limit_email_sent = 2   ← دو ایمیل در ساعت برای کل پروژه
--     ۴ از ۶ کاربر ایمیل ساختگی @hesabyar.app دارند
--
--   پس بازیابی فقط با ایمیل کافی نیست. مسیر دوم لازم است: مدیر
--   سازمان یک کد یک‌بارمصرف صادر می‌کند.
--
-- 🔴 ۲) سابقه‌ی ورود ثبت نمی‌شد.
--   جدول login_attempts فقط یک **شمارنده‌ی حالت** است و با ورود
--   موفق پاک می‌شود. یعنی هیچ ردی نمی‌ماند که چه کسی، کِی، از کجا
--   وارد شده. بدون آن نفوذ هرگز کشف نمی‌شود.

-- =============================================================
-- ۱) کد بازیابی رمز
-- =============================================================
--
-- 🔴 چرا مدیر مستقیم رمز را عوض نکند؟
--   می‌تواند (روت admin/users/password هست). ولی آن‌وقت مدیر **رمز
--   کاربر را می‌داند** و بعداً می‌تواند به‌جای او سند مالی ثبت کند.
--   انکارناپذیری از بین می‌رود. با کد یک‌بارمصرف، رمز نهایی را فقط
--   خود کاربر می‌داند.
create table if not exists public.password_reset_codes (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  /*
    🔴 هش، نه کد خام.
    اگر کسی دسترسی خواندنی به دیتابیس پیدا کند (نشت پشتیبان، اشتباه
    در RLS)، کد خام یعنی تصاحب فوری هر حساب. با هش، کد فقط در همان
    لحظه‌ای که مدیر می‌بیندش ارزش دارد.
  */
  code_hash   text not null,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  /* سقف تلاش: کد ۸ رقمی با ۵ تلاش عملاً غیرقابل حدس است. */
  attempt_count int not null default 0,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

create index if not exists idx_prc_user_active
  on public.password_reset_codes(user_id, expires_at)
  where used_at is null;

alter table public.password_reset_codes enable row level security;

/*
  هیچ سیاستی تعریف نمی‌شود — حتی کاربر واردشده نمی‌تواند بخواند.
  فقط service_role از روت سرور دسترسی دارد. اگر کاربر می‌توانست
  بخواند، همان هش برای حمله‌ی آفلاین کافی بود.
*/
revoke all on public.password_reset_codes from anon, authenticated;

comment on table public.password_reset_codes is
  'کد یک‌بارمصرف بازیابی رمز که مدیر صادر می‌کند. هش ذخیره می‌شود نه کد خام.';


-- =============================================================
-- ۲) سابقه‌ی رویدادهای ورود
-- =============================================================
--
-- چرا جدا از login_attempts؟
--   آن یک شمارنده‌ی حالت است که با ورود موفق **پاک می‌شود**. سابقه
--   باید بماند. دو مسئولیت متفاوت، دو جدول.
create table if not exists public.login_events (
  id          bigserial primary key,
  /* null یعنی شناسه‌ی ورود به هیچ کاربری نخورد (تلاش روی حساب ناموجود). */
  user_id     uuid references auth.users(id) on delete set null,
  login_id    text not null,
  event       text not null
              check (event in ('success','failure','throttled','reset','mfa_failure')),
  ip          text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_login_events_user
  on public.login_events(user_id, created_at desc);

create index if not exists idx_login_events_time
  on public.login_events(created_at desc);

alter table public.login_events enable row level security;

/*
  کاربر فقط سابقه‌ی **خودش** را می‌بیند.

  ⚠️ عمداً `using` دارد ولی `with check` ندارد: نوشتن فقط از سرور
  با service_role انجام می‌شود. اگر کاربر می‌توانست بنویسد، سابقه را
  با رویداد جعلی پر می‌کرد و ارزش تحقیقاتی‌اش از بین می‌رفت.
*/
drop policy if exists login_events_self_read on public.login_events;
create policy login_events_self_read on public.login_events
  for select using (user_id = auth.uid());

comment on table public.login_events is
  'سابقه‌ی ورود موفق و ناموفق. جدا از login_attempts که فقط شمارنده است.';


-- =============================================================
-- ۳) ثبت رویداد ورود
-- =============================================================
--
-- ⚠️ نگهداری ۹۰ روز. بدون پاک‌سازی، این جدول در پروژه‌ای با هزار
-- کاربر سالانه میلیون‌ها ردیف می‌شود و کوئری سابقه کند می‌گردد.
-- پاک‌سازی داخل خود تابع است تا به کرون نیاز نداشته باشیم — با
-- احتمال کم اجرا می‌شود تا هزینه‌ی هر ورود بالا نرود.
create or replace function public.record_login_event(
  p_login_id text,
  p_event    text,
  p_user_id  uuid default null,
  p_ip       text default null,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.login_events(user_id, login_id, event, ip, user_agent)
  values (p_user_id, lower(trim(p_login_id)), p_event, p_ip, left(coalesce(p_user_agent, ''), 300));

  -- تقریباً یک بار در هر صد ورود، ردیف‌های کهنه پاک می‌شوند.
  if random() < 0.01 then
    delete from public.login_events where created_at < now() - interval '90 days';
  end if;
end;
$$;

grant execute on function public.record_login_event(text, text, uuid, text, text) to service_role;

comment on function public.record_login_event(text, text, uuid, text, text) is
  'ثبت رویداد ورود. نگهداری ۹۰ روز با پاک‌سازی تصادفی کم‌هزینه.';


-- =============================================================
-- ۴) صدور کد بازیابی توسط مدیر
-- =============================================================
--
-- 🔴 گارد مالکیت داخل خود تابع است نه در کد برنامه.
--   تابع security definer است و مستقیم به auth.users دسترسی دارد؛
--   اگر بررسی را به لایه‌ی برنامه می‌سپردیم، هر فراموشی یعنی امکان
--   صدور کد برای کاربر سازمان دیگر.
create or replace function public.issue_password_reset_code(
  p_user_id uuid,
  p_code_hash text,
  p_ttl_minutes int default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_org uuid;
  v_target_org uuid;
begin
  if v_actor is null then
    raise exception 'دسترسی غیرمجاز';
  end if;

  -- فقط مالک یا مدیر می‌تواند کد صادر کند.
  select m.org_id into v_org
  from public.memberships m
  where m.user_id = v_actor
    and m.is_active
    and m.role in ('owner','manager')
  limit 1;

  if v_org is null then
    raise exception 'فقط مالک یا مدیر مجموعه می‌تواند کد بازیابی صادر کند';
  end if;

  -- کاربر هدف باید در همان سازمان باشد.
  select m.org_id into v_target_org
  from public.memberships m
  where m.user_id = p_user_id and m.org_id = v_org and m.is_active
  limit 1;

  if v_target_org is null then
    raise exception 'این کاربر عضو مجموعه‌ی شما نیست';
  end if;

  /*
    کدهای قبلیِ همین کاربر باطل می‌شوند.

    بدون این، مدیری که دو بار کد می‌سازد دو کد معتبر همزمان دارد و
    کد اول — که شاید در پیام‌رسان دیده شده — هنوز کار می‌کند.
  */
  update public.password_reset_codes
     set used_at = now()
   where user_id = p_user_id and used_at is null;

  insert into public.password_reset_codes(org_id, user_id, code_hash, expires_at, created_by)
  values (v_org, p_user_id, p_code_hash,
          now() + make_interval(mins => greatest(5, least(p_ttl_minutes, 120))),
          v_actor);

  return jsonb_build_object('ok', true, 'expires_in_minutes', greatest(5, least(p_ttl_minutes, 120)));
end;
$$;

grant execute on function public.issue_password_reset_code(uuid, text, int) to authenticated;

comment on function public.issue_password_reset_code(uuid, text, int) is
  'صدور کد بازیابی توسط مالک یا مدیر. کدهای قبلی همان کاربر باطل می‌شوند.';


-- =============================================================
-- ۵) مصرف کد بازیابی
-- =============================================================
--
-- ⚠️ این تابع رمز را عوض **نمی‌کند** — فقط اعتبار کد را می‌سنجد.
--   تغییر رمز باید با Admin API خود Supabase انجام شود چون هش رمز
--   در auth.users است و دست‌کاری مستقیمش شکننده است.
create or replace function public.consume_password_reset_code(
  p_login_id text,
  p_code_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_row public.password_reset_codes;
begin
  select id into v_user from auth.users
  where lower(email) = lower(trim(p_login_id)) limit 1;

  /*
    🔴 پاسخ برای «کاربر ناموجود» و «کد غلط» یکسان است.
    اگر فرق می‌کرد، مهاجم می‌توانست فهرست حساب‌های موجود را
    استخراج کند.
  */
  if v_user is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  select * into v_row
  from public.password_reset_codes
  where user_id = v_user and used_at is null
  order by created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  if v_row.expires_at < now() then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  -- سقف تلاش: کد ۸ رقمی با ۵ تلاش عملاً غیرقابل حدس است.
  if v_row.attempt_count >= 5 then
    return jsonb_build_object('ok', false, 'reason', 'too_many');
  end if;

  if v_row.code_hash <> p_code_hash then
    update public.password_reset_codes
       set attempt_count = attempt_count + 1
     where id = v_row.id;
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  update public.password_reset_codes set used_at = now() where id = v_row.id;

  return jsonb_build_object('ok', true, 'user_id', v_user);
end;
$$;

grant execute on function public.consume_password_reset_code(text, text) to service_role;

comment on function public.consume_password_reset_code(text, text) is
  'سنجش کد بازیابی. رمز را عوض نمی‌کند؛ فقط اعتبار را تأیید می‌کند.';


-- =============================================================
-- ۶) سابقه‌ی ورود کاربر برای نمایش
-- =============================================================
create or replace function public.my_login_history(p_limit int default 20)
returns table (
  event text,
  ip text,
  user_agent text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select e.event, e.ip, e.user_agent, e.created_at
  from public.login_events e
  where e.user_id = auth.uid()
  order by e.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

grant execute on function public.my_login_history(int) to authenticated;

comment on function public.my_login_history(int) is
  'سابقه‌ی ورود کاربر جاری. فقط رویدادهای خودش.';
