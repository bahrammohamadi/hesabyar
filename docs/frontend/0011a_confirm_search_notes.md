# مرحله ۱۱-الف — ConfirmDialog + GlobalSearchBar

## گام صفر

### 1) Modal/Dialog موجود

در پروژه یک Modal عمومی وجود دارد:

```text
components/shared/ui.tsx → Modal
```

این Modal برای UI قدیمی مناسب است اما:

- Promise-based نیست.
- tone/variant برای confirm/danger ندارد.
- hook `useConfirm()` ندارد.
- به Design System جدید `src/shared/ui` تعلق ندارد.

بنابراین برای فاز B، یک ConfirmDialog مستقل در مسیر زیر ساخته شد:

```text
src/shared/ui/ConfirmDialog.tsx
```

و از کامپوننت‌های Design System جدید مثل `Button` استفاده می‌کند.

---

### 2) Header/Layout اصلی

Layout عملیاتی:

```text
app/(app)/layout.tsx → AppShell
components/shared/app-shell.tsx → Header
components/shared/header.tsx
```

Header فعلی شامل:

- دکمه منوی موبایل
- تاریخ شمسی در desktop
- اعلان‌ها
- user area
- logout

فضای مرکزی header برای نوار جستجوی سراسری مناسب است. GlobalSearchBar در همین header نصب شد.

---

### 3) Searchهای محلی موجود

صفحات زیادی input جستجوی محلی دارند، مثل:

```text
/contacts → جستجوی نام
/products → جستجوی نام/کد/SKU
/checks → جستجوی چک
/sales/orders → جستجوی سفارش
/inventory/as-of → جستجوی کالا
```

این‌ها جستجوی محلی همان صفحه هستند و حذف/تغییر نشدند.

GlobalSearchBar جدید در Header برای جستجوی همه‌جای سیستم است و نتیجه را به PanelManager وصل می‌کند.

---

### 4) تصمیم UX برای Global Search

تصمیم:

```text
input کوچک همیشه‌قابل‌مشاهده در desktop/tablet header + shortcut Ctrl/Cmd+K
```

رفتار:

- فوکوس روی input یا Ctrl/Cmd+K → dropdown باز می‌شود.
- تایپ با debounce → `fn_global_search` از طریق `search-service`.
- ArrowUp/ArrowDown/Enter/Esc پشتیبانی می‌شود.
- کلیک بیرون dropdown را می‌بندد.

دلیل:

- برای ERP/POS سرعت مهم است.
- کاربر حرفه‌ای با keyboard shortcut سریع‌تر کار می‌کند.
- همیشه‌قابل‌مشاهده بودن در header discoverability را بالا می‌برد.

---

## ConfirmDialog API

```ts
const confirm = useConfirm();
const ok = await confirm({
  title: "برگشت سند",
  description: "⚠️ این عملیات موجودی را برمی‌گرداند...",
  tone: "danger",
  confirmLabel: "برگشت سند",
  cancelLabel: "انصراف",
});
```

خروجی:

```ts
Promise<boolean>
```

---

## InvoicePanel changes

همه `window.confirm`ها حذف و با `useConfirm` جایگزین شدند:

- تأیید سند
- تسویه
- برگشت سند
- هشدار overpay

متن‌های فارسی حفظ شدند و reverse با tone danger نمایش داده می‌شود.

---

## GlobalSearchBar behavior

مسیر:

```text
src/shared/layout/GlobalSearchBar.tsx
```

نتیجه‌ها:

| result_type | action |
|---|---|
| contact | `openEntity('contact', id)` |
| product | `openEntity('product', id)` |
| document | `openDocument(docType, id)` |

برای document، `docType` از `item.meta.doc_type` خوانده می‌شود.
