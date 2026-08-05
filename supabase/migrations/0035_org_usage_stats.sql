-- 0035 — آمار مصرف هر کسب‌وکار
--
-- چرا لازم است:
--   ۱. تشخیص کسب‌وکار فعال از رهاشده. سازمانی که ۳۰ روز است هیچ
--      فاکتوری نزده، احتمالاً دارد از دست می‌رود — و این را باید
--      *پیش از* پایان اشتراک فهمید، نه بعدش.
--   ۲. پیش‌نیاز سقف پلن. بدون دانستن اینکه هر کسب‌وکار چند کاربر و
--      چند کالا دارد، نمی‌شود پلن پله‌ای تعریف کرد.
--   ۳. پشتیبانی: «چرا کند است؟» با دیدن حجم داده جواب پیدا می‌کند.
--
-- ⚠️ چرا نما و نه جدول با محاسبه‌ی دوره‌ای؟
--   با این حجم (سه سازمان، صدها ردیف) شمارش زنده ارزان است و همیشه
--   دقیق. اگر روزی تعداد سازمان‌ها زیاد شد، همین نما با یک
--   materialized view جایگزین می‌شود و امضای ستون‌ها ثابت می‌ماند.

create or replace view public.v_org_usage as
select
  o.id                                          as org_id,
  o.name                                        as org_name,
  o.approval_status,
  o.business_type,
  o.owner_full_name,
  o.created_at                                  as org_created_at,
  o.trial_ends_at,

  /* ── حجم داده ── */
  (select count(*) from public.memberships m
     where m.org_id = o.id and m.is_active)     as users_count,
  (select count(*) from public.products p
     where p.org_id = o.id)                     as products_count,
  (select count(*) from public.product_variants pv
     join public.products p2 on p2.id = pv.product_id
     where p2.org_id = o.id)                    as variants_count,
  (select count(*) from public.contacts c
     where c.org_id = o.id)                     as contacts_count,
  (select count(*) from public.sales s
     where s.org_id = o.id)                     as sales_count,
  (select count(*) from public.purchases pu
     where pu.org_id = o.id)                    as purchases_count,
  (select count(*) from public.transactions t
     where t.org_id = o.id)                     as transactions_count,
  (select count(*) from public.stock_movements sm
     where sm.org_id = o.id)                    as movements_count,

  /* ── فعالیت اخیر ──
     شمارش ۳۰ روز اخیر جدا از کل: سازمانی با ۵۰۰ فاکتور قدیمی و صفر
     فاکتور ماه اخیر، «بزرگ» به نظر می‌رسد ولی در واقع رهاشده است. */
  (select count(*) from public.sales s
     where s.org_id = o.id and s.date >= now() - interval '30 days')
                                                as sales_30d,
  (select coalesce(sum(s.total), 0) from public.sales s
     where s.org_id = o.id
       and s.date >= now() - interval '30 days'
       and coalesce(s.status, 'confirmed') not in ('cancelled', 'returned', 'reversed', 'draft'))
                                                as revenue_30d,

  /* آخرین باری که *کاری* در این سازمان انجام شد. */
  greatest(
    coalesce((select max(s.created_at)  from public.sales s          where s.org_id = o.id), o.created_at),
    coalesce((select max(pu.created_at) from public.purchases pu     where pu.org_id = o.id), o.created_at),
    coalesce((select max(t.created_at)  from public.transactions t   where t.org_id = o.id), o.created_at),
    coalesce((select max(sm.created_at) from public.stock_movements sm where sm.org_id = o.id), o.created_at)
  )                                             as last_activity_at,

  /* آخرین ورود هر یک از اعضا — نشانه‌ی زنده‌بودن حساب. */
  (select max(u.last_sign_in_at)
     from public.memberships m
     join auth.users u on u.id = m.user_id
     where m.org_id = o.id and m.is_active)     as last_login_at
from public.organizations o;

comment on view public.v_org_usage is
  'آمار مصرف هر کسب‌وکار برای پنل مدیریت. شمارش زنده — با رشد تعداد سازمان‌ها به materialized view تبدیل شود.';

/*
  ⚠️ security_invoker عمداً تنظیم نشده (پیش‌فرض = definer).

  🔴 دلیل حیاتی: این نما به auth.users دست می‌زند (برای last_sign_in_at)
  و آن جدول به هیچ نقشی SELECT نداده — حتی service_role. با
  security_invoker=true خطای «permission denied for table users»
  می‌گرفتیم؛ همان درسی که در مهاجرت ۰۰۲۸ با v_admin_users گرفته شد.

  چون definer است، دسترسی نقش‌های عمومی صریحاً بسته می‌شود و فقط
  service_role — که پشت گارد requirePlatformPermission است — می‌خواند.
*/
revoke all on public.v_org_usage from anon, authenticated;
grant select on public.v_org_usage to service_role;
