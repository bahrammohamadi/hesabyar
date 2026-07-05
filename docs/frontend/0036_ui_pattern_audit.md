# 0036 — UI/mobile bug pattern audit

## هدف
ممیزی الگوهای مشابه باگ‌های اخیر:

- دکمه بی‌عمل MoreVertical/«گزینه‌ها»
- overlay باقی‌مانده زیر پنل و مسدودکردن input
- input قفل‌شونده DatePicker
- لیست‌های موبایل با `max-h-[Xvh]` ثابت و فضای سفید پایین

## 1) MoreVertical / دکمه «گزینه‌ها»
جستجو انجام شد برای:

```bash
grep -R "MoreVertical\|aria-label=\"گزینه" app components src
```

نتیجه:

- `PanelShell` قبلاً دکمه پیش‌فرض بی‌عمل داشت و در commit قبلی حذف شد.
- `ContactPanel`, `ProductPanel`, `InvoicePanel` دکمه‌های placeholder بی‌عمل داشتند و حذف شدند.
- مورد باقی‌مانده مهم:
  - `components/shared/entity-action-menu.tsx` — واقعی است و منو باز می‌کند، حذف نشد.
- مورد dev فقط:
  - `app/(app)/dev/ui/page.tsx` — صفحه نمونه Design System است، production flow نیست.

## 2) overlay زیر پنل جدید
جستجو برای `openEntityForResult` نشان داد:

```text
components/shared/contact-selector.tsx
components/shared/product-selector.tsx
```

اصلاحات:

- `ContactSelector`: قبل از باز کردن ContactPanel، selector بسته می‌شود.
- `ProductSelector`: دکمه «افزودن کالای جدید» اضافه شد و قبل از باز کردن ProductPanel، selector بسته می‌شود.
- `ProductPanel`: برای create از picker، result برمی‌گرداند تا اگر variant ساخته شد همان variant به فاکتور انتخاب شود.

## 3) لیست‌های `max-h-[Xvh]`
جستجو انجام شد برای:

```bash
grep -R "max-h-\[[0-9].*vh\]" app components src
```

موارد اصلاح‌شده:

- `components/shared/contact-selector.tsx`
- `components/shared/product-selector.tsx`
- `components/shared/ui.tsx` برای ساختار modal موبایل

موارد باقی‌مانده با ریسک کمتر/نیازمند refactor جدا:

```text
app/(app)/dashboard/page.tsx
app/(app)/sales/page.tsx
app/(app)/purchases/page.tsx
app/(app)/sales/[id]/page.tsx
app/(app)/purchases/[id]/page.tsx
app/(app)/purchases/returns/page.tsx
src/core/picker/PickerHost.tsx
```

دلیل عدم تغییر فوری همه موارد: این‌ها داخل modalهای پیچیده invoice/cart یا picker عمومی هستند و تبدیل به flex کامل باید همراه تست flow فروش/خرید انجام شود تا layout جمع کل/دکمه ثبت نشکند.

## 4) DatePicker
تمام استفاده‌های DatePicker بررسی شد. چون اصلاح در فایل مشترک انجام شده، همه مسیرهای زیر از fix بهره‌مند شدند:

```text
contacts detail/edit
ContactPanel birth date
checks
crm/rfm
inventory/as-of
inventory/stock-card
sales/[id]
purchases/[id]
reports profitability/customer/sellers
crm automation follow-up
```

## 5) فرم‌های فروش/خرید و Modalهای قدیمی
موارد دارای modal و فرم پیچیده:

```text
PosModal / QuickSaleModal / PurchaseModal
EditSale/EditPurchase modal
PurchaseReturnModal
```

یافته‌ها:

- دکمه بی‌عمل MoreVertical در این flowها پیدا نشد.
- مشکل اصلی reported مربوط به بازکردن پنل entity از داخل selector بود که برای contact/product selector اصلاح شد.
- لیست‌های cart هنوز `max-h-[40-42vh]` دارند و باید در فاز جدا به layout flex کامل تبدیل شوند.

## اصلاحات انجام‌شده در این مرحله

- بستن ContactSelector قبل از باز کردن ContactPanel.
- افزودن «افزودن کالای جدید» به ProductSelector.
- بستن ProductSelector قبل از باز کردن ProductPanel.
- افزودن result-return به ProductPanel برای picker flow.
- تمام‌عرض کردن PanelHost روی موبایل.
- تبدیل لیست ContactSelector/ProductSelector به `flex-1 overflow-y-auto`.
- اصلاح DatePicker قفل‌شونده.
