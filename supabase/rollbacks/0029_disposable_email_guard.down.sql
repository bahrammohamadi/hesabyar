-- =============================================================
-- Rollback برای 0029_disposable_email_guard.sql
--
-- ⚠️ پس از اجرا، ثبت‌نام با ایمیل یک‌بارمصرف دوباره ممکن می‌شود.
--    فقط در صورت مشکل جدی (مثلاً مسدود شدن کاربران واقعی) اجرا کنید.
--
-- برای رفع موقتِ یک دامنه‌ی خاص، به‌جای rollback کامل کافی است همان
-- سطر را حذف کنید:
--     delete from public.disposable_email_domains where domain = 'example.com';
-- =============================================================

drop trigger  if exists trg_guard_disposable_signup on auth.users;
drop function if exists public.guard_disposable_signup();
drop function if exists public.is_disposable_email(text);
drop function if exists public.disposable_domain_count();

/*
  جدول عمداً حذف نمی‌شود — ۸۲۰۴ دامنه در آن است و بازسازی‌اش وقت‌گیر
  است. اگر واقعاً لازم بود:

    drop table if exists public.disposable_email_domains;
*/
