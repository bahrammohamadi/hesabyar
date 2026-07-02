# گزارش گام صفر — Workflow / Audit Triggers / RLS قبل از Migrationهای 0016-0018

> نوع بررسی: فقط SELECT از دیتابیس زنده Supabase  
> هدف: شناسایی triggerهای موجود، RLS، policyها، نقش‌ها، وضعیت status و ستون‌های reverse قبل از تغییر حساس

---

## 1) triggerهای فعلی روی جداول عملیاتی

| جدول | Trigger | زمان | رویداد | تابع |
|---|---|---|---|---|
| `contacts` | `trg_set_contact_code` | BEFORE | INSERT | `set_contact_code()` |
| `contacts` | `trg_updated_contacts` | BEFORE | UPDATE | `set_updated_at()` |
| `products` | `trg_set_product_code` | BEFORE | INSERT | `set_product_code()` |
| `products` | `trg_updated_products` | BEFORE | UPDATE | `set_updated_at()` |
| `product_variants` | `trg_guard_stock_qty` | BEFORE | UPDATE | `guard_stock_qty_update()` |
| `product_variants` | `trg_updated_product_variants` | BEFORE | UPDATE | `set_updated_at()` |
| `sales` | `trg_updated_sales` | BEFORE | UPDATE | `set_updated_at()` |
| `sale_items` | `trg_updated_sale_items` | BEFORE | UPDATE | `set_updated_at()` |
| `purchases` | `trg_updated_purchases` | BEFORE | UPDATE | `set_updated_at()` |
| `purchase_items` | `trg_updated_purchase_items` | BEFORE | UPDATE | `set_updated_at()` |
| `transactions` | `trg_updated_transactions` | BEFORE | UPDATE | `set_updated_at()` |
| `stock_movements` | `trg_apply_stock` | AFTER | INSERT, DELETE | `apply_stock_movement()` |
| `stock_movements` | `trg_updated_stock_movements` | BEFORE | UPDATE | `set_updated_at()` |

---

## 2) هشدار حیاتی double-count موجودی

روی `stock_movements` یک trigger فعال وجود دارد:

```sql
CREATE TRIGGER trg_apply_stock
AFTER INSERT OR DELETE ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION apply_stock_movement()
```

این trigger با هر INSERT روی `stock_movements` مقدار `product_variants.stock_qty` را خودش تغییر می‌دهد.

بنابراین در Workflow Engine:

> فقط باید stock movement ثبت شود و نباید هیچ UPDATE مستقیم روی `product_variants.stock_qty` انجام شود.

اگر هم stock movement ثبت شود و هم `stock_qty` دستی تغییر کند، موجودی double-count می‌شود.

---

## 3) وضعیت RLS فعلی

RLS از قبل روی همه جداول عملیاتی فعال است:

| جدول | RLS enabled | forced |
|---|---:|---:|
| `contacts` | true | false |
| `products` | true | false |
| `product_variants` | true | false |
| `sales` | true | false |
| `sale_items` | true | false |
| `purchases` | true | false |
| `purchase_items` | true | false |
| `transactions` | true | false |
| `stock_movements` | true | false |

---

## 4) Policyهای موجود

برای همه جداول عملیاتی policy قدیمی زیر وجود دارد:

```text
policyname = org_isolation
cmd = ALL
roles = public
using = org_id in (select user_org_ids())
with_check = org_id in (select user_org_ids())
```

### تحلیل

- مکانیزم org-scoping از قبل مشخص است: `public.user_org_ids()`.
- این تابع بر اساس `auth.uid()` و جدول `memberships` سازمان‌های کاربر را برمی‌گرداند.
- policy فعلی برای همه نقش‌ها (`public`) و همه عملیات‌ها (`ALL`) است.
- یعنی در حال حاضر DELETE هم برای عضو org از نظر RLS مجاز است، اگر permission اپلیکیشن/کد اجازه دهد.

در migration 0018 برای کاهش ریسک، policyهای جدید service_role و authenticated اضافه می‌شوند اما policy قدیمی حذف نمی‌شود تا دسترسی اپلیکیشن فعلی ناگهان قطع نشود. محدودسازی حذف policy قدیمی باید در فاز جداگانه و با تست کامل انجام شود.

---

## 5) نقش‌های دیتابیس

| role | bypassrls | توضیح |
|---|---:|---|
| `anon` | false | کاربر ناشناس API |
| `authenticated` | false | کاربر login شده |
| `service_role` | true | backend/admin Supabase؛ RLS را bypass می‌کند |
| `postgres` | true | نقش DB |
| `supabase_admin` | true | نقش مدیریتی Supabase |

Backend/APIهای مدیریتی با service-role کار می‌کنند و چون `service_role` دارای `rolbypassrls=true` است، RLS را bypass می‌کند.

---

## 6) وضعیت فعلی status اسناد

| جدول | status | تعداد |
|---|---|---:|
| `sales` | `confirmed` | 3 |
| `purchases` | بدون رکورد | 0 |

---

## 7) ستون‌های reverse/cancel

هر دو جدول `sales` و `purchases` ستون‌های زیر را دارند:

```text
cancelled_at
cancelled_by
reversed_at
reversed_by
```

پس Workflow Engine می‌تواند برای reverse از `reversed_at/reversed_by` استفاده کند.

---

## 8) تصمیم اجرایی مرحله 0016 Audit Triggers

- روی اکثر جداول عملیاتی trigger audit برای INSERT/UPDATE/DELETE نصب می‌شود.
- روی `stock_movements` فقط INSERT/DELETE audit می‌شود، نه UPDATE.

دلیل:

- `stock_movements` ممکن است پرتکرار شود.
- UPDATE روی stock_movements نباید workflow اصلی باشد؛ حرکت انبار بهتر است append-only باشد.
- برای کاهش overhead، UPDATE آن audit نمی‌شود.

---

## 9) تصمیم اجرایی مرحله 0017 Workflow

- `fn_transition_document` برای status transition ساخته می‌شود.
- برای confirm از draft، اگر قبلاً stock_movement با `ref_table/ref_id` ثبت شده باشد، دوباره ثبت نمی‌کند.
- برای reversed، اگر سند قبلاً reversed/cancelled/returned یا `reversed_at` پر شده باشد، خطا می‌دهد.
- هیچ UPDATE مستقیم روی `product_variants.stock_qty` انجام نمی‌شود.
- side-effect موجودی فقط از طریق `fn_add_stock_movement` و trigger موجود `trg_apply_stock` انجام می‌شود.

---

## 10) تصمیم اجرایی مرحله 0018 RLS

- RLS از قبل فعال است.
- دستورهای Emergency Disable در فایل 0018 نوشته می‌شود.
- policy کامل service_role اضافه می‌شود.
- policyهای صریح authenticated برای SELECT/INSERT/UPDATE بر اساس `user_org_ids()` اضافه می‌شود.
- policy قدیمی `org_isolation` حذف نمی‌شود چون حذف آن می‌تواند ناگهان رفتار فعلی اپ را تغییر دهد.
- policyهای granular فقط به صورت کامنت در فایل قرار می‌گیرند، فعال نمی‌شوند.

---

## 11) دستور خاموش‌کردن اضطراری RLS

اگر بعد از 0018 دسترسی قطع شد، از Supabase SQL Editor با توکن/نقش مدیریتی اجرا کنید:

```sql
alter table public.sales disable row level security;
alter table public.sale_items disable row level security;
alter table public.purchases disable row level security;
alter table public.purchase_items disable row level security;
alter table public.contacts disable row level security;
alter table public.products disable row level security;
alter table public.product_variants disable row level security;
alter table public.transactions disable row level security;
alter table public.stock_movements disable row level security;
```

اما در حالت عادی این کار توصیه نمی‌شود چون isolation سازمانی را خاموش می‌کند.
