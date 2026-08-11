-- بازگشت 0042 — حذف تخفیف هر قلم از فاکتور خرید
--
-- ⚠️ این rollback **داده از دست می‌دهد**: هر تخفیف سطری ثبت‌شده پاک
-- می‌شود. line_total دست‌نخورده می‌ماند، پس جمع فاکتورها همچنان درست
-- است؛ فقط دیگر معلوم نیست چه بخشی از آن تخفیف بوده.
--
-- پیش از اجرا اگر خواستید نگه دارید:
--   create table purchase_items_discount_backup as
--     select id, discount from public.purchase_items where discount <> 0;

-- ۱) توابع به رفتار پیش از 0042 برمی‌گردند (بدون خواندن کلید discount).
--    محتوای دقیق در 0030 و 0011 است؛ آن دو فایل را دوباره اجرا کنید:
--      \i supabase/migrations/0011_purchase_edit_cancel.sql
--      \i supabase/migrations/0030_purchase_split_payment.sql
--
--    ⚠️ ترتیب مهم است: 0030 آخر باشد چون امضای create_purchase را
--    نهایی می‌کند.

-- ۲) ستون حذف می‌شود.
alter table public.purchase_items drop column if exists discount;
