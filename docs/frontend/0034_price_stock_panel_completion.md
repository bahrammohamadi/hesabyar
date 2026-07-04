# 0034 — ProductPanel price/stock completion و ممیزی حذف Modalها

## بخش ۱ — تب تاریخچه قیمت در ProductPanel

### گام صفر: رفتار PriceChangeModal قدیمی
فایل بررسی‌شده:

```text
app/(app)/products/[id]/page.tsx
```

`PriceChangeModal` قدیمی:
- فرم دو فیلدی داشت:
  - `purchasePrice` قیمت خرید به تومان
  - `salePrice` قیمت فروش به تومان
- گزینه `applyToVariants` داشت و پیش‌فرض آن `true` بود.
- با submit، RPC زیر را صدا می‌زد:

```ts
supabase.rpc("change_product_price", {
  p_product: product.id,
  p_purchase_price: purchaseRial,
  p_sale_price: saleRial,
  p_apply_variants: applyToVariants,
  p_reason: "تغییر قیمت از جزئیات کالا",
})
```

- سپس `logActivity` با action=`price_change` ثبت می‌کرد.
- RPC موجود در DB (`supabase/migrations/0006_retail_core_hardening.sql`) خودش این کارها را انجام می‌دهد:
  - insert در `product_price_history` برای product
  - update روی `products.base_purchase_price/base_sale_price`
  - اگر `p_apply_variants=true` باشد، برای هر variant فعال:
    - insert جدا در `product_price_history`
    - update روی `product_variants.purchase_price/sale_price`

### تغییرات کد
فایل:

```text
src/core/services/product-service.ts
```

اضافه شد:
- `getPriceHistory(productId)` برای خواندن `product_price_history`
- `changePrice(input)` که فقط RPC موجود `change_product_price` را صدا می‌زند
- `useProductPriceHistory(productId)`
- `useChangeProductPrice()`

فایل:

```text
src/shared/panels/ProductPanel.tsx
```

اضافه شد:
- تب جدید «تاریخچه قیمت»
- جدول DataTable شامل:
  - تاریخ
  - دامنه کالا/واریانت
  - قیمت قبلی خرید/فروش
  - قیمت جدید خرید/فروش
  - تغییردهنده (`created_by`)
  - دلیل
- فرم مینیمال «تغییر قیمت»:
  - قیمت خرید جدید
  - قیمت فروش جدید
  - دلیل اختیاری
  - اعمال روی همه واریانت‌های فعال

### تست واقعی بخش ۱
با حساب تست production یک محصول و یک variant ساخته شد؛ سپس RPC `change_product_price` صدا زده شد و `product_price_history` خوانده شد. در انتها محصول غیرفعال شد.

محصول تست:

```text
id: c518275a-5b08-410c-af6b-49e0186eeaae
code: TP-PH-1783187060
name: تست تاریخچه قیمت پنل 1783187060
is_active نهایی: false
```

نتیجه قیمت:

| بخش | قبل | بعد |
|---|---:|---:|
| product.base_purchase_price | 1000000 | 1200000 |
| product.base_sale_price | 1500000 | 1800000 |
| variant.purchase_price | 1000000 | 1200000 |
| variant.sale_price | 1500000 | 1800000 |

`product_price_history` دو رکورد صحیح ثبت کرد:
- یک رکورد برای خود product
- یک رکورد برای variant به‌دلیل `p_apply_variants=true`

فایل خام نتیجه تست:

```text
docs/frontend/0034_price_history_test_result.json
```

### Build/Test بخش ۱

```text
next build: passed
vitest: 2 files / 8 tests passed
```

## بخش ۲ — تعدیل موجودی مستقیم در ProductPanel

### گام صفر: رفتار AdjustModal قدیمی
فایل بررسی‌شده:

```text
app/(app)/products/[id]/page.tsx
```

`AdjustModal` قدیمی:
- لیست همه واریانت‌های محصول را نمایش می‌داد.
- برای هر variant مقدار «موجودی فعلی» را در input قرار می‌داد.
- کاربر مقدار جدید را وارد می‌کرد.
- هنگام ذخیره، برای هر variant اختلاف زیر محاسبه می‌شد:

```ts
newStock - currentStock
```

- اگر اختلاف صفر نبود، مستقیم در `stock_movements` insert می‌کرد:

```ts
type: "adjust"
reason: "count"
qty: diff
```

نکته: طبق فاز A مسیر امن‌تر موجود `fn_add_stock_movement` است. در ProductPanel از همان RPC موجود استفاده شد و insert مستقیم `stock_movements` دوباره‌نویسی نشد.

### تغییرات کد
فایل:

```text
src/core/services/product-service.ts
```

اضافه شد:
- `adjustStock(input)` که فقط RPC موجود `fn_add_stock_movement` را با `p_type='adjust'` صدا می‌زند.
- `useAdjustProductStock()` برای invalidation و toast.

فایل:

```text
src/shared/panels/ProductPanel.tsx
```

در تب «واریانت‌ها» اضافه شد:
- دکمه «تعدیل موجودی» کنار هر variant
- فرم مینیمال تعدیل با دو حالت:
  - ثبت موجودی جدید
  - افزایش/کاهش نسبت به موجودی فعلی
- فیلد دلیل
- ثبت از مسیر `fn_add_stock_movement`
- refresh شدن queryهای product و stock بعد از ثبت

### تست واقعی بخش ۲
با حساب تست production و یک سازمان تست جدا، محصول و variant تستی ساخته شد. ابتدا موجودی اولیه ۵ ثبت شد، سپس تعدیل +۳ انجام شد و `v_product_stock` دوباره خوانده شد. در پایان محصول غیرفعال شد.

محصول تست:

```text
id: 392a87e6-589a-45d8-be69-4c4db613ebf4
code: TP-ADJ-1783187348
name: تست تعدیل موجودی پنل 1783187348
is_active نهایی: false
```

نتیجه موجودی:

| مرحله | current_stock در v_product_stock |
|---|---:|
| قبل از تعدیل | 5 |
| تعدیل | +3 |
| بعد از تعدیل | 8 |

رکورد `stock_movements` تعدیل:

```text
type: adjust
reason: adjust
qty: 3
note: تست تعدیل مستقیم ProductPanel
```

فایل خام نتیجه تست:

```text
docs/frontend/0034_stock_adjust_test_result.json
```

### Build/Test بخش ۲

```text
next build: passed
vitest: 2 files / 8 tests passed
```

## بخش ۳ — ممیزی و حذف مشروط Modalها

### نتیجه ممیزی نهایی

| Modal | نتیجه | دلیل |
|---|---|---|
| `PriceChangeModal` | ✅ حذف شد | ProductPanel حالا تب «تاریخچه قیمت» و فرم تغییر قیمت دارد و همان RPC رسمی `change_product_price` را صدا می‌زند؛ history هم در `product_price_history` نمایش داده می‌شود. |
| `AdjustModal` | ✅ حذف شد | ProductPanel حالا از کنار هر variant فرم «تعدیل موجودی» دارد و به‌جای insert مستقیم، از RPC موجود `fn_add_stock_movement` با `p_type='adjust'` استفاده می‌کند. |
| `ProductEditModal` | ✅ حذف شد | ProductPanel فرم edit کامل‌تر دارد: فیلدهای ProductEditModal + image_url + قیمت‌های پایه. دکمه edit صفحه detail به ProductPanel mode=`edit` منتقل شد. |
| `ContactEditModal` | ⚠️ نگه داشته شد | ContactPanel تقریباً همه فیلدها را دارد، اما در صفحه detail فیلد `code` هنوز قابل ویرایش است؛ در ContactPanel طبق تصمیم قبلی code read-only/auto-generated است. بنابراین حذف ContactEditModal بدون تصمیم محصولی درباره کد مخاطب ریسک دارد. |

### تغییرات کد بخش ۳

فایل:

```text
app/(app)/products/[id]/page.tsx
```

حذف شد:
- `ProductEditModal`
- `PriceChangeModal`
- `AdjustModal`
- stateهای `editOpen`, `priceOpen`, `adjustOpen`
- insert مستقیم stock_movements در AdjustModal legacy

جایگزین شد با:
- `openEntity("product", id, { mode: "edit" })` برای ویرایش
- `openEntity("product", id, { props: { initialTab: "price-history" } })` برای action قیمت
- `openEntity("product", id, { props: { initialTab: "variants" } })` برای action تعدیل موجودی

فایل:

```text
src/shared/panels/ProductPanel.tsx
```

- پشتیبانی از `panel.props.initialTab` اضافه شد تا صفحات detail بتوانند کاربر را مستقیم به تب مربوط بفرستند.

### تست/ممیزی بخش ۳

- grep بعد از حذف روی فایل product detail هیچ موردی از این‌ها برنگرداند:

```text
ProductEditModal
PriceChangeModal
AdjustModal
```

- `ContactEditModal` عمداً باقی ماند و حذف نشد.

### Build/Test بخش ۳

```text
next build: passed
vitest: 2 files / 8 tests passed
```
