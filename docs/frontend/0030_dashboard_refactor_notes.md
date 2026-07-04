# 0030 — تفکیک ساختاری Dashboard

## هدف
بازسازی فایل بزرگ `app/(app)/dashboard/page.tsx` بدون تغییر رفتار، fetch، mutation یا RPC.

## تصمیم ساختاری
- منطق fetch/mutation در `dashboard/page.tsx` نگه داشته شد، چون:
  - رفتار Query Keyها و lifecycle فعلی تغییر نکند.
  - QuickSaleModal و QuickTxModal که mutation دارند دست‌نخورده بمانند.
  - ریسک تغییر رفتار داشبورد پایین بماند.
- فقط بخش‌های نمایشی استخراج شدند.

## فایل‌های جدید
- `app/(app)/dashboard/components/DashboardStats.tsx`
- `app/(app)/dashboard/components/DashboardQuickActions.tsx`
- `app/(app)/dashboard/components/DashboardSalesChart.tsx`
- `app/(app)/dashboard/components/DashboardRecentInvoices.tsx`
- `app/(app)/dashboard/components/DashboardLowStock.tsx`
- `app/(app)/dashboard/components/index.ts`

## رفتارهایی که عمداً بدون تغییر ماندند
- RPCهای داشبورد:
  - `dashboard_summary`
  - `sales_chart_30d`
- Queryهای مستقیم:
  - `sales` برای آخرین فاکتورها
  - `product_variants` برای کم‌موجودی‌ها
- باز شدن پنل فاکتور از آخرین فاکتورها.
- Ctrl/Cmd/Middle click برای fallback به صفحه `/sales/[id]`.
- دکمه‌های عملیات سریع، QuickSaleModal و QuickTxModal.
- سبد فروش سریع و ثبت فروش از داشبورد.

## نکته درباره Low Stock
در نسخه قبلی، query مربوط به `lowStockItems` اجرا می‌شد ولی لیستی از آیتم‌ها در UI رندر نمی‌شد؛ فقط شمارنده‌ی کم‌موجودی نمایش داده می‌شد. برای حفظ «بدون تغییر بصری/رفتاری»، کامپوننت `DashboardLowStock` فعلاً همان کارت شمارنده را رندر می‌کند و prop آیتم‌ها فقط برای آماده‌سازی ساختاری نگه داشته شده است.

## شواهد کنترل ریسک
- کاهش اندازه فایل اصلی از حدود ۹۰۰ خط به حدود ۵۲۰ خط.
- منطق داده‌ای در صفحه اصلی باقی ماند و فقط JSX بخش‌های dashboard به کامپوننت‌های کوچک‌تر منتقل شد.
