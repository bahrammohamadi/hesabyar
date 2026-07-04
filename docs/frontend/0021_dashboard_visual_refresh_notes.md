# 0021 — Visual Refresh Dashboard & List Pages

## گام صفر

فایل skill طراحی در مسیر `/mnt/skills/public/frontend-design/SKILL.md` در محیط موجود نبود، بنابراین از زبان بصری مرحله Login redesign و Design System مرحله ۸ استفاده شد:

- primary brand color
- کارت‌های سفید/شفاف
- border ملایم
- shadow سبک
- hover واضح برای آیتم‌های clickable
- فاصله‌گذاری منظم‌تر

## محدوده تغییر

این مرحله فقط بصری است:

- منطق fetch تغییر نکرد.
- رفتار کلیک contacts/products/sales/purchases تغییر نکرد.
- Modal/route حذف نشد.
- migration ندارد.

## تغییرات کلیدی

- `PageHeader` عمومی زیباتر شد: کارت سفید/شفاف، border، shadow و پس‌زمینه ملایم.
- فضای dashboard/list pages به صورت طبیعی از همین PageHeader بهبود گرفت.
- کارت‌های کلیک‌پذیر contacts/products از قبل hover داشتند؛ با header جدید هماهنگ‌تر شدند.
- tableهای sales/purchases رفتار panel-based قبلی را حفظ کردند.

## دلیل انتخاب محافظه‌کارانه

به جای بازنویسی کامل dashboard ۸۰۰+ خطی، تغییرها به اجزای مشترک و کلاس‌های بصری محدود شد تا ریسک شکستن منطق پایین بماند.
