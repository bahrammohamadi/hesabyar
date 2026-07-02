-- =============================================================
-- Hesabyar Rollback 0015 - بازگشت غیرمخرب Payment/Balance Layer
-- نوع: DOWN migration دستی و ایمن
-- سیاست ایمنی: هیچ داده مالی یا تراکنشی حذف نمی‌شود.
-- =============================================================

-- -------------------------------------------------------------
-- ۱) حذف viewهای read-model
-- Viewها داده فیزیکی ندارند؛ حذف آن‌ها داده sales/purchases/transactions را پاک نمی‌کند.
-- -------------------------------------------------------------
drop view if exists public.v_contact_balance;
drop view if exists public.v_document_balance;

-- -------------------------------------------------------------
-- ۲) حذف تابع ثبت پرداخت
-- حذف تابع هیچ transaction موجودی را حذف نمی‌کند.
-- -------------------------------------------------------------
drop function if exists public.fn_register_payment(text, uuid, numeric, text);

-- -------------------------------------------------------------
-- ۳) حذف ایندکس‌های کمکی 0015
-- حذف ایندکس داده را حذف نمی‌کند.
-- -------------------------------------------------------------
drop index if exists public.idx_transactions_ref;
drop index if exists public.idx_transactions_type_method;

-- -------------------------------------------------------------
-- ۴) constraint method به حالت legacy برگردانده نمی‌شود.
-- دلیل: اگر بعد از migration مقادیر جدید مثل credit/other/wallet ثبت شده باشند، rollback constraint ممکن است fail شود.
-- قبل از هر rollback کامل constraint، بررسی کنید:
-- select method, count(*) from public.transactions group by method order by method;
-- -------------------------------------------------------------

-- =============================================================
-- پایان DOWN migration 0015
-- =============================================================
