# 0027 — Visual Refresh Phase 2

## گام صفر

### 1) StatCard
مسیر: `components/shared/ui.tsx`، کامپوننت `StatCard`. در dashboard برای موجودی صندوق، فروش امروز، فروش ماه، ارزش انبار استفاده می‌شود.

### 2) کارت‌های لیست
- contacts: `app/(app)/contacts/page.tsx` کارت‌های clickable contact.
- products: `app/(app)/products/page.tsx` کارت‌های clickable product.

### 3) جدول‌ها
- sales: `app/(app)/sales/page.tsx`
- purchases: `app/(app)/purchases/page.tsx`

### 4) پس‌زمینه کلی
- `app/globals.css`
- `components/shared/app-shell.tsx`

### 5) رنگ برند
رنگ primary از CSS variable است:

```css
--primary: 165 65% 24%
```

و در Tailwind به صورت `bg-primary`, `text-primary` استفاده می‌شود.

## تغییرات

این فایل بعد از هر commit بصری به‌روزرسانی شد.
