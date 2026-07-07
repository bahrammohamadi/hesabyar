# 0061 — Panel scroll lock fix

## مشکل
در پنل‌های جدید مشتری/کالا، کلیک روی input کار می‌کرد اما اسکرول داخل پنل به صفحه زیرین منتقل می‌شد؛ مخصوصاً در موبایل و همچنین در دسکتاپ وقتی فرم بلند بود.

## ریشه فنی
دو ریسک وجود داشت:

1. `PanelShell main` در flex column `min-h-0` نداشت. در flex layout، نبودن `min-h-0` باعث می‌شود child به جای scroll داخلی، ارتفاع خودش را بزرگ کند و scroll به بیرون/بدنه منتقل شود.
2. قفل scroll روی body فقط `overflow:hidden` بود که در iOS و بعضی مرورگرها برای جلوگیری از scroll پس‌زمینه کافی نیست.

## اصلاح

### `src/shared/ui/PanelShell.tsx`

- root پنل: `min-h-0`
- header: `shrink-0`
- main: `min-h-0 flex-1 overflow-y-auto overscroll-contain`
- فعال کردن `WebkitOverflowScrolling: touch`
- `touchAction: pan-y`

### `src/core/panel-manager/PanelHost.tsx`

- قفل scroll بدنه با `position: fixed`, `top=-scrollY`, `width:100%`
- restore دقیق scroll بعد از بستن پنل
- root پنل: `height: 100dvh`, `overflow-hidden`, `overscroll-contain`
- section پنل: `height: 100dvh`, `maxHeight:100dvh`, `overscroll-contain`
- stopPropagation برای wheel/touchmove روی section تا event به لایه زیرین منتقل نشود.

## تغییر نکرد
هیچ فرم/دیتا/route تغییر نکرد؛ فقط رفتار scroll پنل اصلاح شد.
