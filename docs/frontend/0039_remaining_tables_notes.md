# 0039 — Remaining legacy tables audit

## تبدیل‌شده در این مرحله

### `/crm/rfm`

فایل:

```text
app/(app)/crm/rfm/page.tsx
```

جدول RFM از `table-base` به `DataTable` تبدیل شد. ستون‌ها حفظ شدند:

- مشتری
- آخرین خرید
- R/F/M
- کد RFM
- گروه
- اقدام پیشنهادی
- عملیات

### `/inventory/stock-card`

فایل:

```text
app/(app)/inventory/stock-card/page.tsx
```

جدول کاردکس کالا از `table-base` به `DataTable` تبدیل شد. ستون‌ها حفظ شدند:

- تاریخ
- نوع
- دلیل
- تعداد
- مانده
- مرجع
- توضیح

## موارد بررسی‌شده اما ردشده

### `contacts/[id]`

سه جدول sales/purchases/tx دارد، اما صفحه هنوز `ContactEditModal` legacy را نگه داشته چون فیلد `code` در آن قابل ویرایش است و ContactPanel هنوز code را read-only نشان می‌دهد. برای جلوگیری از تغییر همزمان رفتار detail page، تبدیل tableهای این صفحه به refactor جدا موکول شد.

### `products/[id]`

چند جدول history/sales/purchases/movements دارد و همزمان قبلاً modalهای price/adjust/edit از آن حذف شده‌اند. برای کم‌ریسک نگه داشتن تغییرات، تبدیل جدول‌های این صفحه به commit جدا موکول شد.

### `reports/customer-profitability`
### `reports/profitability`

این گزارش‌ها export حساس و محاسبات سود/بهای تمام‌شده دارند و جدول‌های فشرده inline دارند. تبدیل آن‌ها به DataTable نیازمند تست دقیق export و محاسبات است؛ بنابراین در این مرحله رد شدند.

## grep باقی‌مانده

پس از این مرحله `table-base` هنوز در این مسیرها باقی است:

```text
contacts/[id]
products/[id]
reports/customer-profitability
reports/profitability
```

## تغییر نکرد

- هیچ fetch/mutation/RPC تغییر نکرد.
- هیچ ستون گزارش حذف نشد.
- فقط rendering دو جدول کم‌ریسک به DataTable منتقل شد.
