# 0041 — Pointer capture / inert bug

## مسئله
در flowهایی مثل:

```text
ContactSelector → ایجاد مشتری جدید → ContactPanel create
ProductSelector → افزودن کالای جدید → ProductPanel create
```

کلیک/اسکرول روی پنل می‌توانست به لایه زیرین selector/modal منتقل شود یا selector زیر پنل همچنان در hit-testing دخالت کند. z-index به‌تنهایی تضمین نمی‌کند کدام element رویداد pointer را دریافت می‌کند.

## گام صفر — یافته‌ها

### 1) آیا ContactSelector واقعاً unmount می‌شد؟

قبل از این اصلاح، `ContactSelector` همیشه render می‌شد و فقط این را به Modal می‌داد:

```tsx
<Modal open={open} ...>
```

خود `Modal` در `components/shared/ui.tsx` اگر `open=false` باشد `null` برمی‌گرداند، پس portal modal حذف می‌شد؛ اما کامپوننت Selector همچنان در tree بود و ترتیب close/open با `setTimeout(0)` انجام می‌شد، نه به‌صورت تضمینی sync.

اصلاح شد:

- در `ContactSelector` و `ProductSelector` اگر `open=false` باشد خود selector `null` برمی‌گرداند.
- هنگام create جدید، `flushSync(() => onClose())` اجرا می‌شود تا unmount قبل از mount پنل قطعی شود.
- سپس با microtask (`await Promise.resolve()`) پنل باز می‌شود.

### 2) Portal containerها

هر دو از `createPortal(..., document.body)` استفاده می‌کنند:

- `Modal` پایه: `components/shared/ui.tsx`
- `PanelHost`: `src/core/panel-manager/PanelHost.tsx`

بنابراین هر دو sibling مستقیم در `body` هستند. اگر modal قدیمی قبل/بعد panel در body بماند، فقط z-index کافی نیست؛ باید لایه غیر فعال از hit-testing خارج شود.

### 3) stacking context

- `PanelHost` از transform برای slide/offset پنل‌ها استفاده می‌کند؛ transform باعث stacking context می‌شود.
- `Modal` و `PanelHost` هر دو fixed هستند و z-index دارند.
- وجود چند portal fixed با transform/backdrop می‌تواند در مرورگرها خصوصاً موبایل باعث رفتار مبهم pointer شود.

### 4) pointer-events کلاس‌ها

- Modal پایه: container fixed بدون `pointer-events:none` و backdrop کلیک‌پذیر دارد.
- PanelHost root: `pointer-events-none` و خود پنل‌ها `pointer-events-auto` دارند.
- اگر Modal زیرین در DOM باقی بماند، backdrop/list آن همچنان element واقعی است.

## اصلاحات انجام‌شده

### 1) Unmount قطعی selector قبل از پنل

فایل‌ها:

```text
components/shared/contact-selector.tsx
components/shared/product-selector.tsx
```

اصلاح:

```tsx
flushSync(() => onClose());
await Promise.resolve();
openEntityForResult(...)
```

و:

```tsx
if (!open) return null;
```

### 2) inert مرکزی برای body siblings

فایل:

```text
src/core/panel-manager/PanelHost.tsx
```

وقتی `stack.length > 0`:

- همه children مستقیم `document.body` به‌جز خود PanelHost root با `inert` و `aria-hidden=true` علامت‌گذاری می‌شوند.
- این شامل app root و Modalهای قدیمی/selectorهایی است که ممکن است هنوز در body باشند.
- `MutationObserver` اضافه شد تا اگر sibling جدیدی به body اضافه شد، همان inert logic روی آن اعمال شود.
- confirm/toast به خاطر z-index بالاتر از inert مستثنی شده‌اند.

PanelHost root حالا marker دارد:

```html
<div data-panel-host-root="true" ...>
```

### 3) حفظ و restore وضعیت قبلی

در cleanup، مقدار قبلی `inert` و `aria-hidden` هر sibling برگردانده می‌شود.

## محدودیت تست مرورگر

تست Playwright در این sandbox به دلیل نبود dependency سیستم اجرا نمی‌شود:

```text
libnspr4.so: cannot open shared object file
```

بنابراین تست interactive واقعی مرورگر در این محیط ممکن نبود. اما build/test و marker تولیدی انجام شد.

## Build/Test

```text
next build: passed
vitest: 3 files / 14 tests passed
```
