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
