# 0041 — نتیجه بروزرسانی مخاطبان از PDF

## ورودی

فایل:

```text
/home/user/uploads/00.pdf
```

استخراج دقیق‌تر با token-position انجام شد تا نام و نام خانوادگی که در استخراج ساده به هم چسبیده بودند تا حد ممکن جدا شوند.

## خروجی استخراج

```text
parsed rows: 530
rows with phone: 510
rows with birthdate: 431
rows with separated last_name: 430
```

فایل CSV:

```text
contacts_from_00_pdf.csv
```

## نتیجه dry-run قبل از update

```text
pdf_rows_with_phone: 512
matched_existing_contacts: 512
pdf_rows_with_birthdate: 424
matched_with_birthdate: 424
```

## نتیجه update واقعی

```text
updated_contacts: 512
inserted_main_memberships_for_phone_user: 1
deactivated_other_memberships_for_phone_user: 1
```

## وضعیت بعد از update

```text
contacts_main: 537
contacts_with_first_name: 513
contacts_with_birth_date: 425
phone_user_active_memberships: 1
```

## عضویت‌های کاربر 09111558263

```text
active: org مزون پوشاک / role owner
inactive: سازمان تست پنل
```

## نمونه‌های تأیید شده

```text
بهرام محمدی / 09111558263 / first_name=بهرام / last_name=محمدی
مهرنوش رسولی / 09112555937 / birth_date=1369/05/05
مائده فلاح / 09213504421 / birth_date=1371/07/16
```

## نکته امنیت داده

هیچ contact، sale، purchase یا audit حذف نشد. فقط فیلدهای contact موجود بر اساس phone در org اصلی بروزرسانی شدند.
