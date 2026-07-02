# گزارش گام صفر — بررسی ساختار sales/purchases قبل از Migration 0013

> نوع بررسی: فقط خواندنی، بر اساس migrationهای موجود پروژه  
> هدف: شناخت نام واقعی جدول اقلام، ستون‌های مبلغ/تاریخ/پرداخت/قیمت واحد قبل از ساخت read-model یکپارچه Document

---

## 1) جدول فروش: `public.sales`

### ستون‌های اصلی

| ستون | نوع | Nullable | Default / Constraint | توضیح |
|---|---|---:|---|---|
| `id` | uuid | no | `gen_random_uuid()` / PK | شناسه فاکتور فروش |
| `org_id` | uuid | no | FK → `organizations(id)` | سازمان |
| `branch_id` | uuid | yes | FK → `branches(id)` | شعبه؛ از قبل وجود دارد |
| `customer_id` | uuid | yes | FK → `contacts(id)` | مشتری |
| `invoice_no` | text | yes | - | شماره فاکتور |
| `date` | timestamptz | no | `now()` | تاریخ سند |
| `subtotal` | bigint | no | `0` | جمع قبل از تخفیف/مالیات |
| `discount` | bigint | no | `0` | مبلغ تخفیف |
| `tax` | bigint | no | `0` | مالیات |
| `total` | bigint | no | `0` | مبلغ کل |
| `paid_cash` | bigint | no | `0` | پرداخت نقدی |
| `paid_card` | bigint | no | `0` | پرداخت کارتی |
| `paid_credit` | bigint | no | `0` | نسیه/مانده اعتباری، پرداخت‌شده نیست |
| `account_id` | uuid | yes | FK → `accounts(id)` | حساب دریافت وجه |
| `status` | text | no | default `confirmed`, legacy check: `draft/confirmed/cancelled/returned` | وضعیت فعلی فروش |
| `note` | text | yes | - | توضیح |
| `discount_type` | text | no | default `fixed` | افزوده شده در migration بعدی |
| `discount_value` | numeric | no | default `0` | مقدار تخفیف |
| `cancelled_at` | timestamptz | yes | - | لغو legacy |
| `cancelled_by` | uuid | yes | FK → `auth.users(id)` | لغوکننده legacy |
| `cancel_reason` | text | yes | - | علت لغو |

### نام‌های واقعی ستون‌های مهم فروش

| مفهوم | نام واقعی ستون |
|---|---|
| مبلغ کل | `total` |
| تخفیف | `discount` |
| مبلغ پرداختی | `paid_cash + paid_card`؛ ستون `paid_credit` پرداخت نیست و مانده/نسیه است |
| تاریخ | `date` |
| وضعیت | `status` |

---

## 2) جدول اقلام فروش: `public.sale_items`

> نام واقعی جدول اقلام فروش: `sale_items`  
> جدول `sale_lines` وجود ندارد.

| ستون | نوع | Nullable | Default / Constraint | توضیح |
|---|---|---:|---|---|
| `id` | uuid | no | `gen_random_uuid()` / PK | شناسه قلم |
| `org_id` | uuid | no | FK → `organizations(id)` | سازمان |
| `branch_id` | uuid | yes | FK → `branches(id)` | شعبه |
| `sale_id` | uuid | no | FK → `sales(id)` | فاکتور فروش |
| `variant_id` | uuid | no | FK → `product_variants(id)` | تنوع کالا |
| `qty` | int | no | - | تعداد |
| `unit_price` | bigint | no | `0` | قیمت واحد snapshot زمان فاکتور |
| `discount` | bigint | no | `0` | تخفیف قلم |
| `line_total` | bigint | no | `0` | جمع خط |
| `cost_price` | bigint | no | `0` | قیمت تمام‌شده snapshot برای سود |
| `created_at` | timestamptz | no | `now()` | ایجاد |
| `updated_at` | timestamptz | no | `now()` | به‌روزرسانی |
| `created_by` | uuid | yes | FK → `auth.users(id)` | کاربر ایجادکننده |

### وضعیت snapshot قیمت فروش

`unit_price` در `sale_items` وجود دارد؛ بنابراین قیمت خط فاکتور snapshot است و تغییر قیمت فعلی محصول نباید فاکتور قدیمی را تغییر دهد.

---

## 3) جدول خرید: `public.purchases`

### ستون‌های اصلی

| ستون | نوع | Nullable | Default / Constraint | توضیح |
|---|---|---:|---|---|
| `id` | uuid | no | `gen_random_uuid()` / PK | شناسه فاکتور خرید |
| `org_id` | uuid | no | FK → `organizations(id)` | سازمان |
| `branch_id` | uuid | yes | FK → `branches(id)` | شعبه؛ از قبل وجود دارد |
| `supplier_id` | uuid | yes | FK → `contacts(id)` | تامین‌کننده |
| `invoice_no` | text | yes | - | شماره فاکتور |
| `date` | timestamptz | no | `now()` | تاریخ سند |
| `subtotal` | bigint | no | `0` | جمع اقلام |
| `extra_total` | bigint | no | `0` | هزینه جانبی |
| `discount` | bigint | no | `0` | تخفیف |
| `tax` | bigint | no | `0` | مالیات |
| `total` | bigint | no | `0` | مبلغ کل |
| `paid` | bigint | no | `0` | مبلغ پرداختی |
| `status` | text | no | default `confirmed`, legacy check: `draft/confirmed/cancelled` | وضعیت فعلی خرید |
| `note` | text | yes | - | توضیح |
| `discount_type` | text | no | default `fixed` | افزوده شده در migration بعدی |
| `discount_value` | numeric | no | default `0` | مقدار تخفیف |
| `cancelled_at` | timestamptz | yes | - | لغو legacy |
| `cancelled_by` | uuid | yes | FK → `auth.users(id)` | لغوکننده legacy |
| `cancel_reason` | text | yes | - | علت لغو |

### نام‌های واقعی ستون‌های مهم خرید

| مفهوم | نام واقعی ستون |
|---|---|
| مبلغ کل | `total` |
| تخفیف | `discount` |
| مبلغ پرداختی | `paid` |
| تاریخ | `date` |
| وضعیت | `status` |

---

## 4) جدول اقلام خرید: `public.purchase_items`

> نام واقعی جدول اقلام خرید: `purchase_items`  
> جدول `purchase_lines` وجود ندارد.

| ستون | نوع | Nullable | Default / Constraint | توضیح |
|---|---|---:|---|---|
| `id` | uuid | no | `gen_random_uuid()` / PK | شناسه قلم |
| `org_id` | uuid | no | FK → `organizations(id)` | سازمان |
| `branch_id` | uuid | yes | FK → `branches(id)` | شعبه |
| `purchase_id` | uuid | no | FK → `purchases(id)` | فاکتور خرید |
| `variant_id` | uuid | no | FK → `product_variants(id)` | تنوع کالا |
| `qty` | int | no | - | تعداد |
| `unit_price` | bigint | no | `0` | قیمت واحد snapshot زمان فاکتور خرید |
| `line_total` | bigint | no | `0` | جمع خط |
| `created_at` | timestamptz | no | `now()` | ایجاد |
| `updated_at` | timestamptz | no | `now()` | به‌روزرسانی |
| `created_by` | uuid | yes | FK → `auth.users(id)` | کاربر ایجادکننده |

### وضعیت snapshot قیمت خرید

`unit_price` در `purchase_items` وجود دارد؛ بنابراین قیمت خط خرید snapshot است و تغییر قیمت فعلی محصول نباید فاکتور قدیمی خرید را تغییر دهد.

---

## 5) نکات مهم برای Migration 0013

1. `branch_id` از قبل در `sales` و `purchases` وجود دارد؛ migration باید `ADD COLUMN IF NOT EXISTS` استفاده کند و خطا ندهد.
2. `status` از قبل وجود دارد اما check legacy دارد:
   - فروش: `draft/confirmed/cancelled/returned`
   - خرید: `draft/confirmed/cancelled`
3. برای جلوگیری از شکست migration و ناسازگاری با داده/کد فعلی، migration نباید constraint قدیمی status را حذف یا محدودتر کند.
4. read-model `v_documents` می‌تواند legacy status را به status استاندارد document normalize کند:
   - `cancelled` → `reversed`
   - `returned` → `reversed`
5. `unit_price` در هر دو جدول اقلام وجود دارد؛ backfill لازم نیست.
6. `product_id` در اقلام مستقیماً وجود ندارد، اما از طریق `product_variants.product_id` قابل استخراج است.
