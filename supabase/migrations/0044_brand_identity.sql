-- 0044 — هویت برند روی فاکتور
--
-- 🔴 باگی که این مهاجرت حلش می‌کند:
--   صفحه‌ی فاکتور فروش، **لوگو و نام خودِ ترازو** را چاپ می‌کرد:
--
--     <img src="/logo.png" alt={BRAND_NAME} />
--     <h1>{BRAND_NAME}</h1>
--
--   یعنی مشتری «مزون پوشاک» فاکتوری می‌گرفت که بالایش نوشته بود
--   «ترازو». برای سندی که قرار است دست مشتری برود و گاهی مبنای
--   پیگیری مالی باشد، این فاجعه است.
--
--   ستون organizations.logo_url از قبل وجود داشت ولی **هیچ‌جا پر
--   نمی‌شد و هیچ‌جا خوانده نمی‌شد** — هر چهار سازمان زنده null دارند.
--
-- طراحی: به‌جای افزودن ده ستون به organizations، از جدول `settings`
-- که از قبل الگوی key/jsonb دارد استفاده می‌کنیم. کلید `brand`.
-- دلیل: این فیلدها صرفاً نمایشی‌اند، هیچ کوئری‌ای رویشان فیلتر
-- نمی‌کند، و افزودن فیلد بعدی (کد اقتصادی، شماره ثبت) نباید مهاجرت
-- جدید بخواهد.

-- -------------------------------------------------------------
-- ۱) سطل ذخیره‌سازی لوگو
-- -------------------------------------------------------------
--
-- ⚠️ عمداً public است. لوگو باید در فاکتور چاپی و در تصویری که برای
-- مشتری فرستاده می‌شود دیده شود؛ URL امضاشده در آن سناریوها منقضی
-- می‌شود و تصویر شکسته نشان می‌دهد.
--
-- محرمانگی: لوگوی یک مغازه اطلاعات حساس نیست — همان چیزی است که روی
-- تابلوی سردر است.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'brand-logos',
  'brand-logos',
  true,
  -- ۲ مگابایت. لوگوی بزرگ‌تر از این، هم بی‌دلیل است و هم چاپ را کند می‌کند.
  2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
  set public = true,
      file_size_limit = 2097152,
      allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

-- -------------------------------------------------------------
-- ۲) سیاست‌های دسترسی سطل
-- -------------------------------------------------------------
--
-- 🔴 نکته‌ی امنیتی اصلی: مسیر فایل با `org_id/` شروع می‌شود و سیاست
-- بررسی می‌کند که آن org در فهرست سازمان‌های کاربر باشد.
--
-- بدون این، هر کاربر واردشده‌ای می‌توانست لوگوی هر کسب‌وکار دیگری را
-- بازنویسی یا حذف کند — همان دسته اشتباهی که در policy با
-- `using (true)` روی categories گرفتیم (مهاجرت ۰۰۴۰).
drop policy if exists "brand_logos_public_read" on storage.objects;
create policy "brand_logos_public_read"
  on storage.objects for select
  using (bucket_id = 'brand-logos');

drop policy if exists "brand_logos_member_insert" on storage.objects;
create policy "brand_logos_member_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'brand-logos'
    and (storage.foldername(name))[1] in (
      select org_id::text from public.memberships where user_id = auth.uid()
    )
  );

drop policy if exists "brand_logos_member_update" on storage.objects;
create policy "brand_logos_member_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'brand-logos'
    and (storage.foldername(name))[1] in (
      select org_id::text from public.memberships where user_id = auth.uid()
    )
  );

drop policy if exists "brand_logos_member_delete" on storage.objects;
create policy "brand_logos_member_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'brand-logos'
    and (storage.foldername(name))[1] in (
      select org_id::text from public.memberships where user_id = auth.uid()
    )
  );

-- -------------------------------------------------------------
-- ۳) خواندن هویت برند
-- -------------------------------------------------------------
--
-- چرا تابع و نه select مستقیم روی settings؟
--   صفحه‌ی فاکتور باید هم نام سازمان (از organizations) و هم بقیه‌ی
--   فیلدها (از settings) را بگیرد. دو کوئری برای هر بار باز کردن
--   فاکتور، و منطق ادغام تکراری در هر صفحه.
--
-- ⚠️ coalesce روی نام: اگر کاربر «نام نمایشی» جدا وارد نکرده باشد،
-- نام سازمان استفاده می‌شود. هرگز نباید خالی برگردد چون سربرگ فاکتور
-- بدون نام، سند بی‌هویت است.
create or replace function public.get_brand_identity(p_org uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_org record;
  v_brand jsonb;
begin
  if not (p_org in (select public.user_org_ids())) then
    raise exception 'دسترسی غیرمجاز';
  end if;

  select name, logo_url, owner_phone into v_org
  from public.organizations where id = p_org;

  select coalesce(value, '{}'::jsonb) into v_brand
  from public.settings where org_id = p_org and key = 'brand';

  v_brand := coalesce(v_brand, '{}'::jsonb);

  return jsonb_build_object(
    'display_name', coalesce(nullif(trim(v_brand->>'display_name'), ''), v_org.name),
    'logo_url',     coalesce(nullif(trim(v_brand->>'logo_url'), ''), v_org.logo_url),
    'phone',        coalesce(nullif(trim(v_brand->>'phone'), ''), v_org.owner_phone),
    'mobile',       v_brand->>'mobile',
    'address',      v_brand->>'address',
    'email',        v_brand->>'email',
    'website',      v_brand->>'website',
    'instagram',    v_brand->>'instagram',
    'national_id',  v_brand->>'national_id',
    'economic_code',v_brand->>'economic_code',
    'postal_code',  v_brand->>'postal_code',
    'invoice_note', v_brand->>'invoice_note',
    'slogan',       v_brand->>'slogan'
  );
end;
$$;

comment on function public.get_brand_identity(uuid) is
  'هویت برند برای سربرگ فاکتور و پنل. ادغام organizations و settings.brand با اولویت با settings.';

revoke all on function public.get_brand_identity(uuid) from public, anon;
grant execute on function public.get_brand_identity(uuid) to authenticated;

-- -------------------------------------------------------------
-- ۴) ذخیره‌ی هویت برند
-- -------------------------------------------------------------
--
-- ⚠️ فقط کلیدهای شناخته‌شده پذیرفته می‌شوند. اگر کل jsonb ورودی را
-- ذخیره می‌کردیم، کلاینت می‌توانست هر چیزی — از جمله داده‌ی حجیم —
-- در ردیف settings بریزد.
create or replace function public.save_brand_identity(p_org uuid, p_brand jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clean jsonb := '{}'::jsonb;
  k text;
  v text;
begin
  if not (p_org in (select public.user_org_ids())) then
    raise exception 'دسترسی غیرمجاز';
  end if;
  if not public.has_permission('settings.manage') then
    raise exception 'دسترسی ویرایش تنظیمات وجود ندارد';
  end if;

  foreach k in array array[
    'display_name','logo_url','phone','mobile','address','email','website',
    'instagram','national_id','economic_code','postal_code','invoice_note','slogan'
  ]
  loop
    v := nullif(trim(coalesce(p_brand->>k, '')), '');
    if v is not null then
      -- سقف طول: یادداشت فاکتور بلندتر است چون چند خط شرایط فروش می‌گیرد.
      v := left(v, case when k = 'invoice_note' then 500 else 200 end);
      v_clean := v_clean || jsonb_build_object(k, v);
    end if;
  end loop;

  insert into public.settings(org_id, key, value, created_by)
  values (p_org, 'brand', v_clean, auth.uid())
  on conflict (org_id, key) do update
    set value = excluded.value, updated_at = now();

  /*
    نام و لوگو روی خودِ organizations هم نوشته می‌شوند.

    چرا تکرار؟ چون پنل ادمین، هدر و جاهای دیگر مستقیم از
    organizations می‌خوانند و نباید مجبور شوند این تابع را صدا بزنند.
    settings منبع حقیقت است؛ organizations آینه‌ی آن.
  */
  update public.organizations
  set logo_url = coalesce(v_clean->>'logo_url', logo_url),
      updated_at = now()
  where id = p_org;

  return public.get_brand_identity(p_org);
end;
$$;

comment on function public.save_brand_identity(uuid, jsonb) is
  'ذخیره‌ی هویت برند. فقط کلیدهای مجاز، با سقف طول. نیازمند مجوز settings.manage.';

revoke all on function public.save_brand_identity(uuid, jsonb) from public, anon;
grant execute on function public.save_brand_identity(uuid, jsonb) to authenticated;
