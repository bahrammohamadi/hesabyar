# 0033 — ProductPanel multi-variant parity و حذف ProductModal

## بخش ۱ — تأیید قطعی deploy بصری قبلی روی Vercel

### محدودیت دسترسی
در این session توکن/CLI معتبر Vercel در محیط نبود؛ API رسمی Vercel بدون token پاسخ `403 missing authentication token` داد. بنابراین وضعیت Dashboard داخلی Vercel از API خوانده نشد.

### روش جایگزین قطعی
برای جلوگیری از حدس، production با session واقعی کاربر تست (`test@hesabyar.app`) fetch شد. کوکی Supabase SSR از login واقعی ساخته شد و مسیرهای محافظت‌شده production بدون redirect به login برگشتند.

Production deployment فعلی در assetها:

```text
dpl_5Efnao22nAgouEQLyMq8v2DJjDod
```

شواهد قطعی از production:

1. `/finance` در HTML production شامل کلاس جدید commit بصری 0031 بود:

```text
overflow-hidden rounded-[24px] border border-white/80 bg-white/90 shadow-sm shadow-slate-900/[0.04] backdrop-blur
```

2. `/sales` در chunk production شامل DataTable جدید commit 0032 بود:

```text
/_next/static/chunks/app/(app)/sales/page-61d829eb2a7406ec.js?dpl=dpl_5Efnao22nAgouEQLyMq8v2DJjDod
```

و داخل همان chunk این markerها وجود داشت:

```text
getRowProps
w-full min-w-[640px] text-right text-sm
header: "شماره فاکتور"
```

3. چون commit 0032 (`6d3ee95`) آخرین commit خطی بعد از 0030 و 0031 بود و همین commit روی production دیده شد، سه commit بصری قبلی روی production سرو می‌شوند.

## گام صفر — ممیزی ProductModal قدیمی

فایل قدیمی:

```text
app/(app)/products/page.tsx
```

رفتار ProductModal قبل از حذف:

- فرم create/edit محصول در یک Modal legacy بود.
- فیلدهای محصول:
  - name
  - code
  - season
  - material
  - category_id
  - brand_id
  - low_stock_threshold
  - description
  - image_url
- بخش تنوع‌ها داخل همان فرم بود.
- کاربر می‌توانست چند ردیف variant همزمان اضافه کند.
- هر ردیف variant شامل این فیلدها بود:
  - color
  - size
  - sku
  - barcode
  - purchase_price
  - sale_price
  - stock_qty اولیه
- با یک submit:
  - محصول insert/update می‌شد.
  - variantهای موجود update می‌شدند.
  - variantهای جدید insert می‌شدند.
  - موجودی اولیه variant جدید از مسیر insert مستقیم `stock_movements` ثبت می‌شد.

نکته مهم: ProductPanel قبلاً منطق امن‌تر `createVariant` در `src/core/services/product-service.ts` را داشت که موجودی اولیه را از `fn_add_stock_movement` ثبت می‌کند. در این تغییر همان منطق دوباره‌نویسی نشد؛ فقط UI چند ردیفی روی همان تابع ساخته شد.

## تغییرات ProductPanel

فایل:

```text
src/shared/panels/ProductPanel.tsx
```

### حالت create محصول
- بخش «تنوع‌های اولیه» به فرم ساخت کالا اضافه شد.
- چند ردیف variant می‌تواند همراه ساخت محصول ثبت شود.
- دکمه «افزودن ردیف دیگر» اضافه شد.
- بعد از ساخت محصول، ردیف‌های تکمیل‌شده به‌ترتیب با `createVariant` موجود ثبت می‌شوند.
- موجودی اولیه هر ردیف از همان مسیر `fn_add_stock_movement` ثبت می‌شود.

### تب واریانت‌ها برای محصول موجود
- در Section «افزودن واریانت جدید» دو حالت اضافه شد:
  - تکی
  - افزودن دسته‌ای
- حالت دسته‌ای چند ردیف variant نشان می‌دهد.
- دکمه‌های اضافه‌شده:
  - «افزودن ردیف دیگر»
  - «ذخیره همه»
  - «حذف» برای هر ردیف
- بعد از ذخیره موفق، toast خلاصه نمایش داده می‌شود:

```text
۳ واریانت اضافه شد
```

## حذف ProductModal

فایل:

```text
app/(app)/products/page.tsx
```

تغییرات:
- `ProductModal` حذف شد.
- دکمه «فرم قدیمی» حذف شد.
- دکمه ساخت کالا فقط ProductPanel را باز می‌کند.
- دکمه pencil روی لیست محصولات به‌جای Modal قدیمی، ProductPanel را در mode=`edit` باز می‌کند.
- fallback route `/products/[id]` حذف نشد.

## نتیجه ممیزی parity

پس از این تغییر، قابلیت‌های ProductModal لیست محصولات در ProductPanel پوشش داده شد:

| قابلیت | وضعیت در ProductPanel |
|---|---|
| ساخت محصول | ✅ |
| ویرایش محصول | ✅ |
| فیلدهای پایه محصول | ✅ |
| category/brand/image_url | ✅ |
| مشاهده واریانت‌ها | ✅ |
| افزودن یک واریانت | ✅ |
| افزودن چند واریانت با یک ذخیره | ✅ |
| موجودی اولیه واریانت جدید | ✅ از مسیر امن `fn_add_stock_movement` |
| ویرایش واریانت موجود | ✅ به‌صورت تک‌ردیفی در پنل |

تفاوت باقی‌مانده نسبت به Modal قدیمی:
- Modal قدیمی اجازه می‌داد چند variant موجود در یک فرم مشترک و با یک submit update شوند؛ ProductPanel ویرایش variant موجود را تک‌ردیفی انجام می‌دهد. این تفاوت حذف Modal را مسدود نکرد چون capability ویرایش variant موجود وجود دارد و عملیات موجودی/قیمت حساس‌تر و کنترل‌شده‌تر شده است.

## تست واقعی Supabase

با حساب تست production، یک محصول تستی با ۳ variant ساخته شد، برای هر variant موجودی اولیه با `fn_add_stock_movement` ثبت شد، سپس `v_product_stock` خوانده شد و در پایان محصول غیرفعال شد.

محصول تست:

```text
e62940bf-9898-49f5-900c-e753b9371d86
نام: تست مولتی واریانت پنل 1783186355
code: TP-MV-1783186355
is_active نهایی: false
```

واریانت‌ها و موجودی تأییدشده در `v_product_stock`:

| SKU | variant_id | expected | v_product_stock.current_stock |
|---|---|---:|---:|
| TP-MV-1783186355-M | 04888cf6-dffe-4233-adea-4b21c2b5aad3 | 2 | 2 |
| TP-MV-1783186355-L | 7858d1ca-4f32-48df-8380-c32f91b6f916 | 3 | 3 |
| TP-MV-1783186355-S | 99ba1f96-6e4f-4b77-9115-9f92a82f87e9 | 4 | 4 |

جزئیات خام تست در فایل زیر ذخیره شد:

```text
docs/frontend/0033_product_multivariant_test_result.json
```

## تغییر نکرد

- هیچ migration انجام نشد.
- هیچ RPC جدید ساخته نشد.
- منطق `createVariant`/`fn_add_stock_movement` دوباره‌نویسی نشد.
- مسیر fallback `/products/[id]` حفظ شد.
