# 0046 — CRM SMS segment export feasibility

## وضعیت داده‌های موجود

بر اساس بررسی production برای org اصلی:

```text
total active contacts: 534
with phone: 521
with birth_date: 424
with wallet_credit > 0: 0
with credit_limit > 0: 0
```

بنابراین سگمنت «تولد نزدیک» از نظر داده‌ای قابل پیاده‌سازی است، چون تاریخ تولد برای تعداد زیادی از مخاطبان پر شده است.

## تعریف سگمنت‌ها

### 1) تولد نزدیک

قابل پیاده‌سازی با:

```text
contacts.meta->>'birth_date'
contacts.phone
```

پیشنهاد تعریف:

```text
مشتریانی که تولدشان در ۷ یا ۳۰ روز آینده است.
```

### 2) اعتبار رو به اتمام

چند تفسیر ممکن دارد:

#### الف) کیف پول / wallet_credit
در کد loyalty و sales از این فیلد استفاده شده است:

```text
contacts.meta.wallet_credit
```

اما در داده فعلی:

```text
with_wallet_credit > 0 = 0
```

پس فعلاً این سگمنت با داده فعلی خروجی معنادار ندارد.

#### ب) سقف اعتبار نسیه / credit_limit
جدول contacts فیلد دارد:

```text
credit_limit
```

اما در داده فعلی:

```text
with_credit_limit > 0 = 0
```

پس این هم فعلاً قابل استفاده نیست مگر سیاست credit_limit واقعاً پر شود.

#### ج) بدهی نزدیک به سقف مجاز
نیازمند `v_contact_balance.balance` و `contacts.credit_limit` است. از نظر schema قابل پیاده‌سازی است، اما چون credit_limit پر نیست، فعلاً خروجی عملی ندارد.

### 3) مشتریان غیرفعال / بی‌خرید طولانی

این از نظر داده موجود قابل پیاده‌سازی است:

```text
sales.customer_id
sales.date
contacts.phone
```

پیشنهاد تعریف:

```text
مشتریانی که در ۹۰ روز اخیر خرید نداشته‌اند.
```

## SQL نمونه — فقط SELECT

### تولد نزدیک ۳۰ روز آینده

```sql
select
  c.name,
  c.phone,
  c.meta->>'birth_date' as birth_date
from public.contacts c
where c.is_active = true
  and c.phone is not null
  and c.meta->>'birth_date' is not null
  and (
    to_date(to_char(current_date, 'YYYY') || substring(c.meta->>'birth_date' from 5), 'YYYY/MM/DD')
    between current_date and current_date + interval '30 days'
    or
    to_date((to_char(current_date, 'YYYY')::int + 1)::text || substring(c.meta->>'birth_date' from 5), 'YYYY/MM/DD')
    between current_date and current_date + interval '30 days'
  );
```

نکته: اگر birth_date به شمسی ذخیره شده باشد، این query باید با منطق تقویم شمسی دقیق‌تر شود. برای export ساده، می‌توان ماه/روز را text مقایسه کرد یا در app layer محاسبه کرد.

### اعتبار کیف پول رو به اتمام

```sql
select
  c.name,
  c.phone,
  (c.meta->>'wallet_credit')::numeric as wallet_credit
from public.contacts c
where c.is_active = true
  and c.phone is not null
  and coalesce((c.meta->>'wallet_credit')::numeric, 0) between 1 and 500000;
```

### بدهی نزدیک به سقف اعتبار

```sql
select
  c.name,
  c.phone,
  c.credit_limit,
  b.balance
from public.contacts c
join public.v_contact_balance b on b.contact_id = c.id
where c.is_active = true
  and c.phone is not null
  and c.credit_limit > 0
  and b.balance >= c.credit_limit * 0.8;
```

### مشتریان غیرفعال ۹۰ روزه

```sql
with last_sale as (
  select customer_id, max(date) as last_sale_at
  from public.sales
  where customer_id is not null
  group by customer_id
)
select
  c.name,
  c.phone,
  last_sale.last_sale_at
from public.contacts c
left join last_sale on last_sale.customer_id = c.id
where c.is_active = true
  and c.phone is not null
  and (last_sale.last_sale_at is null or last_sale.last_sale_at < now() - interval '90 days');
```

## فرمت خروجی پیشنهادی

اکثر پنل‌های پیامکی ایرانی CSV ساده قبول می‌کنند:

```text
name,phone
```

پیشنهاد خروجی پایه:

```csv
name,phone,segment,extra
```

اما باید از کاربر/پنل پیامکی مقصد پرسیده شود:

- کاوه‌نگار؟
- ملی‌پیامک؟
- فراز اس‌ام‌اس؟
- پنل اختصاصی؟
- آیا ستون‌ها فقط شماره هستند یا نام هم می‌پذیرد؟
- آیا شماره باید `09...` باشد یا `989...`؟

## نتیجه امکان‌سنجی

| سگمنت | امکان‌پذیری | وضعیت داده |
|---|---|---|
| تولد نزدیک | قابل پیاده‌سازی | داده کافی دارد |
| اعتبار کیف پول رو به اتمام | از نظر schema ممکن | داده فعلی wallet_credit ندارد |
| نزدیک به سقف اعتبار نسیه | از نظر schema ممکن | credit_limit فعلاً پر نیست |
| مشتریان غیرفعال | قابل پیاده‌سازی | داده فروش موجود است |
