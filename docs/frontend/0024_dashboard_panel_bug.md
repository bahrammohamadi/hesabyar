# 0024 — بررسی واقعی باگ دکمه پنل جدید در Dashboard

## تفاوت با بررسی قبلی

بررسی قبلی فقط مشکل `ToastProvider` را توضیح داده بود. اما گزارش کاربر درباره dashboard بود و می‌گفت: «توی داشبورد میزنم پنل جدید رو میاره و کار نمیکنه». بنابراین این بار مسیرهای واقعی dashboard بررسی شدند.

## 1) تمام مسیرهای «جدید» در dashboard

فایل:

```text
app/(app)/dashboard/page.tsx
```

موارد مهم:

| خط تقریبی | عنوان | رفتار قبلی |
|---|---|---|
| PageHeader فروش جدید | دکمه فروش جدید | `setQuickSaleOpen(true)` |
| QuickAction فروش جدید | فروش جدید | `setQuickSaleOpen(true)` |
| QuickAction کالای جدید | کالای جدید | `href="/products?action=new"` |
| QuickAction مشتری جدید | مشتری جدید | `href="/contacts?action=new&type=customer"` |
| QuickSaleModal مشتری | انتخاب مشتری | `ContactSelector` |
| ContactSelector مشتری جدید | مشتری جدید | `openEntityForResult('contact')` |

## 2) علت واقعی جدید

در dashboard، دو QuickAction مهم هنوز route-based بودند:

```tsx
href="/products?action=new"
href="/contacts?action=new&type=customer"
```

یعنی برخلاف صفحات `/contacts` و `/products` که دکمه «پنل جدید» دارند، dashboard هنوز کاربر را به route قدیمی می‌فرستاد. این باعث تجربه گیج‌کننده می‌شد و ممکن بود کاربر تصور کند پنل جدید باز شده ولی مسیر/فرم قدیمی یا state دیگری فعال شده است.

## 3) تفاوت با مسیر /contacts

در `/contacts` دکمه جدید مستقیماً:

```ts
openEntity("contact", undefined, { mode: "create" })
```

را صدا می‌زند.

اما در dashboard قبل از اصلاح:

```text
مشتری جدید → /contacts?action=new&type=customer
```

بود.

## 4) اصلاح انجام‌شده

در dashboard:

```text
کالای جدید → openEntity('product', undefined, { mode:'create' })
مشتری جدید → openEntity('contact', undefined, { mode:'create' })
```

تغییر فقط در QuickActionهای dashboard است. QuickSaleModal و مسیر انتخاب مشتری داخل فروش دست‌نخورده باقی ماندند.

## 5) نتیجه مورد انتظار

از dashboard:

```text
مشتری جدید → ContactPanel create کامل
کالای جدید → ProductPanel create کامل
```

بدون route change و بدون وابستگی به query param قدیمی.
