# 0060 — Panel desktop width and scroll fix

## مشکل مشاهده‌شده
در دسکتاپ، پنل «مشتری جدید/کالای جدید» با وجود کلاس `sm:w-[560px]` در عمل تمام‌عرض دیده می‌شد و اسکرول فرم قابل اتکا نبود.

## ریشه احتمالی
اتکا به ترکیب `w-full sm:w-[560px] sm:max-w-[92vw]` در یک panel fixed که قبلاً چندین تغییر z-index/pointer-events داشته، در production قابل اتکا نبود. تست قبلی Playwright نیز نشان داده بود گاهی computed width با انتظار کلاس Tailwind هم‌خوان نبود.

## اصلاح
در `src/core/panel-manager/PanelHost.tsx` عرض پنل از کلاس‌های Tailwind به inline style قطعی منتقل شد:

```ts
width: "min(100vw, 560px)"
maxWidth: "100vw"
```

نتیجه:

- دسکتاپ: 560px کشویی از راست
- موبایل: حداکثر 100vw
- منطق scroll داخلی `PanelShell main` حفظ شد.

## تغییر نکرد
هیچ route، فرم، mutation یا دیتابیسی تغییر نکرد.
