-- بازگشت 0052 — بازنشانی دومرحله‌ای توسط مدیر
--
-- ⚠️ پس از اجرا، اگر کاربری گوشی و کدهای پشتیبانش را با هم گم کند،
-- تنها راه بازگشت دخالت دستی در دیتابیس است.

drop function if exists public.org_mfa_status(uuid);
drop function if exists public.admin_reset_user_mfa(uuid);
