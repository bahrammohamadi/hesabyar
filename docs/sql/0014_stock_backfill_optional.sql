-- =============================================================
-- اسکریپت اختیاری Backfill موجودی برای Migration 0014
-- وضعیت فعلی بررسی‌شده: mismatch_count = 0، بنابراین اجرای backfill لازم نیست.
-- این فایل به صورت پیش‌فرض فقط کوئری‌های تشخیصی دارد.
-- هیچ INSERT/UPDATE فعالی در این فایل وجود ندارد.
-- =============================================================

-- -------------------------------------------------------------
-- ۱) تشخیص مغایرت موجودی بین product_variants.stock_qty و v_product_stock
-- -------------------------------------------------------------
select
  p.id as product_id,
  pv.id as variant_id,
  pv.stock_qty::numeric as stock_field,
  coalesce(vps.current_stock,0)::numeric as computed_stock,
  pv.stock_qty::numeric - coalesce(vps.current_stock,0)::numeric as diff
from public.product_variants pv
join public.products p on p.id = pv.product_id
left join public.v_product_stock vps on vps.product_variant_id = pv.id
where pv.stock_qty::numeric <> coalesce(vps.current_stock,0)::numeric
order by abs(pv.stock_qty::numeric - coalesce(vps.current_stock,0)::numeric) desc, p.name;

-- -------------------------------------------------------------
-- ۲) خلاصه مغایرت‌ها
-- -------------------------------------------------------------
select
  count(*)::bigint as mismatch_count,
  coalesce(sum(abs(pv.stock_qty::numeric - coalesce(vps.current_stock,0)::numeric)),0)::numeric as total_abs_diff
from public.product_variants pv
left join public.v_product_stock vps on vps.product_variant_id = pv.id
where pv.stock_qty::numeric <> coalesce(vps.current_stock,0)::numeric;

-- -------------------------------------------------------------
-- ۳) قالب پیشنهادی backfill — عمداً کامنت شده است.
-- فقط در صورت وجود مغایرت، بعد از backup و بررسی دستی فعال شود.
-- منطق: ثبت حرکت adjust برای رساندن SUM(stock_movements.qty) به stock_qty فعلی.
-- هشدار: چون trigger موجودی stock_qty را با insert حرکت تغییر می‌دهد، اجرای کورکورانه این INSERT می‌تواند stock_qty را دوباره تغییر دهد.
-- برای اصلاح واقعی باید ابتدا استراتژی دقیق انتخاب شود:
--   الف) اصلاح دفتر حرکات و سپس sync controlled
--   ب) یا ثبت adjust و همزمان انتظار تغییر stock_qty
-- در وضعیت فعلی mismatch_count=0 است، پس نیازی به این کار نیست.
-- -------------------------------------------------------------

/*
-- فقط نمونه مفهومی؛ اجرا نکن مگر بعد از طراحی دقیق و backup:
with mismatches as (
  select
    pv.org_id,
    pv.branch_id,
    pv.id as variant_id,
    pv.stock_qty::numeric - coalesce(vps.current_stock,0)::numeric as diff
  from public.product_variants pv
  left join public.v_product_stock vps on vps.product_variant_id = pv.id
  where pv.stock_qty::numeric <> coalesce(vps.current_stock,0)::numeric
)
select * from mismatches;
*/
