-- بازگشت 0045 — حذف اعلان‌ها و پوش
--
-- ⚠️ داده از دست می‌رود: همه‌ی اعلان‌ها و اشتراک‌های پوش.
-- کاربران باید دوباره اجازه‌ی اعلان بدهند.

drop function if exists public.mark_notifications_read(uuid, uuid[]);
drop function if exists public.generate_business_notifications(uuid);
drop function if exists public.push_notification(uuid, text, text, text, text, text, text, uuid);

drop table if exists public.push_subscriptions;
drop table if exists public.notifications;
