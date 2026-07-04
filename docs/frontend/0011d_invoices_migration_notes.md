# مرحله ۱۱-د — مهاجرت کلیک لیست‌های سند به InvoicePanel

## گام صفر

### 1) ساختار `/sales`

مسیر:

```text
app/(app)/sales/page.tsx
```

ساختار:

- لیست فروش‌ها به صورت table است.
- query از جدول `sales` می‌خواند.
- شماره فاکتور با `components/shared/entity-link.tsx` قدیمی route-based نمایش داده می‌شد.
- کلیک روی شماره فاکتور به `/sales/[id]` می‌رفت.
- خود ردیف `<tr>` قبلاً رفتار کلیک نداشت.
- دکمه «فروش جدید» Modal قدیمی `PosModal` را باز می‌کند.

تصمیم:

- کلیک ساده روی ردیف/شماره فاکتور → `openDocument('sale', id)`.
- Ctrl/Cmd/middle-click → `/sales/[id]` fallback.
- دکمه «فروش جدید» تغییر نکرد چون InvoicePanel هنوز create/edit اقلام سند از صفر ندارد.

---

### 2) ساختار `/purchases`

مسیر:

```text
app/(app)/purchases/page.tsx
```

ساختار:

- لیست خریدها به صورت table است.
- شماره خرید با EntityLink قدیمی route-based نمایش داده می‌شد.
- کلیک روی شماره خرید به `/purchases/[id]` می‌رفت.
- خود ردیف قبلاً رفتار کلیک نداشت.
- دکمه «خرید جدید» Modal قدیمی `PurchaseModal` را باز می‌کند.

تصمیم:

- کلیک ساده روی ردیف/شماره خرید → `openDocument('purchase', id)`.
- Ctrl/Cmd/middle-click → `/purchases/[id]` fallback.
- دکمه «خرید جدید» تغییر نکرد چون InvoicePanel هنوز create/edit سند خرید از صفر ندارد.

---

### 3) Dashboard Recent Invoices

مسیر:

```text
app/(app)/dashboard/page.tsx
```

بخش:

```text
آخرین فاکتورها
```

داده:

```text
recentSales
```

از جدول `sales` می‌آید؛ پس doc_type ثابتاً `sale` است. لیست mixed sale/purchase نیست.

رفتار قبلی:

- کلیک روی شماره فاکتور با EntityLink قدیمی به `/sales/[id]` می‌رفت.
- خود row div کلیک نداشت.

تصمیم:

- کلیک ساده روی row/شماره → `openDocument('sale', id)`.
- Ctrl/Cmd/middle-click → `/sales/[id]` fallback.

---

### 4) شکاف‌های InvoicePanel نسبت به صفحات کامل

صفحه کامل `/sales/[id]` هنوز امکاناتی دارد که InvoicePanel ندارد:

- `EditInvoiceModal` برای ویرایش اقلام و مشتری و تخفیف/مالیات
- `CancelSaleModal` با RPC legacy `cancel_sale`
- `SalePaymentModal` با RPC legacy `record_sale_payment`
- چاپ فاکتور
- خروجی CSV
- نمایش پرداخت‌ها/returns legacy

صفحه کامل `/purchases/[id]` نیز دارد:

- `EditPurchaseModal`
- `CancelPurchaseModal`
- `PurchasePaymentModal`
- چاپ
- تاریخچه پرداخت/انبار legacy

InvoicePanel جدید دارد:

- view سند
- اقلام
- مالی
- workflow استاندارد `fn_transition_document`
- پرداخت استاندارد `fn_register_payment`

### ناسازگاری رفتاری مهم

صفحات کامل قدیمی هنوز اجازه edit/cancel/payment legacy می‌دهند، حتی برای برخی statusها که در Workflow جدید مسیر متفاوت دارد.

برای جلوگیری از از دست رفتن قابلیت کاربر، در InvoicePanel دکمه fallback اضافه شد:

```text
مشاهده/ویرایش کامل در صفحه اختصاصی
```

---

### 5) دکمه سند جدید

در این مرحله دکمه «سند جدید → پنل جدید» اضافه نشد.

دلیل:

- InvoicePanel هنوز ساخت سند از صفر و ویرایش اقلام سند را ندارد.
- مسیرهای قدیمی `PosModal` و `PurchaseModal` همچنان کامل‌تر هستند.

پس فقط مسیر قدیمی حفظ شد.

---

## رفتار جدید

| محل | کلیک ساده | Ctrl/Cmd click | Middle click |
|---|---|---|---|
| `/sales` ردیف فروش | InvoicePanel sale | `/sales/[id]` تب جدید | `/sales/[id]` تب جدید |
| `/purchases` ردیف خرید | InvoicePanel purchase | `/purchases/[id]` تب جدید | `/purchases/[id]` تب جدید |
| Dashboard recent invoices | InvoicePanel sale | `/sales/[id]` تب جدید | `/sales/[id]` تب جدید |

---

## محدودیت URL/refresh

همان محدودیت قبلی برقرار است: پنل بازشده در URL sync نمی‌شود و با refresh بسته می‌شود.
