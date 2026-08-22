-- 0053 — سری ساخت و تاریخ انقضا
--
-- 🔴 دو ادعای سایت را می‌بندد:
--   • سوپرمارکت: «مدیریت تاریخ انقضا»
--   • داروخانه: «کنترل تاریخ انقضا»
--
-- =============================================================
-- تصمیم معماری — مهم‌ترین بخش این مهاجرت
-- =============================================================
--
-- ⚠️ موجودی **همچنان** از `stock_movements` می‌آید و
--   `product_variants.stock_qty` تنها منبع حقیقت موجودی می‌ماند.
--
-- 🔴 چرا جدول موازی موجودیِ بچ **نساختیم**؟
--
--   وسوسه این است که جدولی مثل `batch_stock(batch_id, qty)` بسازیم
--   و موجودی هر بچ را جدا نگه داریم. ولی آن‌وقت دو منبع حقیقت
--   داریم که باید همیشه با هم بخوانند:
--
--       sum(batch_stock.qty)  ==  product_variants.stock_qty
--
--   و هر جا یکی به‌روز شود و دیگری نه — یک فروش، یک مرجوعی، یک
--   انبارگردانی — موجودی کل با موجودی بچ‌ها فرق می‌کند و **هیچ‌کس
--   نمی‌فهمد کدام درست است**. در نرم‌افزار مالی این کشنده است.
--
--   به‌جایش: `stock_movements.batch_id` یک ستون **اختیاری** است.
--   موجودی هر بچ = جمع حرکت‌هایی که آن بچ را دارند. یک منبع، یک
--   جمع، بدون امکان ناهماهنگی.
--
-- ⚠️ حرکت‌های قدیمی `batch_id` تهی دارند و این درست است: کالایی که
--   پیش از این ثبت شده بچ نداشته و نباید وانمود کنیم داشته.

-- =============================================================
-- ۱) بچ (سری ساخت)
-- =============================================================
create table if not exists public.product_batches (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  variant_id  uuid not null references public.product_variants(id) on delete cascade,
  /* شماره‌ی سری ساخت روی بسته. برای کالای بدون سری، تاریخ کافی است. */
  lot_no      text,
  expiry_date date,
  /* تاریخ تولید — برای گزارش عمر قفسه، اختیاری. */
  made_date   date,
  note        text,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id),

  /*
    یک بچ باید حداقل یکی از این دو را داشته باشد، وگرنه از بچ
    بدون شناسه هیچ استفاده‌ای نمی‌شود کرد.
  */
  constraint batch_needs_identity check (lot_no is not null or expiry_date is not null)
);

/*
  ⚠️ یکتایی روی (کالا، سری، انقضا).

  دو ردیف با همان سری و همان انقضا یعنی دو «بچ» که در واقع یکی‌اند —
  و آن‌وقت موجودی بین‌شان تقسیم می‌شود و گزارش انقضا دو خط تکراری
  نشان می‌دهد.

  🔴 `coalesce` لازم است چون در Postgres دو NULL با هم برابر نیستند،
  پس unique معمولی ردیف‌های بدون سری را نمی‌گیرد.
*/
create unique index if not exists uq_batch_identity
  on public.product_batches(
    variant_id,
    coalesce(lot_no, ''),
    coalesce(expiry_date, '9999-12-31'::date)
  );

create index if not exists idx_batch_expiry
  on public.product_batches(org_id, expiry_date)
  where expiry_date is not null;

alter table public.product_batches enable row level security;
drop policy if exists product_batches_policy on public.product_batches;
create policy product_batches_policy on public.product_batches
  for all using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

comment on table public.product_batches is
  'سری ساخت و تاریخ انقضا. موجودی هر بچ از جمع stock_movements همان بچ می‌آید، نه از ستون جدا.';


-- =============================================================
-- ۲) اتصال حرکت انبار به بچ
-- =============================================================
--
-- ⚠️ `on delete set null` نه `cascade`: حذف یک بچ نباید تاریخچه‌ی
--   انبار را پاک کند. حرکت می‌ماند، فقط دیگر به بچ نمی‌چسبد.
alter table public.stock_movements
  add column if not exists batch_id uuid references public.product_batches(id) on delete set null;

create index if not exists idx_movements_batch
  on public.stock_movements(batch_id)
  where batch_id is not null;

comment on column public.stock_movements.batch_id is
  'بچ مربوط به این حرکت. تهی یعنی کالای بدون سری ساخت یا حرکت پیش از این قابلیت.';

/* قلم فاکتور هم بچ را نگه می‌دارد تا در چاپ فاکتور دیده شود. */
alter table public.sale_items
  add column if not exists batch_id uuid references public.product_batches(id) on delete set null;
alter table public.purchase_items
  add column if not exists batch_id uuid references public.product_batches(id) on delete set null;


-- =============================================================
-- ۳) موجودی هر بچ
-- =============================================================
--
-- 🔴 تنها راه محاسبه‌ی موجودی بچ. هیچ ستون ذخیره‌شده‌ای وجود ندارد
--   که بتواند با این ناهماهنگ شود.
create or replace view public.v_batch_stock
with (security_invoker = true)
as
select
  b.id            as batch_id,
  b.org_id,
  b.variant_id,
  b.lot_no,
  b.expiry_date,
  b.made_date,
  coalesce(sum(m.qty), 0)::numeric(14,3) as qty,
  /*
    روزهای باقی‌مانده. منفی یعنی منقضی شده.
    ⚠️ تاریخ تهی → null، نه صفر: «بدون تاریخ» با «امروز منقضی
    می‌شود» زمین تا آسمان فرق دارد.
  */
  case when b.expiry_date is null then null
       else (b.expiry_date - current_date) end as days_left
from public.product_batches b
left join public.stock_movements m on m.batch_id = b.id
group by b.id, b.org_id, b.variant_id, b.lot_no, b.expiry_date, b.made_date;

comment on view public.v_batch_stock is
  'موجودی هر بچ از جمع حرکت‌های همان بچ. security_invoker تا RLS اعمال شود.';


-- =============================================================
-- ۴) گزارش انقضای نزدیک
-- =============================================================
--
-- ⚠️ فقط بچ‌هایی که **موجودی دارند**. بچ تمام‌شده‌ی منقضی هیچ
--   اهمیتی ندارد و فقط گزارش را شلوغ می‌کند.
create or replace function public.expiring_batches(
  p_org uuid,
  p_days int default 60
)
returns table (
  batch_id uuid,
  variant_id uuid,
  product_name text,
  variant_label text,
  lot_no text,
  expiry_date date,
  days_left int,
  qty numeric
)
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
  select
    s.batch_id,
    s.variant_id,
    p.name,
    nullif(trim(both ' / ' from concat_ws(' / ', v.color, v.size)), '') as variant_label,
    s.lot_no,
    s.expiry_date,
    s.days_left::int,
    s.qty::numeric
  from public.v_batch_stock s
  join public.product_variants v on v.id = s.variant_id
  join public.products p on p.id = v.product_id
  where s.org_id = p_org
    and s.expiry_date is not null
    and s.qty > 0
    and s.days_left <= greatest(0, coalesce(p_days, 60))
  order by s.expiry_date asc;
end;
$$;

grant execute on function public.expiring_batches(uuid, int) to authenticated;

comment on function public.expiring_batches(uuid, int) is
  'بچ‌های نزدیک به انقضا یا منقضی که هنوز موجودی دارند.';


-- =============================================================
-- ۵) ساخت یا یافتن بچ
-- =============================================================
--
-- 🔴 چرا «یافتن» هم؟ کاربر همان سری را دوباره می‌خرد. اگر هر بار
--   بچ تازه می‌ساختیم، فهرست پر می‌شد از ردیف‌های تکراری با موجودی
--   خرد — و گزارش انقضا ده خط برای یک کالا نشان می‌داد.
create or replace function public.upsert_batch(
  p_org uuid,
  p_variant uuid,
  p_lot text default null,
  p_expiry date default null,
  p_made date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid; v_lot text;
begin
  if not (p_org in (select public.user_org_ids())) then
    raise exception 'دسترسی غیرمجاز به سازمان';
  end if;

  v_lot := nullif(trim(coalesce(p_lot, '')), '');

  if v_lot is null and p_expiry is null then
    raise exception 'برای ثبت سری ساخت، شماره سری یا تاریخ انقضا لازم است';
  end if;

  select id into v_id
  from public.product_batches
  where variant_id = p_variant
    and coalesce(lot_no, '') = coalesce(v_lot, '')
    and coalesce(expiry_date, '9999-12-31'::date) = coalesce(p_expiry, '9999-12-31'::date);

  if v_id is not null then
    return v_id;
  end if;

  insert into public.product_batches(org_id, variant_id, lot_no, expiry_date, made_date, created_by)
  values (p_org, p_variant, v_lot, p_expiry, p_made, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.upsert_batch(uuid, uuid, text, date, date) to authenticated;

comment on function public.upsert_batch(uuid, uuid, text, date, date) is
  'ساخت بچ یا برگرداندن بچ موجود با همان سری و انقضا. از ردیف تکراری جلوگیری می‌کند.';
