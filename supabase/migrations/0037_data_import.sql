-- =============================================================
-- Tarazoo Migration 0037 — ورود دسته‌جمعی داده از فایل اکسل
--
-- کسب‌وکاری که تازه می‌آید، صدها کالا و مشتری در یک فایل اکسل دارد.
-- تا امروز تنها راه، ثبت تک‌تک از طریق فرم بود.
--
-- نوع: افزایشی. هیچ ستون/policy/داده‌ی موجودی حذف نمی‌شود.
--
-- EMERGENCY ROLLBACK: supabase/rollbacks/0037_data_import.down.sql
-- =============================================================


-- -------------------------------------------------------------
-- بخش ۱) دفترچه‌ی ورود داده
--
-- چرا جدول و نه فقط یک عملیات لحظه‌ای؟
--
--   ۱. برگشت‌پذیری. کاربر ۴۰۰ کالا وارد می‌کند و می‌فهمد ستون قیمت را
--      اشتباه پر کرده. بدون شناسه‌ی دسته، تنها راه حذف تک‌تک است.
--   ۲. پاسخ‌گویی. وقتی مشتری می‌گوید «این کالاها از کجا آمد؟»، باید
--      بشود گفت چه کسی، کِی و از چه فایلی.
--   ۳. سوپرادمین به‌جای مشتری وارد می‌کند؛ آن هم باید ردپا داشته باشد.
-- -------------------------------------------------------------

create table if not exists public.import_jobs (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  -- چه چیزی وارد شد
  kind          text not null check (kind in ('products', 'contacts')),
  -- چه کسی: کاربر خودِ کسب‌وکار یا ادمین پلتفرم
  created_by    uuid not null references auth.users(id) on delete cascade,
  is_admin_import boolean not null default false,

  file_name     text,
  -- برای تشخیص آپلود دوباره‌ی همان فایل (اشتباه رایج پس از خطای شبکه)
  file_hash     text,
  total_rows    integer not null default 0,
  created_rows  integer not null default 0,
  updated_rows  integer not null default 0,
  skipped_rows  integer not null default 0,
  failed_rows   integer not null default 0,

  status        text not null default 'pending'
                check (status in ('pending', 'done', 'failed', 'rolled_back')),
  /*
    خطاها با شماره‌ی سطرِ فایل نگهداری می‌شوند.
    jsonb و نه text: کاربر باید بتواند «سطر ۱۴۷ چه ایرادی داشت» را
    ببیند، نه یک متن طولانی بی‌ساختار.
  */
  errors        jsonb not null default '[]'::jsonb,
  rolled_back_at timestamptz,
  created_at    timestamptz not null default now()
);

comment on table public.import_jobs is
  'دفترچه‌ی ورود دسته‌جمعی داده. هر رکورد واردشده به یک job وصل است تا بتوان کل دسته را برگرداند.';

create index if not exists idx_import_jobs_org on public.import_jobs(org_id, created_at desc);

alter table public.import_jobs enable row level security;

-- کاربر job‌های سازمان خودش را می‌بیند؛ ادمین پلتفرم همه را.
drop policy if exists p_import_read on public.import_jobs;
create policy p_import_read on public.import_jobs
  for select to authenticated
  using (org_id in (select public.user_org_ids()) or public.is_platform_admin());

/*
  ⚠️ عمداً هیچ policy برای INSERT/UPDATE به نقش authenticated داده
  نمی‌شود. نوشتن فقط از مسیر روت API با کلید service_role انجام
  می‌شود، چون آنجاست که اعتبارسنجی و شمارش سطرها اتفاق می‌افتد.
  اگر کلاینت می‌توانست مستقیم بنویسد، می‌شد job جعلی با آمار دلخواه
  ساخت و گزارش را بی‌معنا کرد.
*/


-- -------------------------------------------------------------
-- بخش ۲) ردیابی منشأ رکوردها
--
-- ستون به سه جدول اضافه می‌شود تا بشود پرسید «کدام ردیف‌ها از این
-- فایل آمدند؟». بدون آن، برگرداندن یک ورود اشتباه غیرممکن است.
--
-- on delete set null: حذف دفترچه نباید داده‌ی واقعی مشتری را ببرد.
-- -------------------------------------------------------------

alter table public.products
  add column if not exists import_job_id uuid references public.import_jobs(id) on delete set null;
alter table public.product_variants
  add column if not exists import_job_id uuid references public.import_jobs(id) on delete set null;
alter table public.contacts
  add column if not exists import_job_id uuid references public.import_jobs(id) on delete set null;

create index if not exists idx_products_import  on public.products(import_job_id)  where import_job_id is not null;
create index if not exists idx_variants_import  on public.product_variants(import_job_id) where import_job_id is not null;
create index if not exists idx_contacts_import  on public.contacts(import_job_id)  where import_job_id is not null;


-- -------------------------------------------------------------
-- بخش ۳) 🔴 دسته‌بندی‌ها سازمان ندارند
--
-- کشف‌شده هنگام ساخت این قابلیت:
--   جدول categories نه ستون org_id دارد و نه policy جداسازی — تنها
--   policy آن «Public read categories» با شرط `true` است. یعنی
--   دسته‌بندی‌ها بین *همه‌ی* کسب‌وکارها مشترک‌اند و ۱۵ ردیف فعلی
--   («پاپ»، «راک»، «جاز»…) از یک پروژه‌ی موزیک باقی مانده‌اند.
--
--   اگر ورود اکسل اجازه می‌داد کاربر دسته‌ی جدید بسازد، دسته‌های یک
--   مزون پوشاک در حساب همه‌ی کسب‌وکارهای دیگر ظاهر می‌شد.
--
-- ⚠️ اینجا عمداً *اصلاح نمی‌شود*: افزودن org_id به جدولی که
--    products به آن ارجاع دارد، یک مهاجرت مستقل با ریسک خودش است و
--    قید کاربر «هیچ رکوردی نباید حذف یا تغییر کند» را به خطر
--    می‌اندازد. در عوض، مسیر ورود داده اصلاً دسته‌ی جدید نمی‌سازد و
--    فقط با دسته‌های *موجود* تطبیق می‌دهد.
--    برندها این مشکل را ندارند (org_id و policy جداسازی دارند).
-- -------------------------------------------------------------


-- -------------------------------------------------------------
-- بخش ۴) برگرداندن یک ورود
--
-- چرا تابع دیتابیس و نه چند DELETE از سمت API؟
--   حذف باید اتمیک باشد. اگر وسط کار قطع شود، نیمی از کالاها می‌مانند
--   و کاربر با وضعیتی روبه‌رو می‌شود که نه ورود کامل است نه برگشت کامل.
--
-- 🔴 قانون ایمنی: رکوردی که پس از ورود *استفاده شده* حذف نمی‌شود.
--   اگر کالایی در فاکتور فروش آمده باشد، حذفش یعنی فاکتور بی‌قلم
--   می‌شود و گزارش‌های مالی به هم می‌ریزد. چنین رکوردهایی فقط
--   غیرفعال می‌شوند و شمارششان جدا گزارش می‌شود.
-- -------------------------------------------------------------

create or replace function public.rollback_import(p_job uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job        public.import_jobs%rowtype;
  v_products   int := 0;
  v_variants   int := 0;
  v_contacts   int := 0;
  v_kept       int := 0;
begin
  select * into v_job from public.import_jobs where id = p_job;
  if not found then
    raise exception 'ورود موردنظر یافت نشد';
  end if;

  -- گارد دسترسی داخل تابع، نه فقط در API: تابع security definer است
  -- و بدون این، هر کاربری می‌توانست ورود سازمان دیگری را برگرداند.
  if not (
    public.is_platform_admin()
    or v_job.org_id in (select public.user_org_ids())
    or auth.uid() is null          -- مسیر service_role (گارد در لایه‌ی API)
  ) then
    raise exception 'دسترسی مجاز نیست';
  end if;

  if v_job.rolled_back_at is not null then
    raise exception 'این ورود قبلاً برگردانده شده است';
  end if;

  /* ── مخاطبین ── */
  /*
    استفاده‌شده = در فاکتور فروش/خرید یا تراکنش مالی آمده.

    🔴 نام ستون‌ها یکسان نیست و حدس‌زدنشان باگ داد:
       sales.customer_id · purchases.supplier_id · transactions.contact_id
    نسخه‌ی اول هر سه را contact_id فرض کرد و تابع با خطای
    «column s.contact_id does not exist» شکست — فقط در اجرای واقعی
    روی دیتابیس پیدا شد، نه در بیلد و نه در تست واحد.
  */
  with used as (
    select c.id from public.contacts c
    where c.import_job_id = p_job
      and (
        exists (select 1 from public.sales s        where s.customer_id = c.id) or
        exists (select 1 from public.purchases pu   where pu.supplier_id = c.id) or
        exists (select 1 from public.transactions t where t.contact_id  = c.id)
      )
  ), deactivated as (
    update public.contacts set is_active = false
    where import_job_id = p_job and id in (select id from used)
    returning 1
  ), removed as (
    delete from public.contacts
    where import_job_id = p_job and id not in (select id from used)
    returning 1
  )
  select
    (select count(*) from removed),
    (select count(*) from deactivated)
  into v_contacts, v_kept;

  /* ── کالاها ──
     واریانتی که در فاکتور آمده یا گردش انباری غیر از خودِ سند ورود
     دارد، «استفاده‌شده» است. */
  with used_variants as (
    select v.id from public.product_variants v
    where v.import_job_id = p_job
      and (
        exists (select 1 from public.sale_items si     where si.variant_id = v.id) or
        exists (select 1 from public.purchase_items pi where pi.variant_id = v.id) or
        exists (
          select 1 from public.stock_movements sm
          where sm.variant_id = v.id
            and coalesce(sm.ref_table, '') <> 'import_jobs'
        )
      )
  ), used_products as (
    select distinct v.product_id from public.product_variants v
    where v.id in (select id from used_variants)
  ),
  /*
     ⚠️ ترتیب اهمیت دارد: سند انبار پیش از واریانت حذف می‌شود.
     تریگر apply_stock_movement با حذف هر سند، موجودی را برمی‌گرداند —
     پس موجودی بی‌سند باقی نمی‌ماند. اگر واریانت زودتر حذف می‌شد،
     cascade سند را می‌برد و تریگر روی ردیف حذف‌شده اثر نداشت.
  */
  del_moves as (
    delete from public.stock_movements
    where ref_table = 'import_jobs' and ref_id = p_job
      and variant_id not in (select id from used_variants)
    returning 1
  ), deact_v as (
    update public.product_variants set is_active = false
    where import_job_id = p_job and id in (select id from used_variants)
    returning 1
  ), del_v as (
    delete from public.product_variants
    where import_job_id = p_job and id not in (select id from used_variants)
    returning 1
  ), deact_p as (
    update public.products set is_active = false
    where import_job_id = p_job and id in (select product_id from used_products)
    returning 1
  ), del_p as (
    delete from public.products
    where import_job_id = p_job
      and id not in (select product_id from used_products)
    returning 1
  )
  select
    (select count(*) from del_p),
    (select count(*) from del_v),
    v_kept + (select count(*) from deact_p) + (select count(*) from deact_v)
  into v_products, v_variants, v_kept;

  update public.import_jobs
     set status = 'rolled_back', rolled_back_at = now()
   where id = p_job;

  return jsonb_build_object(
    'products',  v_products,
    'variants',  v_variants,
    'contacts',  v_contacts,
    'kept',      v_kept
  );
end;
$$;

comment on function public.rollback_import(uuid) is
  'برگرداندن یک ورود دسته‌جمعی. رکورد استفاده‌شده حذف نمی‌شود، فقط غیرفعال می‌گردد.';

grant execute on function public.rollback_import(uuid) to authenticated, service_role;


-- -------------------------------------------------------------
-- بخش ۵) مجوز ورود داده برای ادمین پلتفرم
--
-- «داده وارد کردن به‌جای مشتری» یعنی نوشتن مستقیم در دیتابیس او —
-- از مشاهده‌ی فاکتور هم حساس‌تر است، پس پرخطر علامت می‌خورد.
-- -------------------------------------------------------------

insert into public.platform_permissions (key, label, description, category, risk, sort_order) values
  ('data.import', 'ورود داده برای کسب‌وکار', 'بارگذاری فایل اکسل کالا یا مشتری در حساب یک کسب‌وکار', 'داده مشتری', 'high', 105)
on conflict (key) do update
  set label = excluded.label, description = excluded.description,
      category = excluded.category, risk = excluded.risk, sort_order = excluded.sort_order;

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

  -- 🔴 گارد NULL — از مهاجرت ۰۰۲۸.
  if v_role is null then
    return false;
  end if;

  -- نقش سفارشی: فقط آرایه ملاک است (مهاجرت ۰۰۳۳).
  if v_role = 'custom' then
    return p_permission = any(coalesce(v_custom, '{}'));
  end if;

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
    when 'tickets.view'     then true
    when 'tickets.reply'    then v_role in ('super_admin', 'support')
    -- نوشتن انبوه در دیتابیس مشتری: فقط مدیر ارشد
    when 'data.import'      then v_role = 'super_admin'
    else false
  end;
end;
$$;

grant execute on function public.platform_admin_can(text, uuid) to authenticated, service_role;
