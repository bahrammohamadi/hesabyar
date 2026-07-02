# گزارش گام صفر — ساختار فعلی `stock_movements` قبل از Migration 0014

> نوع بررسی: فقط‌خواندنی، از دیتابیس زنده Supabase و migrationهای موجود  
> هدف: تثبیت جدول موجودی بدون تغییر مخرب و بدون حذف داده

---

## 1) وضعیت کلی

| مورد | نتیجه |
|---|---|
| جدول موجود است؟ | بله ✅ |
| تعداد رکورد فعلی | `323` |
| جدول اقلام فروش | `sale_items` |
| جدول اقلام خرید | `purchase_items` |
| محصول چندگونه | بله، از طریق `product_variants` |
| ستون مستقیم محصول در stock_movements | ندارد |
| ستون variant | دارد: `variant_id` |
| stock سریع فعلی | `product_variants.stock_qty` |
| stock محاسباتی/audit | `SUM(stock_movements.qty)` |
| trigger به‌روزرسانی موجودی | دارد: `trg_apply_stock` → `apply_stock_movement()` |

---

## 2) ستون‌های فعلی `public.stock_movements`

| # | ستون | نوع | Nullable | Default | توضیح |
|---:|---|---|---:|---|---|
| 1 | `id` | uuid | no | `gen_random_uuid()` | شناسه حرکت |
| 2 | `org_id` | uuid | no | - | سازمان |
| 3 | `branch_id` | uuid | yes | - | شعبه |
| 4 | `variant_id` | uuid | no | - | تنوع کالا، FK به `product_variants(id)` |
| 5 | `type` | text | no | - | جهت/اثر حرکت فعلی، نه نوع تجاری |
| 6 | `reason` | text | no | `'manual'` | نوع/علت تجاری حرکت |
| 7 | `qty` | integer | no | - | مقدار حرکت، در عمل علامت‌دار است |
| 8 | `ref_table` | text | yes | - | معادل `ref_type`، مثل `sales` یا `purchases` |
| 9 | `ref_id` | uuid | yes | - | شناسه سند مرجع |
| 10 | `from_branch_id` | uuid | yes | - | انتقال از شعبه |
| 11 | `to_branch_id` | uuid | yes | - | انتقال به شعبه |
| 12 | `note` | text | yes | - | توضیح |
| 13 | `created_at` | timestamptz | no | `now()` | زمان ایجاد |
| 14 | `updated_at` | timestamptz | no | `now()` | زمان به‌روزرسانی |
| 15 | `created_by` | uuid | yes | - | کاربر ایجادکننده |

---

## 3) Foreign Keyها

| ستون | جدول مقصد | رفتار حذف |
|---|---|---|
| `org_id` | `organizations(id)` | cascade |
| `branch_id` | `branches(id)` | set null |
| `from_branch_id` | `branches(id)` | set null |
| `to_branch_id` | `branches(id)` | set null |
| `variant_id` | `product_variants(id)` | cascade |
| `created_by` | `auth.users(id)` | default/no action |

---

## 4) وضعیت `type` و `reason`

### نکته بسیار مهم معماری

در دیتابیس فعلی، ستون `type` معنای «نوع تجاری» ندارد. این ستون برای جهت/اثر موجودی استفاده می‌شود:

```text
in, out, adjust, transfer_in, transfer_out
```

نوع تجاری یا علت حرکت در ستون `reason` نگه‌داری می‌شود:

```text
purchase, sale, manual, count, transfer, return, opening
```

بنابراین در Migration 0014 ستون جدید `type` ساخته نمی‌شود و معنای ستون فعلی تغییر داده نمی‌شود، چون این کار داده و کد موجود را می‌شکند. برای نوع تجاری از `reason` استفاده می‌شود.

---

## 5) مقادیر فعلی type/reason

| type | reason | تعداد | min(qty) | max(qty) | sum(qty) |
|---|---|---:|---:|---:|---:|
| `in` | `opening` | 258 | 1 | 65 | 1386 |
| `out` | `opening` | 63 | 1 | 14 | 162 |
| `out` | `sale` | 2 | -1 | -1 | -2 |

### تحلیل علامت qty

- برای فروش‌های واقعی، `qty` منفی ثبت شده است: `type='out', reason='sale', qty=-1`.
- برای ورودی‌های افتتاحیه، `qty` مثبت است.
- چند رکورد `type='out', reason='opening'` با `qty` مثبت وجود دارد، اما چون trigger فعلی مستقیماً `stock_qty = stock_qty + qty` انجام می‌دهد، در این پروژه «مقدار واقعی اثر موجودی» همان علامت خود `qty` است، نه صرفاً `type`.

نتیجه:

> در `v_product_stock` موجودی باید مستقیم از `SUM(qty)` محاسبه شود و نباید دوباره بر اساس `type` علامت‌دهی شود.

---

## 6) اتصال به sales/purchases

اتصال سندی فعلی از طریق این دو ستون انجام می‌شود:

| مفهوم معماری | ستون واقعی |
|---|---|
| `ref_type` | `ref_table` |
| `ref_id` | `ref_id` با نوع uuid |

نمونه رکوردهای فروش:

```text
ref_table = sales
ref_id    = شناسه sales.id
reason    = sale
type      = out
qty       = -1
```

---

## 7) آیا `balance_after` وجود دارد؟

خیر. ستون `balance_after` در وضعیت فعلی وجود ندارد.

در migration 0014 به‌صورت nullable و idempotent اضافه می‌شود.

---

## 8) آیا `warehouse_id` وجود دارد؟

خیر. ستون `warehouse_id` وجود ندارد.

در migration 0014 برای آینده‌پذیری اضافه می‌شود، بدون FK فعلاً، چون جدول warehouse در schema فعلی وجود ندارد.

---

## 9) موجودی فعلی از کجا خوانده می‌شود؟

در schema فعلی:

- جدول `products` ستون `stock` ندارد.
- جدول `product_variants` ستون `stock_qty` دارد.
- trigger `trg_apply_stock` بعد از insert/delete روی `stock_movements` مقدار `product_variants.stock_qty` را به‌روزرسانی می‌کند.

پس:

| منبع | نقش |
|---|---|
| `product_variants.stock_qty` | موجودی سریع فعلی برای UI و عملیات |
| `stock_movements.qty` | دفتر حرکات و منبع محاسباتی/audit |

---

## 10) اعتبارسنجی موجودی فعلی

نتیجه بررسی دیتابیس زنده:

```text
تعداد variants: 366
SUM(product_variants.stock_qty): 1546
تعداد stock_movements: 323
SUM(stock_movements.qty): 1546
تعداد مغایرت variantها: 0
```

بنابراین:

> فعلاً هیچ backfill اصلاحی موجودی لازم نیست.

---

## 11) تصمیم اجرایی برای Migration 0014

| درخواست | تصمیم امن بر اساس ساختار واقعی |
|---|---|
| افزودن `type` semantic | انجام نمی‌شود چون `type` فعلی جهت حرکت است و تغییر آن مخرب است |
| استفاده از `movement_type` | لازم نیست؛ `reason` نقش نوع تجاری را دارد |
| افزودن `ref_type` | انجام نمی‌شود؛ `ref_table` معادل واقعی آن است |
| افزودن `ref_id` text | انجام نمی‌شود؛ `ref_id` فعلی uuid است و برای sales/purchases مناسب است |
| افزودن `warehouse_id` | انجام می‌شود |
| افزودن `balance_after` | انجام می‌شود |
| افزودن `created_by` | وجود دارد؛ دست نمی‌زنیم |
| ساخت `v_product_stock` | انجام می‌شود، بر اساس `SUM(qty)` |
| ساخت RPC `fn_add_stock_movement` | انجام می‌شود، با mapping semantic p_type به `type/reason/qty` |
