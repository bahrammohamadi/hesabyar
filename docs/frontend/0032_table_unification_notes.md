# 0032 — یکسان‌سازی بخشی از جداول legacy با DataTable

## grep اولیه
جستجو با دستور زیر انجام شد:

```bash
grep -R "table-base" -n --exclude-dir=node_modules --exclude-dir=.next app components src
```

## تغییر پایه در DataTable
فایل: `src/shared/ui/Table.tsx`
- prop اختیاری `getRowProps` اضافه شد تا جدول‌هایی که قبلاً رفتار row-click، keyboard Enter، aux-click و className ردیفی داشتند بدون تغییر رفتار به `DataTable` منتقل شوند.
- رفتار قبلی DataTable برای مصرف‌کنندگان موجود تغییر نکرد؛ prop جدید اختیاری است.

## جداول تبدیل‌شده
### `/sales`
فایل: `app/(app)/sales/page.tsx`
- جدول لیست فروش از `<table className="table-base">` به `DataTable` تبدیل شد.
- ستون‌های قبلی بدون تغییر حفظ شدند:
  - شماره فاکتور، تاریخ، مشتری، مبلغ، نسیه، وضعیت
- رفتارهای قبلی حفظ شدند:
  - کلیک روی ردیف → باز شدن `InvoicePanel`
  - Ctrl/Cmd/Middle click → fallback route
  - لینک شماره فاکتور با stopPropagation
  - EntityActionMenu مشتری

### `/purchases`
فایل: `app/(app)/purchases/page.tsx`
- جدول لیست خرید از `table-base` به `DataTable` تبدیل شد.
- ستون‌های قبلی بدون تغییر حفظ شدند:
  - شماره، تاریخ، تامین‌کننده، مبلغ، پرداخت‌شده
- رفتارهای row-click و fallback route حفظ شد.

### `/reports/sellers`
فایل: `app/(app)/reports/sellers/page.tsx`
- جدول عملکرد فروشنده به `DataTable` تبدیل شد.
- ستون‌های قبلی بدون تغییر حفظ شدند.
- این جدول row action پیچیده نداشت، پس تبدیل کم‌ریسک بود.

### `/inventory/as-of`
فایل: `app/(app)/inventory/as-of/page.tsx`
- جدول موجودی در تاریخ مشخص به `DataTable` تبدیل شد.
- ستون‌های قبلی بدون تغییر حفظ شدند:
  - کالا، تنوع، کد/SKU، موجودی، قیمت خرید، ارزش، عملیات
- EntityLink و EntityActionMenu حفظ شد.

## جداول ردشده و دلیل
### `app/(app)/contacts/[id]/page.tsx`
- چند جدول داخل صفحه جزئیات مخاطب دارد که با تب‌ها/مودال‌های legacy و context جزئیات درهم‌تنیده‌اند.
- تبدیل نیازمند ممیزی جدا برای عملیات مالی/CRM مخاطب است.

### `app/(app)/products/[id]/page.tsx`
- چند جدول مربوط به تاریخچه قیمت، گردش انبار، تراکنش‌ها و عملیات پیشرفته دارد.
- برخی جدول‌ها با modal/actionهای حساس موجودی و قیمت کار می‌کنند؛ برای کم‌ریسک بودن فعلاً رد شد.

### `app/(app)/crm/rfm/page.tsx`
- جدول تحلیلی RFM با ساختار اختصاصی گزارش CRM است.
- نیازمند بررسی visual/report جداست.

### `app/(app)/inventory/stock-card/page.tsx`
- جدول کارت کالا با محاسبات گردش و ستون‌های زمانی است.
- ریسک تغییر خوانایی/ستون‌ها بالاتر از swap ساده بود.

### `app/(app)/reports/customer-profitability/page.tsx`
### `app/(app)/reports/profitability/page.tsx`
- گزارش‌های profitability ستون‌های زیاد، export و renderهای فشرده/inline دارند.
- برای جلوگیری از تغییر ناخواسته در خروجی گزارش و export، در این commit دست‌نخورده ماندند.

## grep بعد از تبدیل
بعد از تبدیل، `table-base` هنوز فقط در موارد ردشده بالا و تعریف CSS باقی مانده است؛ در `/sales`، `/purchases`، `/reports/sellers` و `/inventory/as-of` حذف شد.

## تغییر نکرد
- هیچ fetch/mutation/RPC تغییر نکرد.
- هیچ ستون داده‌ای حذف یا اضافه نشد.
- هیچ محاسبه مالی/انبار تغییر نکرد.
