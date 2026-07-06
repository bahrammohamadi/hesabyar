# 0047 — DatePicker conversion notes

## هدف
تمام فیلدهای تاریخ باید از DatePicker مشترک استفاده کنند و تجربه انتخابی/تقویمی داشته باشند، نه input متنی خام.

## وضعیت قبل از تغییر
کامپوننت مشترک `components/shared/date-picker.tsx` خودش یک input متنی بود و کاربر باید تاریخ را دستی تایپ می‌کرد.

## تغییر انجام‌شده
DatePicker مشترک به input بومی مرورگر تبدیل شد:

```tsx
<input type="date" />
```

ویژگی‌ها:

- کلیک روی فیلد، date picker بومی مرورگر را باز می‌کند.
- خروجی به شکل `YYYY-MM-DD` ذخیره می‌شود.
- اگر مقدار قدیمی به شکل شمسی `YYYY/MM/DD` باشد، برای نمایش در input به تاریخ میلادی قابل انتخاب تبدیل می‌شود.
- نمایش کمکی شمسی زیر فیلد باقی ماند.

## استفاده‌های موجود که خودکار پوشش داده شدند

grep نشان داد همه فیلدهای تاریخ اصلی از DatePicker مشترک استفاده می‌کنند:

- `ContactPanel` تاریخ تولد
- `contacts/[id]` تاریخ تولد
- `checks` تاریخ سررسید
- `crm/rfm` بازه تاریخ
- `inventory/as-of` تاریخ
- `inventory/stock-card` بازه تاریخ
- `sales/[id]` تاریخ فاکتور
- `purchases/[id]` تاریخ خرید
- `reports/customer-profitability`
- `reports/profitability`
- `reports/sellers`
- `sales/orders` تاریخ انقضا
- `crm-automation` تاریخ پیگیری بعدی

## فیلدهای خام باقی‌مانده
در grep، فیلد تاریخ خام قابل توجهی که date input یا DatePicker نباشد پیدا نشد؛ موارد دیگر مربوط به قیمت/تعداد یا نمایش تاریخ هستند.
