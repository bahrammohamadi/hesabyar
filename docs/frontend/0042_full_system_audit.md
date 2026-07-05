# 0042 — Full Panel/Modal emergency audit

## فاز صفر — بررسی فوری آخرین inert fix

### diff آخرین commit مرتبط
commit بررسی‌شده:

```text
b3c2427 fix(ui): inert inactive layers behind panels
```

تغییرات آن:

- `ContactSelector` و `ProductSelector` با `flushSync` قبل از باز شدن پنل بسته می‌شوند.
- `PanelHost` به children مستقیم `document.body` به‌جز خودش `inert` و `aria-hidden` می‌دهد.
- `data-panel-host-root="true"` به root پنل اضافه شد.

### آیا inert فاکتور/POS تنها را خراب می‌کند؟
خیر، از نظر کد inert فقط وقتی اجرا می‌شود که:

```ts
stack.length > 0
```

پس اگر فقط `PosModal` یا `PurchaseModal` به‌تنهایی باز باشد و هیچ panel باز نباشد، inert فعال نمی‌شود.

اما اگر یک panel از قبل در URL/stack باز باشد، app root و هر modal sibling می‌تواند inert شود. بنابراین inert می‌تواند روی flowهای ترکیبی panel+modal اثر بگذارد، اما روی modal تنها نه.

## یافته واقعی با مرورگر
بعد از نصب dependencyهای Chromium، Playwright اجرا شد و مشکل واقعی با مشاهده‌ی `elementFromPoint` پیدا شد.

### وضعیت قبل از اصلاح تکمیلی
در production قبل از اصلاح، در نقطه‌ی وسط input «نام نمایشی»:

```text
document.elementFromPoint(x, y) => BODY
```

و computed style روی خود input:

```text
input pointer-events: none
section pointer-events: none
PanelHost root pointer-events: none
```

علت واقعی: `PanelHost` root کلاس `pointer-events-none` داشت. انتظار قبلی این بود که `pointer-events-auto` روی section آن را override کند، اما در عمل computed style نشان داد input و section همچنان `pointer-events: none` می‌گیرند. بنابراین کلیک واقعاً به body می‌رفت.

### اصلاح تکمیلی مبتنی بر شواهد
فایل:

```text
src/core/panel-manager/PanelHost.tsx
```

کلاس root از:

```text
fixed inset-0 isolate pointer-events-none
```

به:

```text
fixed inset-0 isolate
```

تغییر کرد.

Backdrop همچنان z-index پایین‌تر دارد و panel بالاتر است.

### تست واقعی بعد از اصلاح
روی local dev با Playwright:

```text
document.elementFromPoint(x, y) => INPUT
input pointer-events: auto
section pointer-events: auto
PanelHost root pointer-events: auto
```

و fill واقعی انجام شد:

```text
VALUE تست تایپ واقعی
```

یعنی این بار تعامل مرورگر واقعی تأیید کرد input قابل کلیک/تایپ است.

## فاز ۱ — ممیزی سیستماتیک نقاط تداخل Modal قدیمی + Panel جدید

### Modal و Panel portalها

`Modal` پایه:

```text
components/shared/ui.tsx
createPortal(..., document.body)
```

`PanelHost`:

```text
src/core/panel-manager/PanelHost.tsx
createPortal(..., document.body)
```

پس هر دو sibling مستقیم body هستند و ترتیب DOM و z-index هر دو اهمیت دارد.

### مکان‌هایی که Modal قدیمی و Panel جدید ممکن است هم‌زمان شوند

- `components/shared/contact-selector.tsx`
  - داخل فروش/خرید/داشبورد استفاده می‌شود.
  - از داخل آن `openEntityForResult("contact")` صدا زده می‌شود.

- `components/shared/product-selector.tsx`
  - داخل فروش/خرید/انبار/لیست قیمت استفاده می‌شود.
  - از داخل آن `openEntityForResult("product")` صدا زده می‌شود.

- `app/(app)/sales/page.tsx` / `PosModal`
  - خودش Modal قدیمی است.
  - داخل آن ContactSelector/ProductSelector باز می‌شود.
  - سپس از selector ممکن است Panel باز شود.

- `app/(app)/dashboard/page.tsx` / `QuickSaleModal`
  - مشابه PosModal.

- `app/(app)/purchases/page.tsx` / `PurchaseModal`
  - ProductSelector/ContactSelector دارد.

- `settings/price-lists`
  - ProductSelector دارد و حالا ProductPanel create هم ممکن است از آن باز شود.

### نتیجه معماری
گفته‌ی کاربر درست است: قبل از PanelHost، فقط Modalهای قدیمی وجود داشتند و این نوع باگ وجود نداشت. با ورود پنل‌های جدید، معماری هم‌زیستی Modal قدیمی + Panel جدید ذاتاً پرریسک شد.

بنابراین راه بلندمدت patch پشت patch نیست؛ باید یا:

1. ساخت/انتخاب entity از داخل Modalهای legacy به یک flow واحد panel-native مهاجرت کند.
2. یا تا زمان مهاجرت، selectorها قبل از open panel حتماً unmount شوند و PanelHost نباید `pointer-events:none` روی root داشته باشد.

## فاز ۲ — روش تشخیصی واقعی

### نصب مرورگر
این بار `sudo` در sandbox کار کرد و dependencyهای Chromium نصب شدند:

```text
libnspr4
libnss3
libatk
libgtk-3
...
```

پس Playwright قابل اجرا شد.

### ابزار تشخیصی اجراشده
در مرورگر واقعی headless:

```js
document.elementFromPoint(x, y)
getComputedStyle(input).pointerEvents
getComputedStyle(section).pointerEvents
```

نتیجه قبل از اصلاح:

```text
elementFromPoint => BODY
pointer-events => none
```

نتیجه بعد از اصلاح:

```text
elementFromPoint => INPUT
pointer-events => auto
fill => successful
```

## جمع‌بندی

ریشه‌ی عملی مشکل نهایی این بود:

```text
PanelHost root pointer-events-none باعث می‌شد خود section/input هم در عمل pointer-events:none شوند.
```

اصلاح قطعی انجام‌شده:

```text
حذف pointer-events-none از PanelHost root
```

inert برای siblingهای پشت پنل باقی ماند، ولی دیگر خود پنل را از pointer chain خارج نمی‌کند.
