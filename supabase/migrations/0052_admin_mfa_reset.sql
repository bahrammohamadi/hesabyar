-- 0052 — بازنشانی ورود دومرحله‌ای توسط مدیر
--
-- 🔴 حفره‌ای که می‌بندد:
--
--   اگر کاربر گوشی‌اش را **و** کدهای پشتیبانش را با هم از دست بدهد،
--   هیچ راه خودکاری برای بازگشت نداشت. کد بازیابی رمزِ مدیر هم
--   کمکی نمی‌کرد چون فقط رمز را عوض می‌کند و عامل دوم سر جایش
--   می‌ماند — یعنی کاربر رمز تازه دارد ولی همچنان پشت صفحه‌ی
--   تأیید گیر است.
--
--   تنها راه باقی‌مانده دخالت دستی در دیتابیس بود. برای مغازه‌داری
--   که ساعت ۹ شب گوشی‌اش را گم کرده، این یعنی تا فردا از حسابش
--   بیرون است.
--
-- ⚠️ چرا نمی‌شود از سمت کلاینت انجامش داد؟
--   `auth.mfa.unenroll` روی نشست **خود کاربر** کار می‌کند. مدیر
--   نشست او را ندارد. پس یا باید مستقیم روی `auth.mfa_factors`
--   نوشت، یا از Admin API استفاده کرد.
--
--   اینجا تابع دیتابیس انتخاب شد چون گارد نقش و هم‌سازمانی را
--   می‌شود اتمیک کنارش گذاشت.

/**
 * حذف همه‌ی عامل‌های دوم یک کاربر، توسط مالک یا مدیر همان سازمان.
 *
 * 🔴 گاردها داخل خود تابع‌اند نه در کد برنامه.
 *   تابع `security definer` است و مستقیم به `auth.mfa_factors`
 *   دسترسی دارد؛ اگر بررسی را به لایه‌ی برنامه می‌سپردیم، هر
 *   فراموشی یعنی امکان خلع‌سلاح 2FA کاربر سازمان دیگر.
 *
 * ⚠️ کدهای پشتیبان هم پاک می‌شوند. اگر نمی‌کردیم، کدهای قدیمی روی
 *   حسابی می‌ماندند که دیگر 2FA ندارد — یعنی یک مجموعه راز
 *   بی‌صاحب که فقط ریسک است.
 *
 * ⚠️ نشست‌های فعال کاربر هم بسته می‌شوند. اگر کسی حساب را دزدیده و
 *   2FA گذاشته باشد، صرفِ برداشتن عامل دوم او را بیرون نمی‌کند.
 */
create or replace function public.admin_reset_user_mfa(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_org uuid;
  v_target_org uuid;
  v_factors int;
  v_codes int;
begin
  if v_actor is null then
    raise exception 'دسترسی غیرمجاز';
  end if;

  /*
    ⚠️ مدیر نمی‌تواند 2FA **خودش** را از این مسیر بردارد.
    برای آن باید از صفحه‌ی حساب کاربری اقدام کند، جایی که کد اپ
    را می‌پرسد. وگرنه مدیری که حسابش دزدیده شده، مهاجم می‌تواند
    با همین دکمه عامل دوم را بردارد.
  */
  if v_actor = p_user_id then
    raise exception 'برای حساب خودتان از صفحه‌ی حساب کاربری اقدام کنید';
  end if;

  select m.org_id into v_org
  from public.memberships m
  where m.user_id = v_actor
    and m.is_active
    and m.role in ('owner','manager')
  limit 1;

  if v_org is null then
    raise exception 'فقط مالک یا مدیر مجموعه می‌تواند ورود دومرحله‌ای را بازنشانی کند';
  end if;

  select m.org_id into v_target_org
  from public.memberships m
  where m.user_id = p_user_id and m.org_id = v_org and m.is_active
  limit 1;

  if v_target_org is null then
    raise exception 'این کاربر عضو مجموعه‌ی شما نیست';
  end if;

  select count(*) into v_factors from auth.mfa_factors where user_id = p_user_id;
  delete from auth.mfa_factors where user_id = p_user_id;

  select count(*) into v_codes from public.mfa_backup_codes where user_id = p_user_id;
  delete from public.mfa_backup_codes where user_id = p_user_id;

  /*
    نشست‌ها بسته می‌شوند تا اگر کسی همین حالا با آن حساب وارد است،
    بیرون بیفتد. کاربر واقعی دوباره با رمزش وارد می‌شود.
  */
  delete from auth.sessions where user_id = p_user_id;

  /* رویداد در سابقه‌ی ورود همان کاربر ثبت می‌شود تا ردی بماند. */
  insert into public.login_events(user_id, login_id, event, ip, user_agent)
  select p_user_id, coalesce(u.email, p_user_id::text), 'reset', null,
         'بازنشانی دومرحله‌ای توسط مدیر'
  from auth.users u where u.id = p_user_id;

  return jsonb_build_object(
    'ok', true,
    'factors_removed', v_factors,
    'codes_removed', v_codes
  );
end;
$$;

grant execute on function public.admin_reset_user_mfa(uuid) to authenticated;

comment on function public.admin_reset_user_mfa(uuid) is
  'حذف عامل دوم، کدهای پشتیبان و نشست‌های یک کاربر توسط مالک یا مدیر همان سازمان. روی حساب خود مدیر کار نمی‌کند.';


/**
 * آیا این کاربر ورود دومرحله‌ای فعال دارد؟
 *
 * برای نمایش نشان در فهرست کاربران، تا مدیر بداند دکمه‌ی بازنشانی
 * برای چه کسی معنی دارد.
 *
 * ⚠️ فقط وضعیت **بله/خیر** برمی‌گردد، نه جزئیات فاکتور.
 */
create or replace function public.org_mfa_status(p_org uuid)
returns table (user_id uuid, has_mfa boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (p_org in (select public.user_org_ids())) then
    raise exception 'دسترسی غیرمجاز به سازمان';
  end if;

  return query
  select m.user_id,
         exists (
           select 1 from auth.mfa_factors f
           where f.user_id = m.user_id and f.status = 'verified'
         ) as has_mfa
  from public.memberships m
  where m.org_id = p_org and m.is_active;
end;
$$;

grant execute on function public.org_mfa_status(uuid) to authenticated;

comment on function public.org_mfa_status(uuid) is
  'وضعیت دومرحله‌ای اعضای سازمان؛ فقط بله/خیر، بدون جزئیات فاکتور.';
