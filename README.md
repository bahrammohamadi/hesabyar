# حساب‌یار (Hesabyar) v1.1.1

نرم‌افزار مدیریت مالی و فروش برای کسب‌وکارهای کوچک — فارسی، RTL، تاریخ شمسی، PWA.



## فناوری
- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS + React Query
- **Backend:** Supabase (PostgreSQL + Auth + Storage + RLS)
- **نمودار:** Recharts | **تاریخ شمسی:** dayjs + jalaliday

## راه‌اندازی محلی
```bash
npm install
cp .env.local.example .env.local   # مقادیر Supabase را پر کن
npm run dev
```

## متغیرهای محیطی
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## دیتابیس
فایل‌های `supabase/migrations/0001_initial_schema.sql` و `0002_functions.sql` را در Supabase SQL Editor اجرا کن.

## انتشار
به Vercel وصل کن و دو متغیر محیطی بالا را تنظیم کن. هر push خودکار منتشر می‌شود.

📖 راهنمای کامل فارسی قدم‌به‌قدم: `docs/05-راهنمای-راه‌اندازی-قدم‌به‌قدم.md`

## ماژول‌ها
داشبورد · فروش (POS) · کالا و انبار · عملیات انبار · خرید · اشخاص · مالی · تنظیمات

## ویژگی‌های معماری
- Multi-tenant (`org_id`) آماده SaaS
- آماده multi-branch، CRM، AI analytics
- موجودی فقط با حرکت انبار (قابل ردیابی)
- مبالغ به ریال (bigint)، نمایش تومان
- RLS روی همه جداول
