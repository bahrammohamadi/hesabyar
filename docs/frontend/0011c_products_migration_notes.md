# مرحله ۱۱-ج — مهاجرت کلیک لیست Products به ProductPanel

## گام صفر

### 1) ساختار فعلی `/products`

مسیر:

```text
app/(app)/products/page.tsx
```

ساختار نمایش:

- لیست به صورت کارت محصول است، نه table.
- هر کارت محصول شامل header محصول و سپس لیست کوچک variantها در همان کارت است.
- Variantها زیرمجموعه کارت‌اند و به‌صورت badgeهای کوچک نمایش داده می‌شوند.

کلیک فعلی قبل از این مرحله:

- نام محصول از `components/shared/entity-link.tsx` استفاده می‌کرد.
- کلیک روی نام محصول به `/products/[id]` navigate می‌کرد.
- کلیک روی خود کارت رفتار خاصی نداشت.
- variantهای زیر کارت clickable نبودند.

---

### 2) استفاده EntityLink در این صفحه

در فایل `/products/page.tsx` فقط یک استفاده از EntityLink قدیمی وجود داشت:

```tsx
<EntityLink type="product" id={p.id}>{p.name}</EntityLink>
```

این EntityLink قدیمی route-based است. طبق تصمیم ۱۱-ب، EntityLink قدیمی سراسری تغییر نکرد.

---

### 3) قابلیت‌های صفحه کامل `/products/[id]` که در ProductPanel فعلی کامل نیست

صفحه کامل محصول امکانات بیشتری دارد:

- تب گردش انبار کامل (`stock_movements`)
- تب فروش‌های مرتبط
- تب خریدهای مرتبط
- دکمه تغییر قیمت (`PriceChangeModal`) با RPC `change_product_price`
- دکمه تعدیل موجودی (`AdjustModal`)
- ویرایش کامل محصول (`ProductEditModal`)
- محاسبه و نمایش سود/فروش/هزینه با جزئیات بیشتر

ProductPanel فعلی دارد:

- خلاصه محصول
- قیمت‌های پایه
- واریانت‌ها
- موجودی از `v_product_stock`
- create/edit/deactivate
- create/update variant

### تصمیم

شکاف‌ها بزرگ‌اند، مخصوصاً:

- تاریخچه قیمت
- گردش انبار کامل
- تعدیل موجودی
- گزارش فروش/خرید محصول

پس در این مرحله بازسازی نمی‌شوند. داخل ProductPanel دکمه «مشاهده صفحه کامل» اضافه می‌شود تا کاربر به fallback قدیمی برود.

---

### 4) Quick actions در `/products`

در خود لیست `/products` اکشن‌های داخلی کارت:

- `EntityActionMenu`
- دکمه edit که ProductModal قدیمی را باز می‌کند

دکمه‌های price/adjust مستقیم از لیست دیده نشدند؛ این‌ها در صفحه `/products/[id]` هستند.

---

### 5) محدودیت URL/refresh

مثل مرحله ۱۱-ب، PanelManager هنوز URL-sync ندارد.

اگر ProductPanel باز باشد و صفحه refresh شود:

```text
پنل بسته می‌شود
```

این محدودیت شناخته‌شده است و در این مرحله حل نشد. راه‌حل آینده: sync با query param مثل:

```text
?panel=product&id=...
```

---

## رفتار جدید

- کلیک ساده روی کارت محصول → `openEntity('product', id, { mode:'view' })`
- Ctrl/Cmd click روی کارت → `/products/[id]` در تب جدید
- middle-click روی کارت → `/products/[id]` در تب جدید
- لینک نام محصول همچنان `<a href="/products/[id]">` واقعی است، اما کلیک ساده را به panel تبدیل می‌کند
- EntityActionMenu و دکمه edit propagation را متوقف می‌کنند
- دکمه «کالای جدید» دو مسیر دارد:
  - «پنل جدید» → `openEntity('product', undefined, {mode:'create'})`
  - «فرم قدیمی» → ProductModal قدیمی

---

## تصمیم درباره EntityLink قدیمی

همان تصمیم ۱۱-ب حفظ شد:

- EntityLink قدیمی سراسری تغییر نکرد.
- فقط صفحه `/products` از pattern محلی کارت کلیک‌پذیر با fallback route استفاده می‌کند.
