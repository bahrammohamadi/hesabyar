# 0058 — Final batch status

## بخش ۴ — استپر تعداد

اضافه شد:

```text
components/shared/quantity-stepper.tsx
```

استفاده شد در:

```text
app/(app)/purchases/page.tsx
components/shared/inventory-operation-page.tsx
```

سبد فروش POS از قبل دکمه‌های + و - داشت و حفظ شد.

## بخش ۵ — پیش‌فرض پرداخت نقدی

در `PosModal` و `QuickSaleModal` پرداخت نقدی به‌صورت خودکار برابر مبلغ قابل پرداخت قرار می‌گیرد، مگر اینکه کاربر checkbox «این فروش نسیه است» را فعال کند.

فایل‌ها:

```text
app/(app)/sales/page.tsx
app/(app)/dashboard/page.tsx
```
