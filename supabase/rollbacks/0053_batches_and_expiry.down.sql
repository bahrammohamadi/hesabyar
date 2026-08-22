-- بازگشت 0053 — سری ساخت و تاریخ انقضا
--
-- 🔴 هشدار: تاریخ‌های انقضای ثبت‌شده از بین می‌روند. پیش از اجرا
-- خروجی بگیرید:
--   copy (select * from public.product_batches) to stdout with csv header;
--
-- ⚠️ ستون batch_id از stock_movements حذف می‌شود ولی خود حرکت‌ها
-- دست‌نخورده می‌مانند — موجودی تغییر نمی‌کند، فقط ارتباطش با بچ
-- از بین می‌رود.

drop function if exists public.upsert_batch(uuid, uuid, text, date, date);
drop function if exists public.expiring_batches(uuid, int);
drop view if exists public.v_batch_stock;

alter table public.sale_items      drop column if exists batch_id;
alter table public.purchase_items  drop column if exists batch_id;

drop index if exists public.idx_movements_batch;
alter table public.stock_movements drop column if exists batch_id;

drop index if exists public.idx_batch_expiry;
drop index if exists public.uq_batch_identity;
drop table if exists public.product_batches;
