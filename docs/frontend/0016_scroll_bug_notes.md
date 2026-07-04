# 0016 — گزارش باگ اسکرول Dashboard

## 1) وضعیت فعلی scroll-lock

فایل:

```text
src/core/panel-manager/PanelHost.tsx
```

قبل از اصلاح:

```ts
useEffect(() => {
  if (stack.length === 0) return;
  const original = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  return () => {
    document.body.style.overflow = original;
  };
}, [stack.length]);
```

مشکلات احتمالی:

- فقط `body.style.overflow` را lock می‌کرد، نه `documentElement`.
- dependency روی `stack.length` بود؛ با push کردن پنل دوم/سوم effect دوباره اجرا می‌شد و مقدار اولیه ممکن بود در وضعیت نادرست capture شود.
- اگر چند مسیر باز/بسته شدن پشت‌سرهم رخ دهد، restoration می‌توانست قابل اتکا نباشد.

---

## 2) مسیرهای بسته شدن پنل

پنل‌ها می‌توانند با این مسیرها بسته شوند:

- `closeTop()` از دکمه بستن
- کلیک روی backdrop
- Esc
- Back/Forward مرورگر از URL Sync مرحله ۱۲
- unmount ناگهانی AppShell/PanelHost هنگام navigation

در نسخه جدید باید cleanup در همه این حالت‌ها overflow را restore کند.

---

## 3) آیا مشکل فقط dashboard است؟

از نظر کد، مشکل مربوط به `PanelHost` است و می‌تواند هر صفحه‌ای را تحت تأثیر قرار دهد، نه فقط dashboard. اما چون dashboard بلندترین/پرترافیک‌ترین صفحه است، اثر باگ آنجا بیشتر دیده می‌شود.

صفحات `/contacts` و `/products` هم از همان PanelHost استفاده می‌کنند؛ پس اصلاح باید سراسری باشد.

---

## 4) بررسی CSS خود Dashboard

Dashboard root:

```tsx
<div className="space-y-5 sm:space-y-8">
```

و AppShell:

```tsx
<div className="min-h-screen bg-background text-foreground lg:flex">
<main className="mx-auto w-full max-w-7xl flex-1 ...">
```

overflow/height خاصی در dashboard دیده نشد که به تنهایی باعث قفل اسکرول شود. محتمل‌ترین علت، scroll-lock سراسری PanelHost است.

---

## 5) اصلاح انجام‌شده

PanelHost اصلاح شد تا:

- lock فقط بر اساس boolean `isLocked = stack.length > 0` باشد، نه عمق stack.
- مقدار اولیه `body.style.overflow` و `document.documentElement.style.overflow` ذخیره شود.
- در cleanup دقیقاً همان مقدار اولیه restore شود.
- در close با Esc/backdrop/back browser/unmount، cleanup اجرا شود.

---

## 6) سناریوهای تست مورد انتظار

- refresh تازه dashboard بدون پنل: اسکرول از ابتدا فعال باشد.
- باز کردن پنل از GlobalSearchBar و بستن با Esc: اسکرول برگردد.
- باز کردن پنل و بستن با backdrop: اسکرول برگردد.
- باز کردن چند پنل و back مرورگر: با بسته شدن هر پنل، وقتی stack صفر شد اسکرول برگردد.

Build/Test بعد از اصلاح پاس شد.
