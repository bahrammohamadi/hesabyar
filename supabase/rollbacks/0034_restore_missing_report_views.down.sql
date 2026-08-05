-- بازگردانی 0034
--
-- ⚠️ با اجرای این فایل، گزارش «پرفروش‌ترین کالاها» دوباره HTTP 404
-- می‌دهد — همان حالت معیوبی که ۰۰۳۴ درست کرد. فقط در صورتی اجرا کنید
-- که واقعاً می‌خواهید به وضعیت قبل برگردید.

drop view if exists public.low_selling_products;
drop view if exists public.sales_by_category;
drop view if exists public.top_selling_products;
