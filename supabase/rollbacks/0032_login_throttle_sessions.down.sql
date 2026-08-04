-- بازگردانی 0032
--
-- ⚠️ با اجرای این فایل، کندسازی ورود ناموفق برداشته می‌شود و brute-force
-- دوباره فقط به محدودیت نرخ درون‌حافظه‌ای متکی می‌ماند (که با ری‌استارت
-- سرور صفر می‌شود).

drop view if exists public.v_user_sessions;
drop function if exists public.delete_user_session(uuid, uuid);
drop function if exists public.clear_login_failures(text);
drop function if exists public.login_wait_seconds(text);
drop function if exists public.record_login_failure(text);
drop table if exists public.login_attempts;
