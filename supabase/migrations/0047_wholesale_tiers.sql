-- 0047 — فروش عمده: پلکان قیمت و تبدیل پیش‌فاکتور به فاکتور
--
-- انگیزه (تحلیل رقبا، WHOLESALE_RESEARCH.md):
--   همه‌ی نرم‌افزارهای پخش ایرانی (سپیدار، هلو APEX، محک، ویزیت‌یار،
--   کارما) روی یک چیز مشترک‌اند که ما **نداریم**:
--
--     «تخفیف پلکانی» — هرچه بیشتر بخری، ارزان‌تر.
--
--   ما `price_lists` داریم ولی آن **بر اساس مشتری** است نه **بر اساس
--   تعداد**. عمده‌فروش می‌گوید «۱ تا ۹ عدد قیمت خرده، ۱۰ تا ۴۹ عدد
--   ۱۰٪ کمتر، ۵۰ به بالا ۱۸٪ کمتر». امروز کاربر باید این را در ذهنش
--   حساب کند و دستی قیمت را عوض کند.
--
-- ⚠️ داده‌ی موجود دست نمی‌خورد. `price_lists` صفر ردیف دارد،
-- `sales_orders` صفر ردیف. هیچ رکوردی حذف یا بازنویسی نمی‌شود.

-- =============================================================
-- ۱) پلکان قیمت روی لیست قیمت
-- =============================================================
--
-- چرا جدول جدا و نه ستون روی price_list_items؟
--   یک کالا در یک لیست ممکن است **چند** پله داشته باشد. اگر ستون
--   می‌گذاشتیم، هر پله یک ردیف price_list_items لازم داشت و آن‌گاه
--   «قیمت پایه‌ی این کالا در این لیست» دیگر یکتا نبود.
--
-- چرا min_qty و نه بازه‌ی min..max؟
--   بازه‌ی دوسر باعث «حفره» می‌شود: کاربر ۱-۹ و ۲۰-۵۰ تعریف می‌کند و
--   تعداد ۱۵ به هیچ پله‌ای نمی‌خورد. با min_qty تنها، همیشه بزرگ‌ترین
--   پله‌ای که min_qty آن <= تعداد است برنده می‌شود — حفره ممکن نیست.
create table if not exists public.price_tiers (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  price_list_id uuid not null references public.price_lists(id) on delete cascade,
  -- null یعنی «همه‌ی کالاهای این لیست»؛ مقدار یعنی فقط همان کالا.
  variant_id    uuid references public.product_variants(id) on delete cascade,
  min_qty       int  not null check (min_qty >= 1),
  -- دقیقاً یکی از این دو پر می‌شود (چک پایین‌تر).
  unit_price    bigint check (unit_price is null or unit_price >= 0),
  discount_percent numeric(5,2) check (discount_percent is null or (discount_percent >= 0 and discount_percent <= 100)),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id),
  constraint price_tiers_one_mode check (
    (unit_price is not null and discount_percent is null)
    or (unit_price is null and discount_percent is not null)
  )
);

-- دو پله با همان min_qty روی همان کالا یعنی نتیجه‌ی غیرقطعی.
-- ⚠️ `variant_id` می‌تواند null باشد و در Postgres دو null با هم برابر
-- نیستند، پس unique معمولی پله‌های «همه‌ی کالاها» را نمی‌گیرد.
-- دو ایندکس جزئی لازم است.
create unique index if not exists uq_price_tiers_variant
  on public.price_tiers(price_list_id, variant_id, min_qty)
  where variant_id is not null;

create unique index if not exists uq_price_tiers_all
  on public.price_tiers(price_list_id, min_qty)
  where variant_id is null;

create index if not exists idx_price_tiers_lookup
  on public.price_tiers(price_list_id, variant_id, min_qty desc)
  where is_active;

drop trigger if exists trg_updated_price_tiers on public.price_tiers;
create trigger trg_updated_price_tiers before update on public.price_tiers
  for each row execute function public.set_updated_at();

alter table public.price_tiers enable row level security;
drop policy if exists price_tiers_policy on public.price_tiers;
create policy price_tiers_policy on public.price_tiers
  for all using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

comment on table public.price_tiers is
  'پلکان قیمت عمده: هرچه تعداد بیشتر، قیمت کمتر. variant_id خالی یعنی پله روی کل لیست اعمال می‌شود.';


-- =============================================================
-- ۲) قیمت مؤثر یک کالا با توجه به تعداد
-- =============================================================
--
-- ترتیب اولویت — از خاص به عام:
--   ۱) پله‌ی مخصوص همین کالا (بزرگ‌ترین min_qty که <= تعداد است)
--   ۲) پله‌ی عمومی لیست
--   ۳) قیمت اختصاصی price_list_items
--   ۴) درصد تخفیف عمومی لیست روی sale_price
--   ۵) خود sale_price
--
-- ⚠️ چرا `stable` و نه `immutable`؟ به داده‌ی جدول نگاه می‌کند.
create or replace function public.tier_price_for(
  p_variant uuid,
  p_qty int,
  p_price_list uuid default null
)
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_base bigint;
  v_list_pct numeric;
  v_explicit bigint;
  v_tier record;
  v_qty int := greatest(1, coalesce(p_qty, 1));
begin
  select sale_price into v_base
  from public.product_variants where id = p_variant;

  if v_base is null then
    return 0;
  end if;

  if p_price_list is null then
    return v_base;
  end if;

  select discount_percent into v_list_pct
  from public.price_lists
  where id = p_price_list and is_active;

  -- لیست وجود ندارد یا غیرفعال است ⇒ قیمت پایه، نه صفر.
  if not found then
    return v_base;
  end if;

  -- پله: اول مخصوص کالا، بعد عمومی. `variant_id is not distinct from`
  -- به‌جای `=` چون null با `=` هرگز match نمی‌شود.
  select * into v_tier
  from public.price_tiers t
  where t.price_list_id = p_price_list
    and t.is_active
    and t.min_qty <= v_qty
    and (t.variant_id = p_variant or t.variant_id is null)
  order by (t.variant_id is not null) desc, t.min_qty desc
  limit 1;

  if found then
    if v_tier.unit_price is not null then
      return v_tier.unit_price;
    end if;
    return greatest(0, round(v_base * (100 - v_tier.discount_percent) / 100))::bigint;
  end if;

  select price into v_explicit
  from public.price_list_items
  where price_list_id = p_price_list and variant_id = p_variant;

  if v_explicit is not null then
    return v_explicit;
  end if;

  return greatest(0, round(v_base * (100 - coalesce(v_list_pct, 0)) / 100))::bigint;
end;
$$;

comment on function public.tier_price_for(uuid, int, uuid) is
  'قیمت مؤثر یک کالا با توجه به تعداد و لیست قیمت. اولویت: پله‌ی کالا > پله‌ی لیست > قیمت اختصاصی > درصد لیست > قیمت پایه.';


-- =============================================================
-- ۳) تبدیل پیش‌فاکتور به فاکتور فروش
-- =============================================================
--
-- 🔴 چرا این تابع لازم است و نمی‌شود از سمت کلاینت `create_sale` را
-- صدا زد و بعد وضعیت سفارش را عوض کرد:
--
--   بین آن دو فراخوانی، اگر مرورگر بسته شود یا شبکه قطع شود، فاکتور
--   ثبت شده ولی سفارش هنوز `pending` است. کاربر دوباره «تبدیل» را
--   می‌زند و **فاکتور دوم** ثبت می‌شود — موجودی دو بار کم می‌شود.
--
--   اینجا هر دو در یک تراکنش‌اند و قفل ردیف گرفته می‌شود.
create or replace function public.convert_order_to_sale(
  p_order uuid,
  p_paid_cash bigint default 0,
  p_paid_card bigint default 0,
  p_account uuid default null,
  p_date timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.sales_orders;
  v_items jsonb;
  v_sale uuid;
begin
  if not public.has_permission('sales.create') then
    raise exception 'دسترسی ثبت فروش وجود ندارد';
  end if;

  -- 🔴 `for update` حیاتی است: دو تب باز، دو کلیک همزمان ⇒ بدون قفل،
  -- هر دو وضعیت را `pending` می‌بینند و دو فاکتور می‌سازند.
  select * into v_order
  from public.sales_orders
  where id = p_order
  for update;

  if not found then
    raise exception 'پیش‌فاکتور یافت نشد';
  end if;

  if not (v_order.org_id in (select public.user_org_ids())) then
    raise exception 'دسترسی غیرمجاز به سازمان';
  end if;

  if v_order.status = 'converted' then
    raise exception 'این پیش‌فاکتور قبلاً به فاکتور تبدیل شده است';
  end if;

  if v_order.status = 'cancelled' then
    raise exception 'پیش‌فاکتور لغو شده قابل تبدیل نیست';
  end if;

  -- `cost_price` از قیمت خرید همان لحظه خوانده می‌شود نه از زمان ثبت
  -- سفارش: سود باید بر مبنای بهای تمام‌شده‌ی روزِ خروج کالا حساب شود.
  select coalesce(jsonb_agg(jsonb_build_object(
           'variant_id', i.variant_id,
           'qty',        i.qty,
           'unit_price', i.unit_price,
           'discount',   i.discount,
           'cost_price', coalesce(v.purchase_price, 0)
         )), '[]'::jsonb)
    into v_items
  from public.sales_order_items i
  left join public.product_variants v on v.id = i.variant_id
  where i.order_id = p_order;

  if jsonb_array_length(v_items) = 0 then
    raise exception 'پیش‌فاکتور هیچ قلمی ندارد';
  end if;

  v_sale := public.create_sale(
    p_org        => v_order.org_id,
    p_branch     => v_order.branch_id,
    p_customer   => v_order.customer_id,
    p_items      => v_items,
    p_discount   => v_order.discount,
    p_tax        => v_order.tax,
    p_paid_cash  => coalesce(p_paid_cash, 0),
    p_paid_card  => coalesce(p_paid_card, 0),
    p_paid_credit=> 0,
    p_account    => p_account,
    p_note       => coalesce(v_order.note, '') ||
                    case when v_order.order_no is null then ''
                         else ' (از پیش‌فاکتور ' || v_order.order_no || ')' end,
    p_date       => coalesce(p_date, now())
  );

  update public.sales_orders
     set status = 'converted', converted_to_id = v_sale
   where id = p_order;

  return v_sale;
end;
$$;

comment on function public.convert_order_to_sale(uuid, bigint, bigint, uuid, timestamptz) is
  'تبدیل اتمیک پیش‌فاکتور به فاکتور فروش. قفل ردیف می‌گیرد تا کلیک دوباره فاکتور تکراری نسازد.';


-- =============================================================
-- ۴) اعتبار مشتری: چقدر می‌تواند نسیه بخرد
-- =============================================================
--
-- ستون `contacts.credit_limit` از مهاجرت ۰۰۰۱ وجود دارد و **هرگز در
-- هیچ کجای برنامه خوانده نشده** — نه در فروش، نه در سفارش. صفر مشتری
-- مقدار دارد. در فروش عمده این مهم‌ترین گارد است: ویزیتور نباید به
-- مشتری‌ای که ۵۰ میلیون بدهکار است باز هم نسیه بدهد.
--
-- ⚠️ فقط **گزارش** می‌دهد، جلوی ثبت را نمی‌گیرد. تصمیم با کاربر است؛
-- شاید عمداً می‌خواهد سقف را رد کند.
create or replace function public.customer_credit_status(p_contact uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit bigint;
  v_balance bigint;
  v_org uuid;
begin
  select credit_limit, org_id into v_limit, v_org
  from public.contacts where id = p_contact;

  if not found then
    return jsonb_build_object('found', false);
  end if;

  if not (v_org in (select public.user_org_ids())) then
    raise exception 'دسترسی غیرمجاز';
  end if;

  select coalesce(balance, 0) into v_balance
  from public.v_contact_balance where contact_id = p_contact;

  return jsonb_build_object(
    'found', true,
    'credit_limit', coalesce(v_limit, 0),
    'balance', coalesce(v_balance, 0),
    -- سقف صفر یعنی «تعریف نشده» نه «ممنوع» — وگرنه همه‌ی ۵۵۲ مشتری
    -- موجود یک‌شبه مسدود می‌شدند.
    'remaining', case when coalesce(v_limit, 0) = 0 then null
                      else coalesce(v_limit, 0) - coalesce(v_balance, 0) end,
    'over_limit', coalesce(v_limit, 0) > 0 and coalesce(v_balance, 0) > coalesce(v_limit, 0)
  );
end;
$$;

comment on function public.customer_credit_status(uuid) is
  'وضعیت اعتبار مشتری: سقف، مانده و باقیمانده. سقف صفر یعنی تعریف‌نشده، نه ممنوع.';
