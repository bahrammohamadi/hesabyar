# گزارش گام صفر — ساختار فعلی `transactions` قبل از Migration 0015

> نوع بررسی: فقط‌خواندنی، از دیتابیس زنده Supabase و migrationهای موجود  
> هدف: ساخت لایه پرداخت و مانده روی مدل cashbook موجود، بدون تغییر مخرب

---

## 1) وضعیت کلی

| مورد | نتیجه |
|---|---|
| جدول موجود است؟ | بله ✅ |
| تعداد رکورد فعلی | `1` |
| مدل مالی | Cashbook-style، نه double-entry |
| ستون مبلغ | `amount bigint` |
| ستون نوع/جهت معنایی | `type text` |
| ستون روش پرداخت | `method text` |
| اتصال به contact | `contact_id uuid` |
| اتصال generic به سند | `ref_table text`, `ref_id uuid` |
| اتصال مستقیم به فروش/خرید | `sale_id uuid`, `purchase_id uuid` |
| org/branch | `org_id`, `branch_id` موجود |

---

## 2) ستون‌های فعلی `public.transactions`

| # | ستون | نوع | Nullable | Default | توضیح |
|---:|---|---|---:|---|---|
| 1 | `id` | uuid | no | `gen_random_uuid()` | شناسه تراکنش |
| 2 | `org_id` | uuid | no | - | سازمان |
| 3 | `branch_id` | uuid | yes | - | شعبه |
| 4 | `type` | text | no | - | نوع cashbook: receipt/payment/expense/transfer/income |
| 5 | `amount` | bigint | no | - | مبلغ تراکنش |
| 6 | `date` | timestamptz | no | `now()` | تاریخ تراکنش |
| 7 | `account_id` | uuid | yes | - | حساب مبدا/اصلی |
| 8 | `to_account_id` | uuid | yes | - | حساب مقصد در انتقال |
| 9 | `contact_id` | uuid | yes | - | شخص مرتبط |
| 10 | `expense_category_id` | uuid | yes | - | دسته هزینه |
| 11 | `ref_table` | text | yes | - | مرجع generic، مثل `sales` یا `purchases` |
| 12 | `ref_id` | uuid | yes | - | شناسه مرجع generic |
| 13 | `method` | text | no | `'cash'` | روش پرداخت |
| 14 | `note` | text | yes | - | توضیح |
| 15 | `created_at` | timestamptz | no | `now()` | زمان ایجاد |
| 16 | `updated_at` | timestamptz | no | `now()` | زمان به‌روزرسانی |
| 17 | `created_by` | uuid | yes | - | کاربر ایجادکننده |
| 18 | `sale_id` | uuid | yes | FK → `sales(id)` | اتصال مستقیم به فروش |
| 19 | `purchase_id` | uuid | yes | FK → `purchases(id)` | اتصال مستقیم به خرید |

---

## 3) Foreign Keyها

| ستون | جدول مقصد | رفتار حذف |
|---|---|---|
| `org_id` | `organizations(id)` | cascade |
| `branch_id` | `branches(id)` | set null |
| `account_id` | `accounts(id)` | set null |
| `to_account_id` | `accounts(id)` | set null |
| `contact_id` | `contacts(id)` | set null |
| `expense_category_id` | `expense_categories(id)` | set null |
| `sale_id` | `sales(id)` | restrict |
| `purchase_id` | `purchases(id)` | restrict |
| `created_by` | `auth.users(id)` | default/no action |

---

## 4) وضعیت direction / جهت تراکنش

ستون جداگانه `direction` وجود ندارد.

اما جهت از روی `type` قابل نرمال‌سازی است:

| `transactions.type` | direction مفهومی |
|---|---|
| `receipt` | `in` |
| `income` | `in` |
| `payment` | `out` |
| `expense` | `out` |
| `transfer` | انتقال داخلی / خنثی برای مانده سند |

بنابراین در Migration 0015 ستون جدید `direction` ساخته نمی‌شود تا schema تکراری نشود. جهت در viewها و RPC از روی `type` محاسبه می‌شود.

---

## 5) روش پرداخت

ستون `method` از قبل وجود دارد.

Constraint فعلی قبل از migration:

```text
cash, card, transfer, cheque
```

اما migration 0010 از `wallet` استفاده می‌کند و نیاز آینده به `credit/other` هم وجود دارد. بنابراین در 0015 constraint سازگارتر می‌شود:

```text
cash, card, credit, transfer, other, cheque, wallet
```

---

## 6) توزیع تراکنش‌های فعلی

تنها رکورد فعلی:

| type | method | ref_table | تعداد | مجموع amount |
|---|---|---|---:|---:|
| `expense` | `cash` | null | 1 | 10000 |

یعنی فعلاً transaction مرتبط با فروش/خرید در دیتابیس زنده وجود ندارد.

---

## 7) پرداخت فروش کجا ثبت می‌شود؟

در وضعیت فعلی دیتابیس زنده:

```text
sales rows = 3
SUM(sales.total) = 29180000
SUM(sales.paid_cash) = 0
SUM(sales.paid_card) = 0
SUM(sales.paid_credit) = 29180000
transactions linked to sales = 0
```

پس فروش‌های فعلی همه نسیه/اعتباری هستند و پرداخت واقعی در transactionها ندارند.

اما در کد SQL/RPCهای قبلی پروژه، هنگام ثبت فروش نقد/کارت، هم `sales.paid_cash/paid_card` پر می‌شود و هم transaction از نوع `receipt` با `ref_table='sales'` / `sale_id` ثبت می‌شود.

برای جلوگیری از double-count، در `v_document_balance` منطق زیر استفاده می‌شود:

```text
paid_amount = GREATEST(embedded_paid_from_document, net_transactions_for_document)
```

یعنی اگر پرداخت هم داخل فاکتور و هم در transactions ثبت شده باشد، دوبار شمرده نمی‌شود.

---

## 8) پرداخت خرید کجا ثبت می‌شود؟

در دیتابیس زنده:

```text
purchases rows = 0
transactions linked to purchases = 0
```

اما در RPCهای قبلی، خرید می‌تواند هم `purchases.paid` داشته باشد و هم transaction از نوع `payment` با `ref_table='purchases'` / `purchase_id`.

برای خرید هم همان قانون جلوگیری از double-count استفاده می‌شود:

```text
paid_amount = GREATEST(purchases.paid, net_transactions_for_purchase)
```

---

## 9) تصمیم اجرایی برای Migration 0015

| درخواست | تصمیم امن بر اساس ساختار واقعی |
|---|---|
| افزودن `method` | انجام نمی‌شود؛ وجود دارد، فقط constraint سازگارتر می‌شود |
| افزودن `ref_type/ref_id` | انجام نمی‌شود؛ `ref_table/ref_id` وجود دارد |
| افزودن `direction` | انجام نمی‌شود؛ از `type` نرمال می‌شود |
| ساخت `v_document_balance` | انجام می‌شود |
| ساخت `v_contact_balance` | انجام می‌شود |
| ساخت `fn_register_payment` | انجام می‌شود |
| جلوگیری از double-count | با `GREATEST(embedded_paid, tx_net)` انجام می‌شود |

---

## 10) قرارداد علامت مانده تماس

در `v_contact_balance`:

```text
balance = total_sales - total_received
```

- مقدار مثبت = مشتری بدهکار است.
- مقدار صفر = تسویه.
- مقدار منفی = مشتری بستانکار است / اضافه پرداخت کرده است.

این view فعلاً تمرکز بر مشتری/فروش دارد، نه مانده تامین‌کننده؛ چون تسک صراحتاً مانده مشتری را خواسته است.
