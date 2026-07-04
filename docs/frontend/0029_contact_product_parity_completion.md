# 0029 — تکمیل فیلدهای Contact/Product و ممیزی مجدد parity

## بخش Contact — انجام‌شده

فیلدهای ContactModal قدیمی استخراج و به ContactPanel اضافه شدند:

```text
first_name
last_name
email
birth_date
national_code
job_title
gender
```

این فیلدها مانند مسیر قدیمی در `contacts.meta` ذخیره می‌شوند.

## وضعیت تست Contact

- `npm run build` پاس شد.
- `npm test` پاس شد.

تست واقعی دیتابیس برای contact هنوز در مرحله نهایی بعد از ProductPanel/ممیزی کامل انجام می‌شود تا هر دو entity با هم گزارش شوند.

## وضعیت حذف ContactModal

فعلاً حذف نشده تا بعد از تکمیل Product و ممیزی نهایی یکجا تصمیم‌گیری شود.
