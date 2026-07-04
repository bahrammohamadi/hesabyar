# 0029 — تکمیل فیلدهای Contact/Product و ممیزی مجدد parity

## بخش ۱ — ContactPanel تکمیل شد

فیلدهای ContactModal قدیمی استخراج شدند:

```text
first_name
last_name
name
type
phone
email
birth_date
national_code
job_title
gender
address
description
```

در مسیر قدیمی، فیلدهای اضافه در `contacts.meta` ذخیره می‌شدند. همین الگو در `contact-service.ts` و `ContactPanel.tsx` حفظ شد.

### تغییرات Contact

- `ContactMutationInput` و `ContactUpdatePatch` گسترش یافتند.
- `toContactPayload` اکنون meta fields را به همان کلیدهای قدیمی می‌نویسد:

```text
first_name
last_name
email
birth_date
national_code
job_title
gender
```

- فرم ContactPanel create/edit اکنون همه فیلدهای ContactModal را دارد.
- `DatePicker` موجود پروژه برای تاریخ تولد استفاده شد.
- `code` مانند مسیر create قدیمی تولید خودکار است و read-only باقی ماند.

### تست Contact

با service-role یک contact تستی با همه فیلدها ساخته و سپس غیرفعال شد. خروجی DB:

```json
{
  "name": "نام تست نام خانوادگی تست",
  "phone": "09112223355",
  "type": "customer",
  "address": "آدرس تست",
  "description": "توضیح تست",
  "meta": {
    "first_name": "نام تست",
    "last_name": "نام خانوادگی تست",
    "email": "test-panel@example.com",
    "birth_date": "1400/01/02",
    "national_code": "1234567890",
    "job_title": "خریدار تست",
    "gender": "female"
  },
  "code": "MJ-C-00537"
}
```

Audit ثبت شد:

```text
contact create source=trigger
contact update source=trigger
```

---

## بخش ۲ — ProductPanel تکمیل شد اما ProductModal هنوز حذف نشد

فیلدهای ProductModal قدیمی:

```text
name
code
season
material
description
image_url
category_id
brand_id
low_stock_threshold
variants[]
```

ProductPanel اکنون فیلدهای زیر را اضافه گرفت:

```text
category_id
brand_id
image_url
```

برای category/brand از hookهای موجود پروژه استفاده شد:

```text
useCategories
useBrands
```

### دلیل حذف نشدن ProductModal

با اینکه فیلدهای پایه محصول کامل‌تر شدند، ProductModal قدیمی هنوز قابلیت‌هایی دارد که ProductPanel به همان شکل ندارد:

1. ساخت/ویرایش چند variant در یک فرم واحد.
2. ساخت product و چند variant همزمان در یک submit.
3. مسیر قدیمی UX برای مقداردهی اولیه چند واریانت در یک modal.

ProductPanel فعلی:

- create/update product دارد.
- create/update variant دارد.
- اما variantها را تک‌به‌تک اضافه/ویرایش می‌کند.

پس parity کامل نیست و ProductModal حذف نشد.

---

## بخش ۳ — حذف مشروط

### ContactModal

بعد از تکمیل فیلدها، `ContactModal` قدیمی در `app/(app)/contacts/page.tsx` حذف شد.

موارد حذف‌شده:

- stateهای مربوط به modal قدیمی:

```text
modalOpen
editing
initialType
```

- importهای بدون استفاده:

```text
Modal
DatePicker
Loader2
```

- دکمه «فرم قدیمی» در صفحه contacts حذف شد.

اکنون فقط مسیر جدید باقی است:

```text
شخص جدید → ContactPanel create
```

### ProductModal

حذف نشد.

---

## نتیجه نهایی parity

| Modal | نتیجه |
|---|---|
| `ContactModal` | حذف شد ✅ |
| `ProductModal` | نگه داشته شد ⚠️ |
| `ContactEditModal` در detail page | نگه داشته شد، چون context صفحه detail و code edit/meta legacy هنوز جداست |
| سایر Modalها | نگه داشته شدند |

---

## Build/Test

بعد از هر بخش build/test گرفته شد.

```text
npm run build ✅
npm test ✅
```
