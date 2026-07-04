# 0018 — Quick-create مشتری در جریان فروش

## گام صفر

جریان فروش/QuickSale/POS از کامپوننت زیر برای انتخاب مشتری استفاده می‌کند:

```text
components/shared/contact-selector.tsx
```

این selector از قبل یک حالت create داشت و برخلاف فرم کامل ContactModal، فقط دو فیلد اصلی می‌گرفت:

```text
نام
شماره تماس
```

اما مشکل آن این بود که هنوز مستقیم به Supabase وصل می‌شد:

```ts
supabase.from("contacts").insert(...)
```

و از service layer جدید استفاده نمی‌کرد.

## تصمیم

- UI مینیمال موجود حفظ شد چون دقیقاً مناسب quick-create فروش است.
- منطق ساخت contact به `useCreateContact()` از `contact-service.ts` منتقل شد.
- بعد از ساخت موفق، همان contact بلافاصله به `onSelect` داده می‌شود.
- toast موفقیت/خطا از service نمایش داده می‌شود.
- queryهای selector و contacts با mutation hook invalidate می‌شوند.

## مسیرهای تحت تأثیر

هرجا `ContactSelector` استفاده شده، quick-create جدید را دریافت می‌کند، از جمله:

```text
Sales PosModal
Dashboard QuickSaleModal
Purchase supplier picker اگر filterType=supplier باشد
```

## منطق validation

از service موجود استفاده می‌شود:

```text
name الزامی
phone اگر وارد شود باید معتبر باشد
```

## حذف/تغییر Modalهای قدیمی

هیچ Modal قدیمی حذف نشد.
