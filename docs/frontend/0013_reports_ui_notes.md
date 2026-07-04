# مرحله ۱۳ — گزارش‌های View-based جدید

## گام صفر

### 1) ساختار فعلی `/reports`

مسیر اصلی legacy:

```text
app/(app)/reports/page.tsx
```

این صفحه خودش یک گزارش چندتب دارد و شامل تب‌های زیر است:

```text
sales
products
financial
contacts
profit
```

این صفحه مستقیماً به Supabase/RPCهای قدیمی وصل است و از Recharts استفاده می‌کند.

همچنین زیرصفحه‌های legacy زیر وجود دارند:

```text
/reports/sales
/reports/products
/reports/financial
/reports/contacts
/reports/profit
/reports/profitability
/reports/customer-profitability
/reports/sellers
```

### تصمیم مسیر جدید

برای جلوگیری از تداخل نامی/رفتاری با گزارش‌های legacy، مسیر جدید ساخته شد:

```text
/reports/overview-v2
```

عنوان فارسی:

```text
گزارش‌های جدید
```

صفحات قدیمی دست‌نخورده ماندند.

---

### 2) Recharts

Recharts از قبل نصب و استفاده شده است:

```text
recharts
```

نمونه استفاده در:

```text
app/(app)/dashboard/page.tsx
app/(app)/reports/page.tsx
```

پس در صفحه جدید هم برای نمودارهای ساده از Recharts استفاده شد.

---

### 3) الگوی CSV

الگوی CSV قبلاً در چند فایل وجود داشت، مثل:

```text
app/(app)/reports/page.tsx
app/(app)/sales/[id]/page.tsx
app/(app)/inventory/as-of/page.tsx
app/(app)/reports/profitability/page.tsx
```

الگوی کلی:

```ts
csvEscape
Blob(text/csv;charset=utf-8)
URL.createObjectURL
anchor.download
```

در صفحه جدید همین الگو با خروجی اعداد خام استفاده شد.

---

### 4) عدم تداخل با گزارش‌های legacy

مسیر جدید `overview-v2` انتخاب شد تا با هیچ‌یک از این مسیرها تداخل نداشته باشد:

```text
sales
products
financial
contacts
profit
profitability
customer-profitability
sellers
```

---

## Service Layer

فایل ساخته‌شده:

```text
src/core/services/reports-service.ts
```

همه توابع فقط خواندنی هستند و مستقیماً از viewهای فاز A می‌خوانند.

---

## Viewهای مصرف‌شده

```text
v_daily_sales
v_customer_debt
v_product_profitability
v_top_products
v_monthly_profit
v_purchase_summary
```

همه با `security_invoker=true` ساخته شده‌اند، پس RLS/Org scope رعایت می‌شود.

---

## Export CSV

در این مرحله فقط CSV ساده اضافه شد:

- بدون کتابخانه سنگین
- UTF-8 BOM برای Excel
- اعداد خام در CSV باقی می‌مانند
- نمایش UI فارسی است، اما CSV برای پردازش بهتر خام است

Excel/PDF فارسی حرفه‌ای به مرحله بعدی موکول شد.
