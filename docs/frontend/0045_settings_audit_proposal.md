# 0045 — Settings audit and simplification proposal

## صفحات فعلی زیر Settings

```text
/settings
/settings/catalog
/settings/accounts
/settings/users
/settings/price-lists
```

## بخش‌های داخل settings/page.tsx

### تنظیمات پایه / Catalog

```text
ThemeSettings
categories
brands
expense_categories
```

### حساب‌ها

```text
AccountsManager
```

### کاربران و دسترسی‌ها

```text
UsersAccessManager
CreateUserModal
Role/permissions editor
```

### لیست قیمت‌ها

```text
/settings/price-lists
```

## تحلیل کاربرد

### پرکاربرد مدیریتی

```text
کاربران و دسترسی‌ها
حساب‌ها
دسته‌بندی کالا
برندها
دسته‌بندی هزینه
```

### متوسط

```text
لیست قیمت‌ها
Theme / ظاهر برنامه
```

### کم‌تکرار / پیشرفته

```text
permissions جزئی
تنظیمات باشگاه مشتریان
تنظیمات گزارش/اتوماسیون آینده
```

## مشکل فعلی

- `/settings` چند حوزه نامرتبط را کنار هم نشان می‌دهد.
- کاربران/دسترسی‌ها، حساب‌ها و catalog همگی در یک صفحه بلند هستند.
- لیست قیمت‌ها در sidebar زیر کالا آمده، ولی از نظر تنظیماتی هم هست.
- ThemeSettings کنار دسته‌بندی‌هاست و ممکن است برای مدیر فروشگاه کم‌اهمیت باشد.

## پیشنهاد ساختار جدید — فقط پیشنهاد، بدون اجرا

```text
/settings
  داشبورد تنظیمات با کارت‌های بزرگ

/settings/general
  اطلاعات کسب‌وکار
  ظاهر برنامه / Theme
  تنظیمات عمومی فاکتور

/settings/users
  کاربران
  نقش‌ها
  دسترسی‌ها

/settings/finance
  حساب‌ها
  دسته‌بندی هزینه
  روش‌های پرداخت

/settings/catalog
  دسته‌بندی کالا
  برندها
  لیست قیمت‌ها

/settings/advanced
  audit/activity
  تنظیمات باشگاه
  API/SMS integrations آینده
```

## پیشنهاد UI

- صفحه `/settings` فقط یک landing ساده باشد با کارت‌های:
  - عمومی
  - کاربران و دسترسی‌ها
  - مالی
  - کالا و قیمت
  - پیشرفته
- صفحات عملیاتی هرکدام جدا باشند.
- نقش `owner` فقط settings کامل را ببیند؛ manager نهایتاً بخشی از catalog/finance را ببیند.

## تصمیم‌های مورد نیاز

1. آیا ThemeSettings واقعاً باید در تنظیمات باشد یا در پروفایل/ظاهر؟
2. آیا لیست قیمت‌ها زیر «کالا» بماند یا زیر Settings/Catalog منتقل شود؟
3. آیا فعالیت کاربران باید زیر گزارش‌ها بماند یا Settings/Advanced؟
