-- 0043 — مرکز کارهای امروز
--
-- چرا لازم شد؟
--   رقبا (معین، چرتکه) مرکز هشدار دارند: سررسید چک، بدهی مشتری، کسری
--   کالا، اقساط. ما فقط «هشدار موجودی کم» داشتیم.
--
-- 🔴 و آن یکی هم عملاً بی‌معنا بود. اندازه‌گیری روی داده‌ی زنده:
--     ۳۶۲ از ۳۸۶ تنوع «کم‌موجود» شمرده می‌شدند (۹۴٪)
--     چون ۳۴۴ تای آن‌ها اصلاً موجودی صفر دارند و آستانه‌ی پیش‌فرض ۳ است.
--   هشداری که ۹۴٪ کاتالوگ را قرمز می‌کند، هشدار نیست؛ نویز است و کاربر
--   یاد می‌گیرد نادیده‌اش بگیرد.
--
--   راه‌حل: کالای تمام‌شده فقط وقتی «کار امروز» است که **واقعاً فروش
--   داشته باشد**. کالایی که هیچ‌وقت فروش نرفته و موجودی‌اش صفر است،
--   احتمالاً داده‌ی اولیه است نه کسری واقعی.
--   روی داده‌ی زنده: ۳۶۲ → ۱۱ مورد.
--
-- ⚠️ همه‌ی مبالغ ریال‌اند (واحد دیتابیس).

-- -------------------------------------------------------------
-- شاخص‌ها — کوئری‌های زیر روی سررسید و وضعیت فیلتر می‌کنند
-- -------------------------------------------------------------
create index if not exists idx_checks_due_status
  on public.checks(org_id, status, due_date);

create index if not exists idx_sales_credit
  on public.sales(org_id, status)
  where paid_credit > 0;

-- -------------------------------------------------------------
-- تابع اصلی
-- -------------------------------------------------------------
--
-- خروجی یک jsonb با پنج گروه است، نه پنج تابع جدا: داشبورد هر پنج
-- عدد را با هم می‌خواهد و پنج رفت‌وبرگشت شبکه برای یک ویجت، اسراف است.
--
-- ⚠️ `security definer` لازم است چون تابع روی چند جدول با RLS متفاوت
-- کوئری می‌زند؛ ولی خط اول بدنه عضویت را چک می‌کند تا این قدرت نشت
-- نکند — همان الگوی dashboard_summary.
create or replace function public.action_center(p_org uuid, p_days int default 7)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v jsonb;
  v_now timestamptz := now();
  v_soon timestamptz;
  v_days int := greatest(1, least(coalesce(p_days, 7), 90));
begin
  if not (p_org in (select public.user_org_ids())) then
    raise exception 'دسترسی غیرمجاز';
  end if;

  v_soon := v_now + make_interval(days => v_days);

  select jsonb_build_object(
    /*
      ۱) چک‌های سررسیدگذشته — مهم‌ترین گروه.
      وضعیت pending یا deposited یعنی هنوز تعیین‌تکلیف نشده.
      cashed/returned/cancelled دیگر کاری ندارند.
    */
    'checks_overdue', coalesce((
      select jsonb_agg(x order by x->>'due_date')
      from (
        select jsonb_build_object(
          'id', c.id, 'type', c.type, 'check_no', c.check_no,
          'bank_name', c.bank_name, 'amount', c.amount,
          'due_date', c.due_date, 'contact_name', ct.name
        ) as x
        from public.checks c
        left join public.contacts ct on ct.id = c.contact_id
        where c.org_id = p_org
          and c.status in ('pending', 'deposited')
          and c.due_date < v_now
        order by c.due_date
        limit 20
      ) s
    ), '[]'::jsonb),

    -- ۲) چک‌هایی که تا p_days روز آینده سررسید می‌شوند
    'checks_soon', coalesce((
      select jsonb_agg(x order by x->>'due_date')
      from (
        select jsonb_build_object(
          'id', c.id, 'type', c.type, 'check_no', c.check_no,
          'bank_name', c.bank_name, 'amount', c.amount,
          'due_date', c.due_date, 'contact_name', ct.name
        ) as x
        from public.checks c
        left join public.contacts ct on ct.id = c.contact_id
        where c.org_id = p_org
          and c.status in ('pending', 'deposited')
          and c.due_date >= v_now
          and c.due_date <= v_soon
        order by c.due_date
        limit 20
      ) s
    ), '[]'::jsonb),

    /*
      ۳) فاکتورهای نسیه‌ی تسویه‌نشده.

      مبنا paid_credit روی خودِ فاکتور است، نه مانده‌ی کلی مشتری:
      کاربر می‌خواهد بداند «کدام فاکتور» را پیگیری کند، نه فقط اینکه
      فلانی بدهکار است. مانده‌ی کلی در contact_balances هست و جای
      دیگری نمایش داده می‌شود.
    */
    'unpaid_invoices', coalesce((
      select jsonb_agg(x order by (x->>'date'))
      from (
        select jsonb_build_object(
          'id', s.id, 'invoice_no', s.invoice_no, 'date', s.date,
          'amount', s.paid_credit, 'contact_name', ct.name,
          'days_old', extract(day from (v_now - s.date))::int
        ) as x
        from public.sales s
        left join public.contacts ct on ct.id = s.customer_id
        where s.org_id = p_org
          and s.status <> 'cancelled'
          and s.paid_credit > 0
        order by s.date
        limit 20
      ) s
    ), '[]'::jsonb),

    /*
      ۴) کالای تمام‌شده‌ای که واقعاً فروش داشته.

      🔴 اینجاست که با هشدار قدیمی فرق می‌کند. شرط `exists` روی
      sale_items یعنی فقط کالایی که سابقه‌ی فروش دارد. بدون آن،
      ۹۴٪ کاتالوگ در فهرست می‌آمد و کل ویجت بی‌فایده می‌شد.
    */
    'out_of_stock', coalesce((
      select jsonb_agg(x order by (x->>'sold_qty')::int desc)
      from (
        select jsonb_build_object(
          'variant_id', v.id, 'product_id', v.product_id,
          'product_name', p.name,
          'label', nullif(trim(both ' / ' from concat_ws(' / ', v.color, v.size)), ''),
          'stock_qty', v.stock_qty,
          'sold_qty', (select coalesce(sum(si.qty), 0) from public.sale_items si where si.variant_id = v.id)
        ) as x
        from public.product_variants v
        join public.products p on p.id = v.product_id
        where v.org_id = p_org
          and v.is_active
          and v.stock_qty <= 0
          and exists (select 1 from public.sale_items si where si.variant_id = v.id)
        limit 20
      ) s
    ), '[]'::jsonb),

    -- ۵) سفارش‌های فروش در انتظار (پیش‌فاکتور تبدیل‌نشده)
    'pending_orders', coalesce((
      select jsonb_agg(x order by x->>'date')
      from (
        select jsonb_build_object(
          'id', o.id, 'order_no', o.order_no, 'date', o.date,
          'total', o.total, 'contact_name', ct.name
        ) as x
        from public.sales_orders o
        left join public.contacts ct on ct.id = o.customer_id
        where o.org_id = p_org
          and o.status = 'pending'
        order by o.date
        limit 20
      ) s
    ), '[]'::jsonb)
  ) into v;

  return v;
end;
$$;

comment on function public.action_center(uuid, int) is
  'کارهای امروز: چک سررسیدگذشته و نزدیک، فاکتور نسیه، کالای تمام‌شده‌ی پرفروش، سفارش در انتظار. مبالغ ریال.';

/*
  ⚠️ بدون این، هر کاربر ناشناسی می‌توانست تابع را صدا بزند. چک عضویت
  داخل تابع جلوی نشت داده را می‌گیرد ولی حذف دسترسی از anon یک لایه‌ی
  دفاعی اضافه است — همان کاری که در 0039 برای apply_sale_cancellation
  کردیم.
*/
revoke all on function public.action_center(uuid, int) from public, anon;
grant execute on function public.action_center(uuid, int) to authenticated;
