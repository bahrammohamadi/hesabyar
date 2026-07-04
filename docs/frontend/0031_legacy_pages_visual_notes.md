# 0031 — بازطراحی بصری صفحات legacy گزارش/مالی/انبار

## دامنه اجرا
این بخش فقط کلاس‌های بصری و ساختار presentation را تغییر داد؛ هیچ fetch/mutation/RPC یا payload تغییر نکرد.

## صفحات/مسیرهای به‌روز شده
### `/reports` و تب‌های داخلی آن
فایل: `app/(app)/reports/page.tsx`
- PageHeader مشترک قبلاً استفاده می‌شد و حفظ شد.
- بنر معرفی گزارش‌های جدید با سطح کارت جدید، gradient ملایم primary و shadow هماهنگ شد.
- تب‌های گزارش به container کارت‌مانند و state فعال با shadow primary تغییر کردند.
- کارت‌های آماری و کارت‌های نمودار/جدول به الگوی rounded/white/backdrop/shadow هماهنگ با Phase 2 نزدیک شدند.

### `/finance` و زیرمسیرهای آن
فایل مشترک: `components/shared/finance-operation-page.tsx`
زیرمسیرها که از همین کامپوننت استفاده می‌کنند:
- `/finance`
- `/finance/expenses`
- `/finance/income`
- `/finance/payments`
- `/finance/receipts`
- `/finance/transfers`

تغییرات:
- فرم عملیات مالی و لیست آخرین تراکنش‌ها با card جدید، border سفید، shadow نرم و header داخلی تازه نمایش داده می‌شوند.
- ردیف‌های لیست hover ملایم primary گرفتند.

### `/inventory` و زیرمسیرهای عملیاتی آن
فایل مشترک: `components/shared/inventory-operation-page.tsx`
زیرمسیرها که از همین کامپوننت استفاده می‌کنند:
- `/inventory`
- `/inventory/adjust`
- `/inventory/in`
- `/inventory/movements`
- `/inventory/waste`

تغییرات:
- فرم انتخاب/ثبت عملیات انبار و لیست گردش‌ها با الگوی کارت جدید هماهنگ شد.
- selected product box، empty/select state و error state فقط از نظر بصری بهبود یافتند.

## صفحات باقی‌مانده / انجام‌نشده
- `/reports/overview-v2` قبلاً با Design System جدید ساخته شده بود و در این commit تغییر نکرد.
- صفحات تخصصی گزارش مانند `/reports/sellers`، `/reports/profitability` و `/reports/customer-profitability` در این commit دست‌نخورده ماندند چون ساختار مستقل و نسبتاً جدیدتری دارند و برای پرهیز از تغییر ناخواسته داده/ستون، به بخش بعدی یا ممیزی جدا نیاز دارند.
- صفحات تخصصی انبار مثل `/inventory/as-of` و `/inventory/stock-card` از کامپوننت عملیاتی مشترک استفاده نمی‌کنند؛ در این commit برای کنترل ریسک دست‌نخورده ماندند.

## تغییر نکرد
- Query keyها
- Supabase RPCها
- insert/update/delete
- منطق محاسباتی گزارش‌ها
- ستون‌ها و داده‌های نمایشی
