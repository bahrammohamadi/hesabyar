-- بازگشت 0047 — فروش عمده
--
-- ⚠️ `price_tiers` را drop می‌کند. اگر پله‌ای تعریف کرده‌اید، اول
-- خروجی بگیرید:
--   copy (select * from public.price_tiers) to stdout with csv header;

drop function if exists public.customer_credit_status(uuid);
drop function if exists public.convert_order_to_sale(uuid, bigint, bigint, uuid, timestamptz);
drop function if exists public.tier_price_for(uuid, int, uuid);

drop index if exists public.idx_price_tiers_lookup;
drop index if exists public.uq_price_tiers_all;
drop index if exists public.uq_price_tiers_variant;
drop table if exists public.price_tiers;
