# 0019 — Deep Dive باگ اسکرول Dashboard

## نتیجه تشخیص دوم

اصلاح قبلی روی `PanelHost` فقط scroll-lock زمان باز بودن پنل را مقاوم‌تر کرد. اما اگر کاربر می‌گوید در حالت عادی dashboard دسکتاپ هم اسکرول ندارد، ریشه مشکل نمی‌تواند فقط PanelHost باشد.

## بررسی Layout

### Root app layout

`app/(app)/layout.tsx` فقط auth را چک می‌کند و خروجی را داخل `AppShell` می‌گذارد. CSS خاصی برای overflow ندارد.

### AppShell

فایل:

```text
components/shared/app-shell.tsx
```

ساختار فعلی:

```tsx
<div className="min-h-screen bg-background text-foreground lg:flex">
  <Sidebar />
  <div className="flex min-h-screen min-w-0 flex-1 flex-col">
    <Header />
    <main className="mx-auto w-full max-w-7xl flex-1 ...">
      {children}
    </main>
  </div>
</div>
```

در این ساختار، اسکرول به body/page سپرده شده است. اما در desktop با sidebar sticky/h-screen و header sticky، اگر body/html به هر دلیلی lock شود یا مرورگر height را به شکل خاصی محاسبه کند، main خودش scroll container مستقل ندارد.

## مقایسه با صفحات دیگر

`/contacts` و `/products` هم داخل همین AppShell هستند. پس اگر body scroll مشکل داشته باشد، آن‌ها هم ممکن است تحت تأثیر قرار بگیرند، اما dashboard به دلیل محتوای بلندتر و gridهای زیاد زودتر دیده می‌شود.

## علت محتمل واقعی

مشکل اصلی معماری layout این است که desktop content column خودش scroll container مستقل ندارد. در اپ‌های dashboard/sidebar معمولاً باید در desktop ستون content این‌طور باشد:

```text
height: 100vh
overflow-y: auto
```

و body فقط shell را نگه دارد. در نسخه قبلی، فقط min-height بود نه height/overflow مستقل.

## اصلاح انجام‌شده

در `components/shared/app-shell.tsx`، ستون content در desktop به scroll container مستقل تبدیل شد:

```text
lg:h-screen lg:overflow-y-auto
```

این باعث می‌شود حتی اگر body scroll به هر دلیل محدود شود، داشبورد و سایر صفحات در ستون اصلی خودشان اسکرول کنند.

## تفاوت با تلاش قبلی

- تلاش قبلی: فقط scroll-lock پنل را اصلاح کرد.
- تلاش جدید: ساختار desktop layout را اصلاح کرد تا main content خودش scrollable باشد.

## تست مورد انتظار

- refresh تازه dashboard بدون پنل: content column باید scroll شود.
- باز/بستن پنل با Esc/backdrop/back: بعد از بسته شدن، content column همچنان scroll شود.
- contacts/products نیز در desktop باید داخل همین ستون scroll کنند.
