# گزارش گام صفر — Search + Reports قبل از Migration 0019

> نوع بررسی: فقط SELECT از دیتابیس زنده Supabase  
> هدف: شناسایی ستون‌های واقعی جستجو/گزارش قبل از ساخت index/RPC/viewهای خواندنی

---

## 1) ستون‌های جستجوپذیر واقعی

### contacts

| ستون | نوع | وضعیت |
|---|---|---|
| `name` | text | موجود، not null |
| `phone` | text | موجود، nullable |
| `code` | text | موجود، nullable |
| `mobile` | - | وجود ندارد |

نتیجه: ایندکس trgm روی `name`, `phone`, `code` ساخته می‌شود. ایندکس `mobile` ساخته نمی‌شود چون ستون وجود ندارد.

---

### products

| ستون | نوع | وضعیت |
|---|---|---|
| `name` | text | موجود، not null |
| `code` | text | موجود، nullable |
| `sku` | - | روی products وجود ندارد |
| `barcode` | - | روی products وجود ندارد |
| `base_purchase_price` | bigint | موجود |

نتیجه: ایندکس trgm روی `products.name` و `products.code` ساخته می‌شود. ایندکس `products.sku/barcode` ساخته نمی‌شود چون این ستون‌ها روی جدول products وجود ندارند.

---

### product_variants

| ستون | نوع | وضعیت |
|---|---|---|
| `sku` | text | موجود، nullable |
| `barcode` | text | موجود، nullable |
| `purchase_price` | bigint | موجود، nullable |
| `sale_price` | bigint | موجود، nullable |

نتیجه: ایندکس trgm روی `product_variants.sku` و `product_variants.barcode` ساخته می‌شود.

---

## 2) ستون شماره سند

| جدول | ستون شماره سند |
|---|---|
| `sales` | `invoice_no` |
| `purchases` | `invoice_no` |

ستون‌های `doc_no` یا `number` وجود ندارند.

---

## 3) منبع قیمت خرید برای محاسبه سود

منابع موجود:

| منبع | وضعیت |
|---|---|
| `sale_items.cost_price` | وجود دارد و برای 2/2 ردیف فروش مقدار غیرصفر دارد |
| `product_variants.purchase_price` | وجود دارد و 363/366 variant مقدار غیرصفر دارد |
| `products.base_purchase_price` | وجود دارد، fallback سطح محصول |
| `purchase_items.unit_price` | وجود دارد اما در دیتابیس فعلی purchase_items = 0 ردیف |

### تصمیم محاسبه سود

برای گزارش سود، اولویت قیمت خرید به شکل زیر است:

```text
1) sale_items.cost_price اگر غیرصفر باشد — بهترین snapshot قیمت تمام‌شده در لحظه فروش
2) product_variants.purchase_price اگر موجود باشد
3) products.base_purchase_price اگر موجود باشد
4) میانگین purchase_items.unit_price برای همان variant اگر در آینده داده خرید وجود داشت
5) صفر
```

این روش باعث می‌شود فاکتورهای قدیمی با snapshot خودشان محاسبه شوند و تغییر قیمت فعلی محصول، سود تاریخی را خراب نکند.

---

## 4) وضعیت security_invoker viewهای قبلی

همه viewهای قبلی این option را دارند:

```text
security_invoker=true
```

Viewها:

```text
v_documents
v_document_lines
v_product_stock
v_document_balance
v_contact_balance
```

در migration 0019 هم همه report viewها با `WITH (security_invoker=true)` ساخته می‌شوند تا RLS جدول‌های پایه رعایت شود.

---

## 5) تعداد رکوردهای فعلی

| جدول | تعداد |
|---|---:|
| `contacts` | 532 |
| `products` | 366 |
| `product_variants` | 366 |
| `sales` | 3 |
| `sale_items` | 2 |
| `purchases` | 0 |
| `purchase_items` | 0 |
| `transactions` | 1 |
| `stock_movements` | 323 |

به‌دلیل حجم کم فعلی، در `EXPLAIN ANALYZE` ممکن است PostgreSQL برای برخی queryها Seq Scan انتخاب کند. این الزاماً بد نیست؛ با رشد داده، indexهای GIN trigram برای partial search مفید خواهند شد.

---

## 6) نمونه داده‌های قابل جستجو

### contacts

نمونه‌ها:

```text
گوران / 09044616394
یوسفی . / 09117764618
ماندانا عزیزی / 09115157134
```

### products / variants

نمونه‌ها:

```text
product.name = شال نخی سنگشور
product.code = 1360
variant.sku = 1360-01
barcode = فعلاً در نمونه‌ها null
```

### documents

شماره سند از `invoice_no` خوانده می‌شود. داده فروش فعلی invoice_no دارد اما در نمونه query مدیریتی به‌دلیل محدودیت WAF روی UNION/LIMIT یک query نمونه خطا داد؛ schema ستون تأیید شده است و تابع search روی `invoice_no` ساخته می‌شود.

---

## 7) تصمیم‌های اجرایی Migration 0019

| بخش | تصمیم |
|---|---|
| ایندکس contacts | `name`, `phone`, `code` |
| ایندکس products | `name`, `code` |
| ایندکس products.sku/barcode | ساخته نمی‌شود، ستون وجود ندارد |
| ایندکس product_variants | `sku`, `barcode` |
| ایندکس documents | `sales.invoice_no`, `purchases.invoice_no` |
| Search RPC | `fn_global_search(q, p_limit)` با فیلتر `org_id in (select user_org_ids())` |
| Report Views | همه با `security_invoker=true` |
| تاریخ گزارش‌ها | میلادی؛ تبدیل شمسی در Frontend انجام شود |
| Profit source | `sale_items.cost_price` سپس `product_variants.purchase_price` سپس `products.base_purchase_price` سپس میانگین خرید |
