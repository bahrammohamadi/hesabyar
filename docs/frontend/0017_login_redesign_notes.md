# 0017 — بازطراحی صفحه ورود

## گام صفر

- فایل skill در مسیر `/mnt/skills/public/frontend-design/SKILL.md` در این محیط وجود نداشت.
- صفحه فعلی: `app/login/page.tsx`
- منطق auth فعلی با `supabase.auth.signInWithPassword` است و دست‌نخورده می‌ماند.
- لوگو موجود: `/logo.png`
- برند/رنگ اصلی از CSS variable `primary` و ThemeProvider استفاده می‌کند.

## تصمیم طراحی

- دسکتاپ: layout دو ستونه، سمت راست برند/پیام خوشامد، سمت چپ فرم.
- موبایل: تک‌ستونه و لوگو بالای فرم.
- استفاده از کامپوننت‌های DS مرحله ۸: `Button`, `Field`, `Input`.
- پیام خطا به صورت alert card.
- انیمیشن ساده fade/slide با Tailwind classes.

## منطق تغییر نکرد

- email/password state همان است.
- `handleLogin` همان مسیر Supabase را صدا می‌زند.
- redirect بعد از login همان `/dashboard` است.
