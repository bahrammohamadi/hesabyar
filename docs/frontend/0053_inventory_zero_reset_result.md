# 0053 — نتیجه صفر کردن موجودی کالاها

## درخواست
مالک درخواست کرد تمام موجودی کالاهای سازمان اصلی صفر شود تا شمارش و ورود مجدد دستی موجودی انجام شود.

## سازمان هدف

```text
org_id: ec60535d-6372-428a-92fe-06f1eb63f4b7
org_name: مزون پوشاک
```

## روش اجرا

برای حفظ تاریخچه و جلوگیری از تغییر مستقیم `stock_qty`، از RPC موجود استفاده شد:

```text
fn_add_stock_movement(..., p_type='adjust', p_qty=-stock_qty)
```

یعنی هیچ مقدار `product_variants.stock_qty` مستقیم update نشد؛ trigger موجودی مثل همیشه موجودی را اعمال کرد.

## Snapshot قبل از تغییر

برای حفظ سابقه، جدول snapshot ساخته/استفاده شد:

```text
public.stock_reset_snapshots
```

نتیجه snapshot:

```text
snapshot_rows: 326
stock_before_sum: 1546
```

## حرکات انبار ثبت‌شده

```text
reset_movements: 326
reset_qty_sum: -1546
note: صفر کردن موجودی برای شمارش مجدد دستی - 2026-07-05
```

## نتیجه بعد از اجرا

```text
active_variants: 371
nonzero: 0
total_stock: 0
```

## نکته مهم

هیچ محصول، مشتری، فاکتور، خرید یا audit حذف نشد. فقط برای واریانت‌های دارای موجودی، حرکت تعدیل انبار ثبت شد تا موجودی نهایی صفر شود.
