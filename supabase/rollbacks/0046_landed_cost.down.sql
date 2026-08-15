-- بازگشت 0046 — حذف سرشکن قیمت تمام‌شده
--
-- ⚠️ پس از بازگشت، purchase_price دوباره قیمت خام می‌شود و گزارش سود
-- هزینه‌ی حمل را نادیده می‌گیرد. ستون landed_cost و مقادیرش پاک
-- می‌شوند.
--
-- توابع را با اجرای دوباره‌ی مهاجرت ۰۰۴۲ به حالت قبل برگردانید:
--   \i supabase/migrations/0042_purchase_line_discount.sql

drop function if exists public.allocate_extra_cost(bigint, bigint, int, bigint, int, text);
alter table public.purchase_items drop column if exists landed_cost;
