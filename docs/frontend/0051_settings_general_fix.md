# 0051 — Settings general card fix

## مشکل
کارت «عمومی» و کارت «کاتالوگ» در `/settings` هر دو به مسیر یکسان می‌رفتند:

```text
/settings/catalog
```

## بررسی گام صفر
جستجو برای صفحه تنظیمات عمومی مستقل انجام شد:

```text
اطلاعات کسب‌وکار
organization settings
theme settings
```

صفحه مستقلی برای تنظیمات عمومی وجود نداشت. ThemeSettings داخل `/settings` بود اما route جدا نداشت.

## اصلاح انجام‌شده
صفحه جدید ساخته شد:

```text
app/(app)/settings/general/page.tsx
```

محتوا:

- نمایش و ویرایش نام سازمان از جدول `organizations`
- انتخاب Theme با همان منطق موجود `applyTheme/THEMES/THEME_STORAGE_KEY`
- پیام placeholder برای تنظیمات عمومی فاکتور آینده، بدون تغییر منطق فاکتور

کارت «عمومی» حالا به این مسیر وصل است:

```text
/settings/general
```

کارت «کاتالوگ» همچنان به مسیر خودش می‌رود:

```text
/settings/catalog
```

## Build/Test

```text
next build: passed
vitest: passed
```
