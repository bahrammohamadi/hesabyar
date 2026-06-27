-- =============================================================
-- حساب‌یار - آپدیت ۳: فیلدهای کالا (فصل، جنس، کد کالا) + تولید خودکار کد
-- این فایل را در Supabase > SQL Editor اجرا کنید.
-- =============================================================

-- 1) فیلدهای جدید روی products
alter table public.products add column if not exists code     text;
alter table public.products add column if not exists season   text;
alter table public.products add column if not exists material text;

-- 2) کد یکتا در هر سازمان (فقط وقتی پر است)
create unique index if not exists uq_products_org_code
  on public.products(org_id, code) where code is not null;

-- 3) شمارنده کد کالا به ازای سازمان (در settings نگه می‌داریم)
-- تابع تولید کد بعدی: پیشوند پیش‌فرض MJ (مهرجامه) + شماره ۵ رقمی
create or replace function public.next_product_code(p_org uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_count  bigint;
  v_code   text;
begin
  -- پیشوند از تنظیمات (در صورت نبود، MJ)
  select coalesce((value->>'product_code_prefix'), 'MJ')
    into v_prefix
    from public.settings
    where org_id = p_org and key = 'general'
    limit 1;
  if v_prefix is null then v_prefix := 'MJ'; end if;

  -- تعداد فعلی محصولات (مبنای شماره)
  select count(*) into v_count from public.products where org_id = p_org;

  loop
    v_count := v_count + 1;
    v_code := v_prefix || '-' || lpad(v_count::text, 5, '0');
    exit when not exists (
      select 1 from public.products where org_id = p_org and code = v_code
    );
  end loop;

  return v_code;
end;
$$;

-- 4) تریگر: اگر کد محصول هنگام درج خالی بود، خودکار ساخته شود
create or replace function public.set_product_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.code is null or btrim(new.code) = '' then
    new.code := public.next_product_code(new.org_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_product_code on public.products;
create trigger trg_set_product_code
  before insert on public.products
  for each row execute function public.set_product_code();

-- 5) تابع تولید SKU/کد تنوع بعدی (برای variant) بر اساس کد محصول
create or replace function public.next_variant_sku(p_product uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pcode text;
  v_n     int;
  v_sku   text;
begin
  select code into v_pcode from public.products where id = p_product;
  if v_pcode is null then v_pcode := 'V'; end if;
  select count(*) into v_n from public.product_variants where product_id = p_product;
  loop
    v_n := v_n + 1;
    v_sku := v_pcode || '-' || lpad(v_n::text, 2, '0');
    exit when not exists (
      select 1 from public.product_variants v
      join public.products p on p.id = v.product_id
      where p.org_id = (select org_id from public.products where id = p_product)
        and v.sku = v_sku
    );
  end loop;
  return v_sku;
end;
$$;

-- 6) ایندکس برای جستجوی سریع کد محصول
create index if not exists idx_products_code on public.products(code);

-- =============================================================
-- پایان آپدیت ۳
-- =============================================================
