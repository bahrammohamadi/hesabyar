-- بازگشت 0048 — واحد شمارش و کالای وزنی
--
-- 🔴 هشدار جدی: اگر پس از این مهاجرت کالای وزنی ثبت کرده باشید،
-- برگرداندن ستون به integer مقادیر اعشاری را **گرد می‌کند** و
-- موجودی با کاردکس نمی‌خواند.
--
-- پیش از اجرا حتماً بررسی کنید:
--   select count(*) from stock_movements where qty <> round(qty);
--   select count(*) from sale_items      where qty <> round(qty);
-- اگر صفر نبود، این فایل را اجرا نکنید.

drop function if exists public.pack_to_base(uuid, numeric);

alter table public.products drop constraint if exists products_unit_check;
alter table public.products
  drop column if exists pack_size,
  drop column if exists pack_label,
  drop column if exists unit_label,
  drop column if exists unit;

-- ⚠️ برگرداندن نوع ستون‌ها عمداً اینجا نیامده.
--
-- برای آن باید هر ۱۱ نمای وابسته دوباره drop و بازساخته شوند، و
-- چهارتاشان `security_invoker = true` دارند که اگر از قلم بیفتد RLS
-- دور زده می‌شود. numeric نگه‌داشتن ستون‌ها هیچ ضرری ندارد — همه‌ی
-- کد قدیمی با numeric هم کار می‌کند.
--
-- اگر واقعاً لازم شد، تعاریف نماها را از همان مهاجرت 0048 بردارید.
