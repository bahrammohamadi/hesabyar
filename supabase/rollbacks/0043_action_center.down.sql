-- بازگشت 0043 — حذف مرکز کارهای امروز
--
-- بی‌خطر است: تابع فقط می‌خواند و هیچ داده‌ای نمی‌نویسد، شاخص‌ها هم
-- صرفاً سرعت‌اند. حذفشان هیچ ردیفی را از بین نمی‌برد.

drop function if exists public.action_center(uuid, int);

drop index if exists public.idx_checks_due_status;
drop index if exists public.idx_sales_credit;
