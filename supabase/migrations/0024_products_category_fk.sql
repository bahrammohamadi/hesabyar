-- 0024_products_category_fk.sql
--
-- پنل کالا با خطای زیر از کار می‌افتاد:
--   "Could not find a relationship between 'products' and 'categories'
--    in the schema cache"
--
-- علت: ستون products.category_id وجود دارد و کد آن را join می‌کند، اما
-- هیچ کلید خارجی به جدول categories تعریف نشده بود. PostgREST برای
-- تشخیص رابطه به کلید خارجی نیاز دارد و بدون آن join را رد می‌کند.
--
-- بررسی پیش از اجرا روی داده‌ی واقعی:
--   ۳۸۲ محصول · ۰ مقدار category_id ناسازگار
-- پس افزودن قید هیچ ردیفی را رد نمی‌کند.

begin;

-- ایندکس پیش از قید، تا جست‌وجوی رابطه سریع باشد.
create index if not exists idx_products_category on public.products (category_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.products'::regclass
      and conname = 'products_category_id_fkey'
  ) then
    alter table public.products
      add constraint products_category_id_fkey
      foreign key (category_id) references public.categories(id)
      on delete set null;
  end if;
end $$;

commit;
