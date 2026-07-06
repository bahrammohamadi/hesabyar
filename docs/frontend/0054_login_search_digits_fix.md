# 0054 — Login desktop scroll and Persian/English digit search

## Login desktop

`app/login/page.tsx` اصلاح شد:

- `overflow-hidden` از صفحه اصلی حذف شد.
- صفحه ورود اکنون `overflow-y-auto` دارد.
- پنل معرفی سمت چپ در دسکتاپ `max-h` و scroll داخلی دارد تا فرم نام کاربری/رمز همیشه قابل دسترس باشد.

## جستجوی عدد فارسی/انگلیسی

تابع مشترک اضافه شد:

```text
normalizeSearchText
```

در:

```text
lib/utils/format.ts
```

این تابع اعداد فارسی/عربی را به انگلیسی تبدیل و متن را lowercase/trim می‌کند.

مسیرهای اصلاح‌شده:

```text
contacts page
products hook/useProducts
ContactSelector
ProductSelector
GlobalSearch service
inventory/as-of
CRM search
Loyalty search
```

هدف: جستجوی `۰۹۱۱` و `0911` نتیجه یکسان بدهد.
