# مرحله ۱۱-ب — مهاجرت کلیک لیست Contacts به ContactPanel

## گام صفر

### 1) تفکیک دو EntityLink

دو کامپوننت با نام مشابه وجود دارد:

#### EntityLink قدیمی — route-based

مسیر:

```text
components/shared/entity-link.tsx
```

رفتار:

- از `next/link` استفاده می‌کند.
- با `getEntityHref(type,id)` مسیر می‌سازد.
- کلیک معمولی باعث navigate به route قدیمی می‌شود.
- در 26 فایل استفاده شده است.

فایل‌های استفاده‌کننده:

```text
app/(app)/activity/page.tsx
app/(app)/checks/page.tsx
app/(app)/contacts/[id]/page.tsx
app/(app)/contacts/page.tsx
app/(app)/crm/rfm/page.tsx
app/(app)/dashboard/page.tsx
app/(app)/inventory/as-of/page.tsx
app/(app)/inventory/stock-card/page.tsx
app/(app)/products/[id]/page.tsx
app/(app)/products/page.tsx
app/(app)/purchases/[id]/page.tsx
app/(app)/purchases/page.tsx
app/(app)/purchases/returns/page.tsx
app/(app)/reports/customer-profitability/page.tsx
app/(app)/reports/page.tsx
app/(app)/reports/profitability/page.tsx
app/(app)/sales/[id]/page.tsx
app/(app)/sales/orders/page.tsx
app/(app)/sales/page.tsx
app/(app)/sales/returns/page.tsx
app/(app)/settings/price-lists/page.tsx
components/shared/crm-automation-page.tsx
components/shared/crm-page.tsx
components/shared/finance-operation-page.tsx
components/shared/inventory-operation-page.tsx
components/shared/loyalty-page.tsx
```

#### EntityLink جدید — panel-based

مسیر:

```text
src/core/panel-manager/EntityLink.tsx
```

رفتار:

- button است.
- با `openEntity/openDocument` پنل باز می‌کند.
- route change نمی‌دهد.

### تصمیم

چون EntityLink قدیمی در 26 فایل استفاده شده، ادغام سراسری پرریسک است. در این مرحله فقط:

- کامنت تفکیکی به هر دو فایل اضافه شد.
- فقط صفحه `/contacts` با رفتار panel-based آپدیت شد.
- EntityLink قدیمی حذف/تغییر رفتاری نشد.

---

## 2) رفتار فعلی صفحه `/contacts`

مسیر:

```text
app/(app)/contacts/page.tsx
```

نمایش فعلی:

- لیست به صورت کارت‌های عمودی است، نه table.
- داخل هر کارت از `components/shared/entity-link.tsx` استفاده می‌شد.
- نام contact لینک مستقیم به `/contacts/[id]` بود.
- کلیک روی خود کارت قبلاً رفتار خاصی نداشت.
- دکمه‌های edit/delete و `EntityActionMenu` در سمت چپ کارت وجود دارند.
- دکمه «شخص جدید» مسیر قدیمی `ContactModal` را باز می‌کرد.

---

## 3) قابلیت‌های صفحه کامل `/contacts/[id]` که در ContactPanel فعلی کامل نیست

صفحه کامل contact detail این قابلیت‌ها را دارد:

- تب info با آمار فروش/خرید کامل‌تر
- تب sales با جدول فروش‌ها
- تب purchases با جدول خریدها
- تب transactions با تراکنش‌ها
- دکمه دریافت/پرداخت
- InteractionModal برای CRM interaction
- TxModal برای دریافت/پرداخت مستقیم
- ContactEditModal قدیمی
- EntityActionMenu کامل‌تر

ContactPanel فعلی دارد:

- خلاصه contact
- مانده از `v_contact_balance`
- تب اسناد از `v_documents`
- create/edit/deactivate

### تصمیم

این شکاف‌ها بزرگ هستند، مخصوصاً CRM interactions و پرداخت/دریافت. بنابراین در این مرحله بازسازی نمی‌شوند. به‌جای آن fallback page حفظ می‌شود و لینک «مشاهده صفحه کامل» به ContactPanel اضافه می‌شود تا کاربر اگر امکانات کامل‌تر خواست، به صفحه قدیمی برود.

---

## 4) لینک‌های مستقیم به `/contacts/[id]`

لینک مستقیم در جاهای زیادی ساخته می‌شود، از جمله:

- reports
- dashboard
- sales/purchases detail
- CRM pages
- checks
- inventory/report pages

بنابراین `/contacts/[id]` باید حفظ شود. در این مرحله route یا صفحه کامل حذف نشد.

---

## 5) محدودیت URL/refresh

PanelManager فعلی state را در URL sync نمی‌کند.

یعنی:

```text
اگر کاربر روی contact کلیک کند و پنل باز شود، سپس صفحه را refresh کند، پنل بسته می‌شود.
```

این محدودیت شناخته‌شده است و در این مرحله حل نشد.

راه‌حل آینده:

```text
?panel=contact&id=...
```

یا route interception / parallel routes در Next.js App Router.

---

## 6) رفتار جدید `/contacts`

- کلیک ساده روی کارت contact → `openEntity('contact', id, { mode:'view' })`
- Ctrl/Cmd+Click روی کارت → باز شدن `/contacts/[id]` در تب جدید
- Middle-click روی کارت → باز شدن `/contacts/[id]` در تب جدید
- لینک نام همچنان `href=/contacts/[id]` دارد، اما کلیک معمولی پنل باز می‌کند و Ctrl/Cmd حفظ می‌شود
- دکمه‌های edit/delete/EntityActionMenu propagation را متوقف می‌کنند
- دکمه قدیمی «شخص جدید» باقی ماند
- دکمه جدید «پنل جدید» اضافه شد که `openEntity('contact', undefined, {mode:'create'})` را باز می‌کند

---

## 7) تصمیم نهایی درباره entity-link.tsx قدیمی

ادغام انجام نشد. دلیل:

- usage زیاد: 26 فایل
- تغییر رفتاری سراسری پرریسک است
- هنوز همه Panelها/رفتارها جایگزین کامل routeهای قدیمی نشده‌اند

فقط مستندسازی/کامنت تفکیکی انجام شد.
