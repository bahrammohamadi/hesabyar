-- بازگشت 0050 — سخت‌سازی احراز هویت
--
-- ⚠️ با اجرای این فایل سابقه‌ی ورود همه‌ی کاربران پاک می‌شود.
-- اگر در حال بررسی یک نفوذ هستید، اول خروجی بگیرید:
--   copy (select * from public.login_events) to stdout with csv header;
--
-- ⚠️ کدهای بازیابی صادرشده هم از بین می‌روند. کاربرانی که کد گرفته‌اند
-- ولی هنوز استفاده نکرده‌اند باید دوباره درخواست کنند.

drop function if exists public.my_login_history(int);
drop function if exists public.consume_password_reset_code(text, text);
drop function if exists public.issue_password_reset_code(uuid, text, int);
drop function if exists public.record_login_event(text, text, uuid, text, text);

drop index if exists public.idx_login_events_time;
drop index if exists public.idx_login_events_user;
drop table if exists public.login_events;

drop index if exists public.idx_prc_user_active;
drop table if exists public.password_reset_codes;
