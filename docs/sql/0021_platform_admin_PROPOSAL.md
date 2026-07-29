# پیشنهاد schema — پنل سوپرادمین، پلن‌ها، تأیید کسب‌وکار و دمو

وضعیت: **پیشنهاد. هنوز اجرا نشده و هیچ migration ای اعمال نشده است.**
تاریخ: ۱۴۰۵/۰۵/۰۷ · شماره پیشنهادی: `0021`

> این سند برای مرور قبل از نوشتن کد است. تغییر schema برگشت‌پذیر نیست،
> پس هیچ‌چیز بدون تأیید صریح شما اجرا نمی‌شود.

---

## ۱) وضعیت فعلی (بررسی‌شده در کد)

| موجود | وضعیت |
|---|---|
| `organizations` | ✅ دارد: `id`, `name`, `owner_id`, `currency`, `is_active` |
| `memberships` با نقش‌ها | ✅ `owner/manager/cashier/inventory/accountant` |
| RLS بر پایه `org_id` | ✅ فعال روی همه جداول |
| `bootstrap_org()` | ✅ سازمان + شعبه + عضویت + حساب‌ها را یک‌جا می‌سازد |
| **نقش سطح پلتفرم** | ❌ ندارد — همه نقش‌ها داخل یک org معنا دارند |
| **وضعیت تأیید سازمان** | ❌ ندارد — هر ثبت‌نام بلافاصله فعال است |
| **جدول پلن/اشتراک** | ❌ ندارد — پلن‌های لندینگ hardcode است |
| **فلگ دمو** | ❌ ندارد |

**نکته‌ی کلیدی:** `is_active` روی `organizations` هست اما معنایش «حذف نرم» است،
نه «در انتظار تأیید». نباید بارِ معنایی جدید رویش گذاشت.

---

## ۲) طرح پیشنهادی — چهار قطعه

### الف) نقش سطح پلتفرم

```sql
create table if not exists public.platform_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'admin' check (role in ('admin','support')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create or replace function public.is_platform_admin()
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.platform_admins where user_id = auth.uid()) $$;
```

چرا جدول جدا و نه ستون روی `memberships`؟ چون سوپرادمین **به هیچ org تعلق ندارد**
و باید بتواند فرا-سازمانی ببیند. قاطی‌کردنش با `memberships` مدل RLS فعلی را خراب می‌کند.

### ب) چرخه‌ی تأیید سازمان

```sql
alter table public.organizations
  add column if not exists approval_status text not null default 'approved'
    check (approval_status in ('pending','approved','rejected','suspended')),
  add column if not exists approved_at   timestamptz,
  add column if not exists approved_by   uuid references auth.users(id),
  add column if not exists rejection_note text;
```

⚠️ **پیش‌فرض عمداً `approved` است** تا سازمان‌های موجود قفل نشوند.
سوییچ به «تأیید اجباری برای ثبت‌نام جدید» باید یک تصمیم جداگانه و صریح باشد
(تغییر `bootstrap_org` به درج `pending`).

### ج) پلن‌ها و اشتراک

```sql
create table if not exists public.plans (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,          -- free | monthly | biannual | enterprise
  name          text not null,
  price_rial    bigint not null default 0,     -- ریال، مثل بقیه پروژه
  period_days   int,                           -- null = نامحدود/سفارشی
  max_invoices  int,                           -- null = نامحدود
  max_products  int,
  features      jsonb not null default '[]'::jsonb,
  is_active     boolean not null default true,
  sort_order    int not null default 0
);

create table if not exists public.subscriptions (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  plan_id     uuid not null references public.plans(id),
  status      text not null default 'trial'
              check (status in ('trial','active','expired','cancelled')),
  started_at  timestamptz not null default now(),
  expires_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists idx_subscriptions_org on public.subscriptions(org_id);
```

قیمت‌ها **ریال `bigint`** هستند تا با قرارداد موجود پروژه یکی باشد
(`formatToman` تبدیل نمایشی انجام می‌دهد). float ممنوع.

### د) دمو

```sql
alter table public.organizations
  add column if not exists is_demo boolean not null default false;
```

سازمان دمو یک org معمولی است با داده‌ی نمونه و `is_demo = true`؛ نیازی به
مسیر جداگانه نیست، فقط بنر «حالت نمایشی» و مسدودکردن عملیات مخرب.

---

## ۳) RLS — حساس‌ترین بخش

```sql
alter table public.platform_admins enable row level security;
alter table public.plans          enable row level security;
alter table public.subscriptions  enable row level security;

-- پلن‌ها برای همه خواندنی (لندینگ باید ببیند)
create policy p_plans_read on public.plans for select using (true);

-- فقط سوپرادمین می‌نویسد
create policy p_plans_admin on public.plans for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- سازمان اشتراک خودش را می‌بیند؛ سوپرادمین همه را
create policy p_subs_read on public.subscriptions for select
  using (org_id in (select public.user_org_ids()) or public.is_platform_admin());

-- خودِ جدول ادمین‌ها فقط برای ادمین‌ها
create policy p_padmins on public.platform_admins for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());
```

⚠️ **ریسک:** `organizations` الان policy جداسازی بر پایه `org_id` دارد.
برای اینکه سوپرادمین همه سازمان‌ها را ببیند باید policy موجود **گسترش** یابد
(`or public.is_platform_admin()`)، نه اینکه حذف شود. حذف policy قدیمی دسترسی
اپ فعلی را قطع می‌کند — همان اشتباهی که migration 0018 عمداً از آن پرهیز کرد.

---

## ۴) تغییرات لازم در کد

| فایل | تغییر |
|---|---|
| `app/(admin)/…` | مسیر جدید با layout مستقل + گارد `is_platform_admin()` |
| `middleware.ts` | افزودن `/admin` به مسیرهای محافظت‌شده |
| `MarketingPieces.tsx` | خواندن پلن‌ها از `plans` به‌جای آرایه hardcode |
| `bootstrap_org()` | (اختیاری، فاز دوم) درج `approval_status='pending'` |
| `AppShell` | بنر «حالت نمایشی» وقتی `is_demo` |

---

## ۵) ترتیب پیشنهادی اجرا

۱. **migration فقط افزایشی** — چهار قطعه بالا، همه با `if not exists` و پیش‌فرض‌های امن. بدون تغییر رفتار موجود.
۲. **seed پلن‌ها** — همان چهار پلن لندینگ، تا داده hardcode جایگزین شود.
۳. **صفحه `/admin`** — فهرست سازمان‌ها + وضعیت + دکمه تأیید/رد.
۴. **اتصال لندینگ به `plans`**.
۵. **فعال‌کردن تأیید اجباری** — آخرین قدم، چون رفتار ثبت‌نام را عوض می‌کند.
۶. **دمو** — بعد از اینکه بقیه پایدار شد.

هر قدم جداگانه قابل تست و برگشت است.

---

## ۶) سؤال‌هایی که پیش از کدنویسی باید پاسخ دهید

1. **تأیید اجباری؟** آیا کسب‌وکار جدید باید تا تأیید شما در حالت `pending` بماند
   و نتواند وارد شود، یا فقط در فهرست ادمین علامت بخورد؟
2. **سوپرادمین کیست؟** ایمیل حساب خودتان را بدهم در seed درج شود، یا دستی اضافه می‌کنید؟
3. **محدودیت پلن اجرا شود؟** یعنی پلن رایگان واقعاً بعد از ۱۰۰ فاکتور متوقف شود،
   یا فعلاً فقط نمایشی بماند؟
4. **پرداخت؟** الان هیچ درگاهی وصل نیست. اشتراک دستی فعال شود یا درگاه (زرین‌پال…) هم در نقشه است؟
