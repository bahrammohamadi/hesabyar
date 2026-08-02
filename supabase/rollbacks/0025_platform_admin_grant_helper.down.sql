-- =============================================================
-- Rollback برای 0025_platform_admin_grant_helper.sql
--
-- فقط توابع و نمای کمکی حذف می‌شوند.
-- ⚠️ هیچ سطری از platform_admins حذف نمی‌شود — دسترسی‌هایی که با
--    این ابزار داده‌اید دست‌نخورده باقی می‌مانند.
-- =============================================================

drop view     if exists public.v_platform_admins;
drop function if exists public.grant_platform_admin(uuid, text, text);
drop function if exists public.revoke_platform_admin(uuid);
