# گزارش گام صفر — Frontend Core Runtime / PanelManager

> نوع بررسی: فقط خواندن کد، بدون تغییر  
> هدف: تعیین معماری دقیق نصب Core Runtime بر اساس ساختار واقعی پروژه

---

## 1) استک واقعی Frontend

| مورد | وضعیت |
|---|---|
| Framework | Next.js `14.2.15` |
| Router | App Router (`app/`) |
| TypeScript | فعال، `strict: true` |
| Styling | Tailwind CSS + CSS variables |
| UI Library | shadcn کامل وجود ندارد؛ کامپوننت‌های custom در `components/shared/ui.tsx` |
| State global | Redux/Zustand وجود ندارد |
| Data fetching | React Query (`@tanstack/react-query`) |
| Supabase | `@supabase/ssr` browser/server clients |
| RTL | `html lang="fa" dir="rtl"` در `app/layout.tsx` |
| Font | Vazirmatn از CDN در `globals.css` |

### نتیجه معماری

چون Zustand/Redux در پروژه وجود ندارد، `PanelManager` با **React Context + reducer** پیاده‌سازی می‌شود تا dependency جدید اضافه نشود و ریسک build پایین بماند.

---

## 2) ساختار پوشه فعلی

پروژه در ریشه کار می‌کند و هنوز `src/` ندارد. ساختار مهم فعلی:

```text
app/
  layout.tsx
  (app)/layout.tsx
  (app)/dashboard/page.tsx
  (app)/sales/...
  (app)/products/...
  (app)/contacts/...

components/
  providers.tsx
  shared/
    app-shell.tsx
    sidebar.tsx
    header.tsx
    ui.tsx
    product-selector.tsx
    contact-selector.tsx
    entity-link.tsx
    ...

lib/
  supabase/client.ts
  supabase/server.ts
  hooks/
  utils/
  entities/

types/
  db.ts
```

### تصمیم

طبق درخواست فاز B، پوشه جدید `src/` اضافه می‌شود، اما بدون جابه‌جایی کدهای فعلی:

```text
src/core/panel-manager/
src/core/picker/
src/core/services/
src/shared/panels/
src/shared/pickers/
```

Alias فعلی TypeScript این است:

```json
"@/*": ["./*"]
```

پس فایل‌های جدید از مسیر `@/src/...` قابل import هستند.

---

## 3) Supabase Client فعلی

فایل فعلی:

```text
lib/supabase/client.ts
```

محتوا:

```ts
createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

یعنی Frontend با anon key و session کاربر authenticated کار می‌کند، نه service_role. این با قرارداد امنیتی فاز A سازگار است.

### تصمیم

برای Core Runtime، client جدید تکراری ساخته نمی‌شود. Service layer جدید از همین client موجود استفاده می‌کند:

```text
src/core/services/search-service.ts
```

و picker مستقیماً Supabase را صدا نمی‌زند؛ فقط service را صدا می‌زند.

---

## 4) Modalهای فعلی

پروژه modalهای زیادی دارد و همه local state هستند. نمونه‌ها:

| فایل | Modal / Pattern |
|---|---|
| `dashboard/page.tsx` | `QuickSaleModal`, `QuickTxModal` |
| `sales/page.tsx` | `PosModal` |
| `sales/[id]/page.tsx` | `EditInvoiceModal`, `CancelSaleModal`, `SalePaymentModal` |
| `purchases/page.tsx` | `PurchaseModal` |
| `purchases/[id]/page.tsx` | `EditPurchaseModal`, `CancelPurchaseModal`, `PurchasePaymentModal` |
| `products/page.tsx` | `ProductModal` |
| `products/[id]/page.tsx` | `ProductEditModal`, `PriceChangeModal`, `AdjustModal` |
| `contacts/page.tsx` | `ContactModal` |
| `contacts/[id]/page.tsx` | `ContactEditModal`, `InteractionModal`, `TxModal` |
| `settings/page.tsx` | `AccountModal`, `CreateUserModal` |
| `components/shared/product-selector.tsx` | Product selector modal |
| `components/shared/contact-selector.tsx` | Contact selector/create modal |

### نتیجه

Core Runtime در این مرحله **هیچ modal فعلی را حذف یا تغییر نمی‌دهد** و موازی نصب می‌شود. در مراحل بعدی، هر modal به‌تدریج به Panel تبدیل می‌شود.

---

## 5) RTL و فارسی

- `app/layout.tsx` دارای `dir="rtl"` است.
- `globals.css` فونت Vazirmatn را وارد کرده است.
- utilityهای عدد/تاریخ فارسی در `lib/utils/format.ts` وجود دارند.
- AppShell و Sidebar راست‌چین هستند.

### تصمیم

Panel drawer از سمت راست slide-in می‌شود چون کاربر فارسی/RTL انتظار panel عملیاتی از سمت راست را دارد. Overlay stack با `right: 0` و z-index افزایشی پیاده‌سازی می‌شود.

---

## 6) routeهای فعلی

Routeهای مهم موجود:

```text
/dashboard
/sales
/sales/[id]
/sales/orders
/sales/returns
/purchases
/purchases/[id]
/purchases/returns
/products
/products/[id]
/contacts
/contacts/[id]
/inventory/...
/finance/...
/crm/...
/loyalty/...
/reports/...
/settings/...
/login
/register
/setup
```

Core Runtime روی همه routeها نصب می‌شود ولی فقط در صورت استفاده از APIهای `openEntity/openDocument/openPicker` فعال می‌شود.

---

## 7) Provider سراسری

Provider فعلی:

```text
components/providers.tsx
```

شامل:

```text
QueryClientProvider
ThemeProvider
```

### تصمیم نصب

`PanelManagerProvider` و `PickerProvider` در همین فایل اضافه می‌شوند:

```text
QueryClientProvider
  ThemeProvider
    PanelManagerProvider
      PickerProvider
        children
        PanelHost
        PickerHost
        CoreRuntimeDevButton
```

به این شکل اپ فعلی دست‌نخورده می‌ماند و فقط لایه overlay جدید اضافه می‌شود.

---

## 8) Proof of Concept بدون مزاحمت برای اپ فعلی

برای جلوگیری از نمایش دکمه تستی به همه کاربران، PoC فقط با query param فعال می‌شود:

```text
?core_poc=1
```

در این حالت یک دکمه کوچک موقت نمایش داده می‌شود:

```text
تست Core Runtime
```

رفتار:

1. باز کردن `openPicker('contact')`
2. جستجو با `fn_global_search`
3. انتخاب contact
4. باز شدن placeholder `ContactPanel`
5. داخل placeholder دکمه بازکردن نمونه `ProductPanel`
6. تست stack: product روی contact، بستن product برگشت به contact، بستن contact برگشت به workspace

---

## 9) انتخاب‌های کلیدی

| تصمیم | دلیل |
|---|---|
| Context + reducer به جای Zustand | پروژه dependency state manager ندارد؛ ریسک کمتر |
| نصب در `components/providers.tsx` | App Router و Provider سراسری موجود |
| استفاده از `lib/supabase/client.ts` | جلوگیری از client تکراری و رعایت anon/authenticated key |
| مسیر `src/core/...` | شروع فاز B بدون جابه‌جایی معماری فعلی |
| فعال‌سازی PoC با query param | عدم مزاحمت برای کاربران فعلی |
| عدم حذف modalهای فعلی | مهاجرت تدریجی و امن |
