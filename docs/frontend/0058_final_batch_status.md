# 0058 — Final batch status

## بخش ۴ — استپر تعداد

اضافه شد:

```text
components/shared/quantity-stepper.tsx
```

استفاده شد در:

```text
app/(app)/purchases/page.tsx
components/shared/inventory-operation-page.tsx
```

سبد فروش POS از قبل دکمه‌های + و - داشت و حفظ شد.

## بخش ۵ — پیش‌فرض پرداخت نقدی

در `PosModal` و `QuickSaleModal` پرداخت نقدی به‌صورت خودکار برابر مبلغ قابل پرداخت قرار می‌گیرد، مگر اینکه کاربر checkbox «این فروش نسیه است» را فعال کند.

فایل‌ها:

```text
app/(app)/sales/page.tsx
app/(app)/dashboard/page.tsx
```

## بخش ۶ — PortalMenu برای منوی سه‌نقطه

کامپوننت مشترک اضافه شد:

```text
components/shared/portal-menu.tsx
```

`EntityActionMenu` دیگر منو را داخل stacking context ردیف/کارت render نمی‌کند و با `createPortal` به `document.body` منتقل می‌کند. موقعیت با `getBoundingClientRect` محاسبه می‌شود و به لبه‌های صفحه محدود می‌شود.

## بخش ۰ — وضعیت Git

قبل از شروع تغییرات، `git fetch origin main` و `git reset --hard origin/main` انجام شد تا local دقیقاً با remote یکی شود. commit مبنا:

```text
5949858 fix(ui): default contacts newest and align jalali calendar
```

## بخش ۱ — Login desktop scroll

قبلاً در commit زیر انجام و در این دسته تأیید شد:

```text
adc0ecb fix(ui): make login scrollable and normalize digit search
```

کلاس‌های اصلی login اکنون `min-h-dvh` و `overflow-y-auto` دارند.

## بخش ۲ — DatePicker شمسی

commit:

```text
5434182 feat(ui): add jalali date picker
5949858 fix(ui): default contacts newest and align jalali calendar
```

در این دسته چیدمان تقویم با offset روز اول ماه، دکمه امروز و گرید ۷ستونه تکمیل شد.

## بخش ۳ — جستجوی عدد فارسی/انگلیسی

commit:

```text
adc0ecb fix(ui): make login scrollable and normalize digit search
```

`normalizeSearchText` به مسیرهای جستجو اضافه شد.

## بخش ۷ — تأیید پنل دسکتاپ کشویی

کلاس فعلی PanelHost:

```text
w-full sm:w-[560px] sm:max-w-[92vw]
```

یعنی موبایل تمام‌عرض است ولی از breakpoint `sm` به بعد کشویی/محدود می‌شود و کل دسکتاپ را نمی‌گیرد.

## مشاهده شد ولی طبق دستور انجام نشد

فرم خرید شبیه شاتوت هنوز نیاز به فاز جدا برای UI کامل‌تر دارد. در این batch فقط موارد مشخص‌شده اجرا شد.
