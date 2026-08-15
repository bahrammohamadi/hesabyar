-- بازگشت 0044 — حذف هویت برند
--
-- ⚠️ داده از دست می‌رود: ردیف‌های settings با کلید 'brand' و فایل‌های
-- داخل سطل brand-logos. پیش از اجرا اگر خواستید نگه دارید:
--   create table brand_backup as select * from settings where key='brand';

drop function if exists public.save_brand_identity(uuid, jsonb);
drop function if exists public.get_brand_identity(uuid);

drop policy if exists "brand_logos_public_read"   on storage.objects;
drop policy if exists "brand_logos_member_insert" on storage.objects;
drop policy if exists "brand_logos_member_update" on storage.objects;
drop policy if exists "brand_logos_member_delete" on storage.objects;

-- ⚠️ فایل‌ها باید پیش از حذف سطل پاک شوند وگرنه خطا می‌دهد.
delete from storage.objects where bucket_id = 'brand-logos';
delete from storage.buckets where id = 'brand-logos';

delete from public.settings where key = 'brand';
