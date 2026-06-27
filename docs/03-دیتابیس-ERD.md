# مرحله ۳ — طراحی دیتابیس و ERD کامل

> نسخه ۱.۰ | پایگاه داده Supabase (PostgreSQL)
> این سند نقشه‌ی کامل دیتابیس است. فایل اجرایی SQL در `supabase/migrations/0001_initial_schema.sql` قرار دارد.

---

## ۱. اصول طراحی (روی همه جداول اعمال شده)

هر جدول این ستون‌های مشترک را دارد:

| ستون | نوع | توضیح |
|---|---|---|
| `id` | `uuid` | کلید اصلی (تولید خودکار) |
| `org_id` | `uuid` | سازمان (برای SaaS و جداسازی داده) |
| `branch_id` | `uuid` | شعبه (برای multi-branch آینده) |
| `created_at` | `timestamptz` | زمان ایجاد |
| `updated_at` | `timestamptz` | زمان آخرین ویرایش (با trigger) |
| `created_by` | `uuid` | کاربر سازنده (از auth.users) |

برای حذف نرم: جداول اصلی `is_active boolean` یا `deleted_at` دارند.

---

## ۲. نمودار رابطه‌ای (ERD) — متنی

```
organizations (سازمان)
   │1
   ├──< branches (شعبه)
   ├──< memberships (عضویت کاربر+نقش)  >── auth.users
   ├──< categories (دسته‌بندی)
   ├──< brands (برند)
   ├──< products (محصول)
   │       │1
   │       └──< product_variants (تنوع: رنگ/سایز/SKU/بارکد)
   │                   │1
   │                   └──< stock_movements (حرکت موجودی)
   ├──< contacts (اشخاص: مشتری/تامین‌کننده)
   ├──< purchases (فاکتور خرید) >── contacts(supplier)
   │       │1
   │       ├──< purchase_items >── product_variants
   │       └──< purchase_extra_costs (هزینه جانبی)
   ├──< sales (فاکتور فروش) >── contacts(customer)
   │       │1
   │       └──< sale_items >── product_variants
   ├──< accounts (صندوق/بانک)
   ├──< expense_categories (دسته هزینه)
   ├──< transactions (تراکنش مالی: دریافت/پرداخت/هزینه/انتقال)
   └──< settings (تنظیمات سازمان)
```

---

## ۳. شرح جداول

### گروه «پایه و امنیت»

#### `organizations` — سازمان (کسب‌وکار)
| ستون | نوع | توضیح |
|---|---|---|
| id, created_at, updated_at | | مشترک |
| name | text | نام کسب‌وکار |
| owner_id | uuid | مالک (auth.users) |
| currency | text | واحد پول، پیش‌فرض `IRT` |
| logo_url | text | لوگو (Storage) |
| is_active | boolean | فعال |

#### `branches` — شعبه
نام، آدرس، تلفن، org_id، is_active. (نسخه اول: یک شعبه «شعبه اصلی»)

#### `memberships` — عضویت کاربر در سازمان
کاربر (user_id) + org_id + branch_id + role (`owner/manager/cashier/inventory/accountant`) + is_active.
> مبنای کنترل دسترسی و RLS.

---

### گروه «کالا و انبار»

#### `categories` — دسته‌بندی محصول
name, parent_id (سلسله‌مراتبی), org_id.

#### `brands` — برند
name, org_id.

#### `products` — محصول
| ستون | نوع | توضیح |
|---|---|---|
| name | text | نام محصول |
| category_id | uuid | دسته‌بندی |
| brand_id | uuid | برند |
| description | text | توضیح |
| image_url | text | تصویر (Storage) |
| base_purchase_price | bigint | قیمت خرید پایه (ریال) |
| base_sale_price | bigint | قیمت فروش پایه (ریال) |
| low_stock_threshold | int | حد کم‌موجودی |
| is_active | boolean | |

#### `product_variants` — تنوع محصول (مهم برای پوشاک)
| ستون | نوع | توضیح |
|---|---|---|
| product_id | uuid | محصول والد |
| color | text | رنگ |
| size | text | سایز |
| sku | text | کد کالا (یکتا در سازمان) |
| barcode | text | بارکد |
| purchase_price | bigint | قیمت خرید این تنوع (می‌تواند خالی=از محصول) |
| sale_price | bigint | قیمت فروش این تنوع |
| stock_qty | int | موجودی فعلی (فقط با حرکت انبار تغییر می‌کند) |
| is_active | boolean | |

#### `stock_movements` — حرکت موجودی (تاریخچه کامل)
| ستون | نوع | توضیح |
|---|---|---|
| variant_id | uuid | تنوع |
| type | text | `in/out/adjust/transfer_in/transfer_out` |
| reason | text | `purchase/sale/manual/count/transfer/return` |
| qty | int | تعداد (مثبت/منفی بسته به نوع) |
| ref_table | text | جدول مرجع (sales/purchases...) |
| ref_id | uuid | شناسه مرجع |
| note | text | توضیح |
| from_branch_id / to_branch_id | uuid | برای انتقال |

> trigger موجودی تنوع را به‌روز می‌کند. هیچ‌گاه stock_qty را دستی تغییر نده.

---

### گروه «اشخاص»

#### `contacts` — اشخاص (مشتری/تامین‌کننده/هردو)
| ستون | نوع | توضیح |
|---|---|---|
| name | text | نام |
| type | text | `customer/supplier/both` |
| phone | text | تماس |
| address | text | آدرس |
| description | text | توضیح |
| credit_limit | bigint | سقف اعتبار (آینده) |
| tags | text[] | برچسب‌ها (آماده CRM) |
| meta | jsonb | فیلدهای آزاد آینده (CRM/AI) |
| is_active | boolean | |

> مانده حساب محاسباتی است (از transactions و فاکتورها). یک VIEW به نام `contact_balances` آن را می‌دهد.

---

### گروه «خرید»

#### `purchases` — فاکتور خرید
| ستون | نوع | توضیح |
|---|---|---|
| supplier_id | uuid | تامین‌کننده (contacts) |
| invoice_no | text | شماره فاکتور (خودکار) |
| date | timestamptz | تاریخ |
| subtotal | bigint | جمع اقلام |
| extra_total | bigint | جمع هزینه‌های جانبی |
| discount | bigint | تخفیف |
| tax | bigint | مالیات (فعلاً ۰) |
| total | bigint | مبلغ نهایی |
| paid | bigint | پرداخت‌شده |
| status | text | `draft/confirmed/cancelled` |
| note | text | |

#### `purchase_items` — اقلام خرید
purchase_id, variant_id, qty, unit_price, line_total, (سهم هزینه جانبی برای قیمت تمام‌شده).

#### `purchase_extra_costs` — هزینه جانبی خرید
purchase_id, title, amount, allocation (`by_qty/by_value`) — برای سرشکن‌کردن روی قیمت تمام‌شده.

---

### گروه «فروش»

#### `sales` — فاکتور فروش
| ستون | نوع | توضیح |
|---|---|---|
| customer_id | uuid | مشتری (اختیاری) |
| invoice_no | text | شماره فاکتور (خودکار) |
| date | timestamptz | تاریخ |
| subtotal | bigint | جمع اقلام |
| discount | bigint | تخفیف کل |
| tax | bigint | مالیات (فعلاً ۰) |
| total | bigint | مبلغ نهایی |
| paid_cash | bigint | نقد |
| paid_card | bigint | کارت |
| paid_credit | bigint | نسیه (بدهی مشتری) |
| account_id | uuid | حساب دریافت‌کننده وجه |
| status | text | `draft/confirmed/cancelled/returned` |
| note | text | |

#### `sale_items` — اقلام فروش
sale_id, variant_id, qty, unit_price, discount, line_total, cost_price (قیمت تمام‌شده لحظه فروش برای محاسبه سود).

---

### گروه «مالی»

#### `accounts` — صندوق و بانک
| ستون | نوع | توضیح |
|---|---|---|
| name | text | نام (صندوق، بانک ملت...) |
| type | text | `cash/bank` |
| bank_name | text | نام بانک |
| account_no | text | شماره حساب/کارت |
| opening_balance | bigint | مانده اولیه |
| is_active | boolean | |

> مانده فعلی = مانده اولیه + جمع تراکنش‌ها (VIEW: `account_balances`).

#### `expense_categories` — دسته‌بندی هزینه
name, org_id (مثل: اجاره، حقوق، حمل‌ونقل، تبلیغات...).

#### `transactions` — تراکنش مالی (قلب بخش مالی)
| ستون | نوع | توضیح |
|---|---|---|
| type | text | `receipt`(دریافت)/`payment`(پرداخت)/`expense`(هزینه)/`transfer`(انتقال)/`income`(درآمد متفرقه) |
| amount | bigint | مبلغ (همیشه مثبت؛ جهت با type) |
| date | timestamptz | تاریخ |
| account_id | uuid | حساب درگیر (مبدأ) |
| to_account_id | uuid | مقصد (فقط برای transfer) |
| contact_id | uuid | شخص مرتبط (مشتری/تامین‌کننده) |
| expense_category_id | uuid | دسته هزینه (برای expense) |
| ref_table / ref_id | | اتصال به فاکتور فروش/خرید |
| method | text | `cash/card/transfer/cheque` |
| note | text | |

> این جدول منبع حقیقت برای صندوق، بانک، مانده اشخاص و سود/زیان است.

#### `settings` — تنظیمات سازمان
key/value (jsonb): مالیات، شماره‌گذاری فاکتور، اطلاعات چاپ، و...

---

## ۴. ویوها و توابع کلیدی (Views & Functions)

| نام | نوع | کار |
|---|---|---|
| `account_balances` | VIEW | مانده هر صندوق/بانک |
| `contact_balances` | VIEW | مانده (بدهی/طلب) هر شخص |
| `low_stock_variants` | VIEW | کالاهای کم‌موجود |
| `dashboard_summary` | FUNCTION | اعداد داشبورد (فروش امروز/ماه، هزینه، سود) |
| `create_sale` | FUNCTION (RPC) | ثبت اتمیک فروش + موجودی + تراکنش |
| `create_purchase` | FUNCTION (RPC) | ثبت اتمیک خرید + موجودی + تراکنش |
| `set_updated_at` | TRIGGER | به‌روزرسانی updated_at |
| `apply_stock_movement` | TRIGGER | به‌روزرسانی stock_qty |

---

## ۵. آمادگی برای آینده (بدون تغییر ساختار فعلی)
- **CRM:** `contacts.tags`, `contacts.meta (jsonb)` + جداول آینده (interactions, notes) با همان org_id.
- **Multi-user/branch:** `memberships` + `branch_id` روی همه جداول از حالا هست.
- **AI Analytics:** همه تراکنش‌ها و حرکات با تاریخ دقیق ذخیره می‌شوند → داده تمیز برای تحلیل.
- **Multi-tenant SaaS:** `org_id` روی همه‌چیز.

---

## ۶. RLS (امنیت سطر به سطر)
سیاست کلی روی همه جداول دارای org_id:
> کاربر فقط رکوردهایی را می‌بیند/تغییر می‌دهد که `org_id` آن‌ها جزو سازمان‌هایی است که او در `memberships` عضو فعال آن است.

جزئیات در فایل SQL پیاده شده است.
