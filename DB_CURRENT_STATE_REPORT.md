# گزارش وضعیت فعلی دیتابیس Hesabyar — فقط خواندنی

> پروژه: `hesabyar`  
> Stack: Next.js App Router + TypeScript + Supabase/PostgreSQL  
> هدف: شناخت وضعیت فعلی قبل از مهاجرت Entity/Document/Panel-based  
> وضعیت این گزارش: **هیچ تغییر دیتابیسی انجام نشده است**  

---

## 0) محدوده و روش بررسی

این گزارش بر اساس دو منبع تهیه شده است:

1. ساختار موجود در migrationهای پروژه در مسیر `supabase/migrations`.
2. کوئری‌های فقط-خواندنی که در فایل زیر آماده شده‌اند:

```text
DB_READONLY_AUDIT_QUERIES.sql
```

برای دریافت آمار واقعی دیتابیس Supabase، مخصوصاً تعداد دقیق رکوردها، باید فایل SQL بالا را در SQL Editor سوپابیس اجرا کنید. این SQL فقط شامل `SELECT` است و هیچ دستور تغییردهنده‌ای ندارد.

---

# 1) کوئری‌های استخراج وضعیت دیتابیس

فایل کامل کوئری‌ها در این مسیر آماده شده است:

```text
hesabyar/DB_READONLY_AUDIT_QUERIES.sql
```

این فایل موارد زیر را استخراج می‌کند:

1. لیست تمام جداول `public` همراه با تعداد تقریبی رکورد و حجم جدول.
2. تولید SQL برای شمارش دقیق رکوردهای هر جدول.
3. ساختار ستون‌های هر جدول: نام، نوع، nullable، default، primary key.
4. تمام Foreign Keyها.
5. تمام Indexها.
6. تمام Function/RPCها.
7. تمام Triggerها.
8. تمام Viewها.
9. وضعیت RLS و Policyها.
10. Extensionهای نصب‌شده.
11. Enum/typeهای سفارشی.
12. آمار تقریبی استفاده و حجم جدول‌ها.

---

# 2) دسته‌بندی مفهومی جداول فعلی

## 2.1 جداول مربوط به فروش

| جدول | نقش فعلی | وضعیت مفهومی |
|---|---|---|
| `sales` | سربرگ فاکتور فروش | اصلی / نگه‌داری شود |
| `sale_items` | اقلام فاکتور فروش | اصلی / نگه‌داری شود |
| `sales_orders` | سفارش فروش | قابل نگه‌داری، اما قابل ادغام مفهومی در Document model |
| `sales_order_items` | اقلام سفارش فروش | قابل نگه‌داری، اما قابل ادغام مفهومی |
| `sales_returns` | مرجوعی فروش | قابل نگه‌داری، اما در معماری هدف باید Document-type شود |
| `sales_return_items` | اقلام مرجوعی فروش | قابل نگه‌داری، اما قابل ادغام مفهومی |

### تحلیل

ساختار فعلی فروش بر اساس الگوی کلاسیک `header/items` ساخته شده است. این برای سیستم فعلی مناسب است، اما در معماری هدف Entity/Document-based، `sales`, `sales_orders`, `sales_returns` از نظر مفهومی همگی نوعی **Document** هستند.

بنابراین مشکل اصلی تکرار فیزیکی فوری نیست، بلکه **تکرار مدل مفهومی سند** است.

---

## 2.2 جداول مربوط به خرید

| جدول | نقش فعلی | وضعیت مفهومی |
|---|---|---|
| `purchases` | سربرگ فاکتور خرید | اصلی / نگه‌داری شود |
| `purchase_items` | اقلام فاکتور خرید | اصلی / نگه‌داری شود |
| `purchase_extra_costs` | هزینه‌های جانبی خرید | نگه‌داری شود، نیازمند استانداردسازی در Document model |
| `purchase_orders` | سفارش خرید | قابل نگه‌داری، اما قابل ادغام مفهومی |
| `purchase_order_items` | اقلام سفارش خرید | قابل نگه‌داری، اما قابل ادغام مفهومی |
| `purchase_returns` | مرجوعی خرید | قابل نگه‌داری، اما در معماری هدف باید Document-type شود |
| `purchase_return_items` | اقلام مرجوعی خرید | قابل نگه‌داری، اما قابل ادغام مفهومی |

### تحلیل

خرید مشابه فروش پیاده‌سازی شده و از الگوی `header/items` استفاده می‌کند. این از نظر عملیاتی مناسب است، اما برای معماری بلندمدت ERP بهتر است همه اینها به مدل اسناد یکپارچه نگاشت شوند.

---

## 2.3 جداول مربوط به کالا و انبار

| جدول | نقش فعلی | وضعیت مفهومی |
|---|---|---|
| `products` | کالای اصلی / master product | اصلی / نگه‌داری شود |
| `product_variants` | تنوع کالا: رنگ، سایز، SKU، قیمت، موجودی | اصلی / نگه‌داری شود |
| `categories` | دسته‌بندی کالا | نگه‌داری شود |
| `brands` | برند کالا | نگه‌داری شود |
| `stock_movements` | گردش انبار | اصلی / نگه‌داری شود |
| `product_price_history` | تاریخچه تغییر قیمت | نگه‌داری شود و در معماری هدف مهم است |
| `price_lists` | لیست قیمت | نگه‌داری شود |
| `price_list_items` | قیمت‌های اختصاصی در لیست قیمت | نگه‌داری شود |

### تحلیل

مدل کالا و انبار نسبتاً خوب جدا شده است:

- `products` برای هویت کالا.
- `product_variants` برای SKU/رنگ/سایز/قیمت/موجودی.
- `stock_movements` برای لاگ حرکات انبار.
- `product_price_history` برای audit قیمت.

نکته مهم:

`product_variants.stock_qty` یک مقدار snapshot/denormalized از موجودی است، در حالی که `stock_movements` هم منبع تاریخی موجودی است. این الزاماً اشتباه نیست، اما باید در معماری هدف روشن باشد:

- `stock_movements` = دفتر حرکات انبار / منبع audit.
- `product_variants.stock_qty` = مقدار سریع برای UI و عملیات روزانه.

---

## 2.4 جداول مربوط به مشتری / تامین‌کننده / CRM

| جدول | نقش فعلی | وضعیت مفهومی |
|---|---|---|
| `contacts` | مشتری، تامین‌کننده یا هر دو | اصلی / نگه‌داری شود |
| `contact_interactions` | تعاملات CRM | نگه‌داری شود، اما نیازمند تکمیل مدل CRM |
| `contact_balances` | View محاسبه مانده اشخاص | نگه‌داری شود به عنوان view/read model |

### تحلیل

استفاده از جدول واحد `contacts` برای مشتری و تامین‌کننده با معماری Entity-based سازگار است. این تصمیم بهتر از داشتن جداول جداگانه `customers` و `suppliers` است.

اما استفاده از `meta` در `contacts` برای داده‌های مهم CRM/کیف پول/اطلاعات جانبی باید کنترل شود. اگر داده‌ای عملیاتی و مالی است، بهتر است در آینده به جدول ساختارمند منتقل شود.

---

## 2.5 جداول مربوط به مالی

| جدول | نقش فعلی | وضعیت مفهومی |
|---|---|---|
| `accounts` | صندوق/بانک/حساب نقدی | نگه‌داری شود |
| `transactions` | تراکنش‌های مالی | نگه‌داری شود، اما برای ERP کامل کافی نیست |
| `expense_categories` | دسته‌بندی هزینه | نگه‌داری شود |
| `checks` | چک‌ها | نگه‌داری شود |

### تحلیل

مدل مالی فعلی بیشتر شبیه cashbook/transaction ledger ساده است، نه حسابداری دوبل کامل.

برای سیستم POS/ERP سبک فعلی قابل قبول است، اما برای ERP حسابداری کامل جداول زیر هنوز وجود ندارند:

- Chart of Accounts
- Journal Entries
- Journal Lines
- Fiscal Periods
- Payment Allocations
- Tax/VAT Profiles

بنابراین `transactions` باید فعلاً نگه داشته شود، اما در معماری آینده احتمالاً باید با مدل ledger/accounting تکمیل شود.

---

## 2.6 جداول سازمانی و سیستمی

| جدول | نقش فعلی | وضعیت مفهومی |
|---|---|---|
| `organizations` | سازمان / tenant | اصلی / نگه‌داری شود |
| `branches` | شعبه | نگه‌داری شود |
| `memberships` | عضویت کاربر در سازمان/شعبه و نقش | نگه‌داری شود |
| `settings` | تنظیمات key/value | نگه‌داری شود، اما نیازمند governance |
| `activity_logs` | لاگ فعالیت کاربران | نگه‌داری شود و برای audit ضروری است |

### تحلیل

ساختار multi-tenant فعلی مناسب است. وجود `org_id`, `branch_id`, `memberships` و RLS نشان می‌دهد پروژه از ابتدا برای SaaS یا چندسازمانی طراحی شده است.

---

# 3) Function/RPCهای فعلی از نظر مفهومی

بر اساس migrationها، Function/RPCهای مهم موجود شامل این موارد هستند:

| Function/RPC | نقش |
|---|---|
| `bootstrap_org` | ساخت اولیه سازمان |
| `dashboard_summary` | خلاصه داشبورد |
| `sales_chart_30d` | نمودار فروش ۳۰ روزه |
| `create_sale` | ایجاد فاکتور فروش با منطق تجاری |
| `create_purchase` | ایجاد فاکتور خرید با منطق تجاری |
| `cancel_sale` | لغو فروش |
| `update_sale_invoice` | ویرایش فاکتور فروش |
| `update_purchase_invoice` | ویرایش فاکتور خرید |
| `cancel_purchase` | لغو خرید |
| `record_sale_payment` | ثبت دریافت بابت فروش |
| `record_purchase_payment` | ثبت پرداخت بابت خرید |
| `spend_customer_wallet` | مصرف اعتبار/کیف پول مشتری |
| `apply_stock_movement` | اعمال حرکت انبار |
| `stock_card` | کاردکس کالا |
| `profit_loss_report` | گزارش سود و زیان |
| `cash_flow` | جریان نقدی |
| `has_permission` | بررسی دسترسی |
| `change_product_price` | تغییر قیمت کالا همراه با تاریخچه |

### تحلیل

وجود RPCها برای عملیات حساس مثبت است، چون منطق مالی/انبار نباید فقط در Frontend باشد.

در معماری هدف باید این RPCها به تدریج حول مدل جدید Document/Entity استاندارد شوند، اما فعلاً نباید حذف شوند.

---

# 4) وضعیت RLS و امنیت داده

بر اساس migrationها:

- RLS برای جداول اصلی فعال شده است.
- Policyهای مبتنی بر `org_id` و membership وجود دارند.
- جداول جدیدتر مانند orders/returns/checks/price_lists نیز policy دارند.

برای تأیید کامل روی دیتابیس واقعی، کوئری‌های بخش `8-A` و `8-B` در فایل SQL اجرا شود.

### نکته مهم

RLS باید در migrationهای آینده به‌صورت idempotent بررسی شود. هیچ جدول جدیدی نباید بدون RLS و policy مناسب وارد معماری Entity/Document شود.

---

# 5) Viewهای فعلی

View مهم شناسایی‌شده:

| View | نقش |
|---|---|
| `contact_balances` | محاسبه مانده مشتری/تامین‌کننده بر اساس اسناد و تراکنش‌ها |

### تحلیل

این view یک read model مفید است و با معماری Entity-based سازگار است، چون `ContactPanel` می‌تواند از آن برای نمایش مانده استفاده کند.

---

# 6) شناسایی تکرارها و ناسازگاری‌ها با معماری Entity/Document-based

## 6.1 خانواده اسناد فروش/خرید

### وضعیت فعلی

جداول زیر از نظر ساختاری شبیه هم هستند:

```text
sales + sale_items
purchases + purchase_items
sales_orders + sales_order_items
purchase_orders + purchase_order_items
sales_returns + sales_return_items
purchase_returns + purchase_return_items
```

### ناسازگاری مفهومی

در معماری هدف، همه اینها باید تحت مفهوم واحد زیر قرار بگیرند:

```text
Document
DocumentLine
DocumentType
DocumentStatus
```

### توصیه

فعلاً حذف یا ادغام فیزیکی انجام نشود. توصیه فعلی:

- نگه‌داری جداول فعلی.
- ساخت لایه read/model یا view در آینده برای Document abstraction.
- مهاجرت تدریجی به جدول‌های `documents` و `document_lines` فقط بعد از backup و mapping کامل.

---

## 6.2 تکرار اطلاعات season/material

در migrationها مشاهده می‌شود:

- `products.season`
- `products.material`
- `product_variants.season`
- `product_variants.material`
- `product_variants.collection`

### تحلیل

این می‌تواند قابل قبول باشد اگر season/material در سطح کالا و variant معنای متفاوت داشته باشد. اما اگر یک معنا دارند، خطر ناسازگاری ایجاد می‌شود.

### توصیه

فعلاً نگه داشته شود، اما در مستندات داده مشخص شود:

- کدام فیلد master است؟
- کدام فیلد override سطح variant است؟

---

## 6.3 قیمت global در برابر قیمت snapshot

### وضعیت فعلی

- قیمت عمومی کالا در `product_variants.sale_price` و `purchase_price`.
- قیمت سند در `sale_items.unit_price` و `purchase_items.unit_price`.
- تاریخچه قیمت در `product_price_history`.

### تحلیل

این ساختار با معماری هدف سازگار است، به شرطی که UI و RPCها قانون زیر را رعایت کنند:

> ویرایش قیمت داخل فاکتور نباید قیمت global کالا را بی‌صدا تغییر دهد.

### توصیه

نگه داشته شود. برای تغییر قیمت global باید audit از طریق `product_price_history` الزامی بماند.

---

## 6.4 مدل مالی ساده

### وضعیت فعلی

`transactions` نقش تراکنش مالی عمومی را دارد.

### ناسازگاری با ERP کامل

برای ERP حسابداری کامل، این مدل به تنهایی کافی نیست چون double-entry ledger ندارد.

### توصیه

فعلاً نگه داشته شود. در آینده باید با جداول ledger تکمیل شود، نه اینکه مستقیم حذف شود.

---

## 6.5 استفاده از `contacts.meta`

### وضعیت فعلی

`contacts` دارای ستون `meta` است.

### ریسک

اگر داده‌های مهم مالی/CRM داخل JSON بدون schema ذخیره شوند، گزارش‌گیری و integrity سخت می‌شود.

### توصیه

فعلاً نگه داشته شود. در آینده داده‌های پرتکرار و مهم از `meta` به ستون/جدول ساختارمند منتقل شوند.

---

# 7) توصیه وضعیت هر گروه جدول

## 7.1 نگه‌داری شود

این جداول ستون فقرات فعلی سیستم هستند و نباید حذف شوند:

```text
organizations
branches
memberships
contacts
products
product_variants
stock_movements
sales
sale_items
purchases
purchase_items
accounts
transactions
activity_logs
settings
```

---

## 7.2 نگه‌داری شود اما در معماری هدف استانداردسازی شود

```text
sales_orders
sales_order_items
purchase_orders
purchase_order_items
sales_returns
sales_return_items
purchase_returns
purchase_return_items
checks
price_lists
price_list_items
product_price_history
contact_interactions
purchase_extra_costs
expense_categories
```

---

## 7.3 نامزد ادغام مفهومی در آینده

این موارد فعلاً حذف نشوند، اما در طراحی آینده زیر مدل Document یکپارچه قرار بگیرند:

```text
sales
purchases
sales_orders
purchase_orders
sales_returns
purchase_returns
```

و جداول line متناظر:

```text
sale_items
purchase_items
sales_order_items
purchase_order_items
sales_return_items
purchase_return_items
```

---

## 7.4 نیازمند تکمیل در آینده

برای ERP/Accounting کامل، این موجودیت‌ها هنوز کم هستند:

```text
chart_of_accounts
journal_entries
journal_lines
fiscal_periods
payment_allocations
tax_profiles
document_audit_snapshots
inventory_cost_layers
```

---

# 8) نتیجه نهایی

وضعیت فعلی دیتابیس برای یک ERP/POS سبک فارسی مناسب و قابل توسعه است. ساختار کلی شامل چند بخش اصلی است:

- Multi-tenant پایه: خوب
- کالا و انبار: نسبتاً خوب
- فروش و خرید: عملیاتی و قابل استفاده
- مشتری/تامین‌کننده: مناسب برای Entity-based
- مالی: کاربردی اما نه حسابداری دوبل کامل
- گزارش و dashboard: مبتنی بر RPC/View و قابل توسعه

مهم‌ترین نکته برای مهاجرت آینده:

> در مرحله فعلی نباید هیچ جدول عملیاتی حذف یا ادغام فیزیکی شود. ابتدا باید یک لایه Entity/Document abstraction ساخته شود و جداول فعلی به عنوان legacy operational tables حفظ شوند.

---

# 9) چک‌لیست قبل از هر migration آینده

برای هر migration بعدی:

- [ ] خروجی کامل `DB_READONLY_AUDIT_QUERIES.sql` ذخیره شود.
- [ ] تعداد رکورد جداول حساس ثبت شود.
- [ ] Backup از دیتابیس گرفته شود.
- [ ] Migration شامل UP و DOWN باشد.
- [ ] همه `CREATE`ها با `IF NOT EXISTS` باشند.
- [ ] همه `ALTER`ها با بررسی وجود ستون/جدول باشند.
- [ ] هیچ `DROP` بدون backup و mapping انجام نشود.
- [ ] تغییرات قیمت/موجودی snapshot و audit داشته باشند.
- [ ] RLS و policy برای جدول جدید تعریف شود.
- [ ] اجرای دوباره migration خطا ندهد.
