# 0038 — CRM/Loyalty/Settings visual refresh

## صفحات بررسی‌شده

```text
/crm
/crm/interactions
/crm/segments
/crm/loyalty
/crm/automation
/crm/rfm
/loyalty
/loyalty/points
/loyalty/wallet
/loyalty/campaigns
/loyalty/settings
/settings
/settings/catalog
/settings/accounts
/settings/users
/settings/price-lists
```

## تغییرات انجام‌شده

فایل‌های مشترک زیر به زبان بصری جدید نزدیک شدند:

```text
components/shared/crm-page.tsx
components/shared/crm-automation-page.tsx
components/shared/loyalty-page.tsx
app/(app)/settings/page.tsx
```

الگوی اعمال‌شده:

- حفظ `PageHeader`
- کارت‌های rounded با border سفید/نیمه‌شفاف
- shadow نرم هماهنگ با finance/inventory
- hover ملایم روی کارت‌های لیستی
- ساختار `space-y-5` برای صفحات اصلی

## صفحات پوشش‌داده‌شده با همین کامپوننت‌ها

- `/crm`, `/crm/interactions`, `/crm/segments`, `/crm/loyalty`
- `/crm/automation`
- `/loyalty/*`
- `/settings`, `/settings/catalog`, `/settings/accounts`, `/settings/users`

## صفحات باقی‌مانده

- `/crm/rfm`: به دلیل داشتن جدول تحلیلی اختصاصی و تبدیل برنامه‌ریزی‌شده در بخش ۳، در این commit فقط ممیزی شد و تغییر اصلی آن به بخش جدول‌ها موکول شد.
- `/settings/price-lists`: ساختار عملیاتی و picker دارد؛ برای کنترل ریسک در این commit تغییر ظاهری گسترده نگرفت.

## تغییر نکرد

- هیچ fetch/mutation/RPC تغییر نکرد.
- هیچ ستون یا داده‌ای حذف نشد.
- فقط classNameهای presentation تغییر کردند.
