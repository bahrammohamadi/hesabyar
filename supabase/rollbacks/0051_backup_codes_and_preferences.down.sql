-- بازگشت 0051
--
-- 🔴 هشدار: کدهای پشتیبان استفاده‌نشده از بین می‌روند. کاربرانی که
-- ورود دومرحله‌ای فعال دارند و گوشی‌شان گم شده، پس از این هیچ راه
-- بازگشتی ندارند.
--
-- ⚠️ ترجیحات سازمان (واحد پول، برچسب‌های صنفی) هم پاک می‌شوند و
-- نمایش مبالغ به حالت پیش‌فرض برمی‌گردد. پیش از اجرا خروجی بگیرید:
--   copy (select org_id, value from settings where key='org_prefs')
--     to stdout with csv header;
--   copy (select * from option_lists) to stdout with csv header;

drop function if exists public.my_backup_code_count();
drop function if exists public.consume_backup_code(uuid, text);
drop function if exists public.replace_backup_codes(uuid, text[]);
drop function if exists public.save_org_prefs(uuid, jsonb);
drop function if exists public.get_org_prefs(uuid);

drop index if exists public.idx_option_lists_lookup;
drop table if exists public.option_lists;

drop index if exists public.idx_backup_codes_user;
drop table if exists public.mfa_backup_codes;

-- ⚠️ ردیف‌های settings با کلید org_prefs عمداً حذف **نمی‌شوند**:
-- بی‌ضررند و اگر مهاجرت دوباره اجرا شود، تنظیمات کاربر برمی‌گردد.
-- برای حذف کامل:
--   delete from public.settings where key = 'org_prefs';
