# 0035 — Admin user setup notes

## وضعیت اجرا
این بخش به‌صورت کامل اجرا نشد، چون برای ساخت کاربر واقعی با رمز مشخص‌شده، دو شرط امنیتی لازم است:

1. دسترسی `service_role`/Supabase Admin API یا مسیر امن server-side معتبر.
2. کانال امن برای تزریق رمز عبور که مقدار رمز در command، فایل، markdown، commit یا خروجی ابزار ثبت نشود.

در این محیط، مقدار رمز فقط در متن گفتگو وجود دارد و هر فراخوانی مستقیم API از طریق ابزارها باعث ثبت آن در command/tool log می‌شود؛ بنابراین طبق قانون سخت‌گیرانه همین تسک، رمز استفاده نشد و در هیچ فایل/commit/log نوشته نشد.

## الگوی login فعلی
کد login و Supabase client نشان می‌دهد سیستم با email/password کار می‌کند، نه username خام یا شماره موبایل خام.

نمونه‌ی استفاده‌شده در پروژه:

```text
test@hesabyar.app
```

بنابراین برای شماره موبایل، فرمت سازگار پیشنهادی سیستم فعلی این است:

```text
09111558263@hesabyar.app
```

## نقش کامل/ادمین
بر اساس کدها:

```text
lib/permissions.ts
app/(app)/settings/page.tsx
app/api/admin/users/route.ts
supabase/migrations/0001_initial_schema.sql
```

نقش‌ها:

```text
owner, manager, cashier, inventory, accountant
```

بالاترین سطح دسترسی:

```text
owner
```

در `lib/permissions.ts`، نقش `owner` همه دسترسی‌ها را دارد:

```ts
owner: ["*"]
```

## ساختار عضویت
جدول `memberships` شامل این فیلدهای اصلی است:

```text
id
org_id
branch_id
user_id
role
is_active
created_at
created_by
```

هر کاربر برای دسترسی به یک سازمان باید membership فعال داشته باشد.

## کاربران قابل مشاهده از API داخلی فعلی
از مسیر server-side موجود:

```text
/api/admin/users
```

با session ادمین تست فعلی فقط کاربران سازمان فعال همان session قابل مشاهده بودند، نه کل auth.users پروژه.

کاربر قابل مشاهده:

| email | name | role | is_active | created_at |
|---|---|---|---|---|
| test@hesabyar.app | test@hesabyar.app | owner | true | 2026-07-04T17:49:00.06428+00:00 |

## نتیجه بخش ۱
کاربر واقعی ساخته نشد، چون انجام آن بدون ثبت رمز در tool log ممکن نبود. برای انجام امن، یکی از این دو مسیر لازم است:

1. اجرای کاربر توسط خودتان از Supabase Dashboard و ست‌کردن role=`owner` در `memberships`.
2. فراهم‌کردن یک secret امن در محیط اجرا، نه در متن گفتگو، تا API بتواند رمز را بدون ثبت در لاگ بخواند.

## نتیجه بخش ۲
حذف اکانت‌های تستی انجام نشد، چون:

- لیست کامل `auth.users` بدون Admin/service access در دسترس نبود.
- از API داخلی فقط یک کاربر تستی در سازمان فعلی دیده شد.
- قانون تسک می‌گوید اگر تعداد کاندیدهای واضح تستی دقیقاً دو عدد نبود، حذف انجام نشود.

بنابراین هیچ auth user حذف نشد.
