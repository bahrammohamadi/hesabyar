-- =============================================================
-- ROLLBACK مهاجرت 0041 — صفحه‌ی عمومی فروشگاه
--
-- ⚠️ جدول storefronts و تمام تنظیمات ویترین کسب‌وکارها حذف می‌شود.
-- اگر می‌خواهید نگه دارید، پیش از اجرا:
--   create table storefronts_backup_0041 as select * from public.storefronts;
--
-- پس از اجرا، همه‌ی نشانی‌های /shop/... با ۴۰۴ پاسخ می‌دهند —
-- یعنی لینک‌هایی که کاربران در اینستاگرام گذاشته‌اند می‌شکند.
--
-- هیچ داده‌ی کسب‌وکاری (کالا، فاکتور، مشتری) لمس نمی‌شود؛ این
-- مهاجرت از ابتدا فقط خواندنی روی آن‌ها بود.
-- =============================================================

drop function if exists public.is_storefront_slug_available(text, uuid);
drop function if exists public.get_public_storefront_products(text, int);
drop function if exists public.get_public_storefront(text);

drop trigger if exists trg_updated_storefronts on public.storefronts;

drop policy if exists p_storefronts_owner on public.storefronts;
drop policy if exists p_storefronts_admin on public.storefronts;

drop index if exists public.idx_storefronts_published;

drop table if exists public.storefronts;
