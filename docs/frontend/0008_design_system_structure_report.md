# گزارش گام صفر — Design System سبک فاز B

> نوع بررسی: فقط خواندن کد، بدون تغییر  
> هدف: تعیین اینکه UI Foundation جدید باید روی چه چیزهایی بنا شود و چه چیزهایی را تکرار نکند.

---

## 1) کامپوننت‌های UI فعلی

کامپوننت‌های فعلی در دو مسیر هستند:

```text
components/shared/ui.tsx
components/ui/tabs.tsx
```

### `components/shared/ui.tsx`

شامل:

- `PageHeader`
- `StatCard`
- `Spinner`
- `EmptyState`
- `Modal`

همچنین در `app/globals.css` کلاس‌های پایه وجود دارند:

```text
.btn
.btn-primary
.btn-secondary
.btn-danger
.card
.input
.label
.table-base
.badge
```

### نتیجه

این‌ها برای UI فعلی مناسب‌اند و نباید حذف شوند. Design System جدید موازی در مسیر زیر ساخته می‌شود:

```text
src/shared/ui/
```

هدف این است که Panelهای آینده از کامپوننت‌های جدید استفاده کنند، بدون اینکه UI فعلی بشکند.

---

## 2) ThemeProvider و Theme System

ThemeProvider فعلی:

```text
components/shared/theme-provider.tsx
lib/theme.ts
```

ویژگی‌ها:

- `ThemeProvider` روی client اجرا می‌شود.
- theme از `localStorage` خوانده می‌شود.
- `applyTheme` CSS variables را روی `documentElement` تنظیم می‌کند.
- `applyMode` حالت light/dark/system را مدیریت می‌کند.
- `DEFAULT_MODE = light` است.
- dark mode از کلاس `.dark` در `globals.css` استفاده می‌کند.

### نتیجه

Design System جدید باید از CSS variables فعلی استفاده کند و فقط semantic tokenهای کمبود را اضافه کند.

---

## 3) Tailwind و رنگ‌ها

`tailwind.config.ts` از CSS variables برای این رنگ‌ها استفاده می‌کند:

```text
background
foreground
card
popover
primary
secondary
muted
accent
destructive
border
input
ring
brand
rose
```

فونت:

```text
Vazirmatn, Tahoma, sans-serif
```

در `globals.css` رنگ‌های base و dark تعریف شده‌اند.

### کمبودها

توکن‌های semantic مالی هنوز کامل نیستند:

```text
success
warning
info
finance-profit
finance-loss
finance-debt
finance-credit
```

در مرحله ۸ این tokenها اضافه می‌شوند، بدون تغییر tokenهای فعلی.

---

## 4) تاریخ و اعداد فارسی

فایل موجود:

```text
lib/utils/format.ts
```

شامل:

- `toFaDigits`
- `toEnDigits`
- `formatToman`
- `tomanToRial`
- `rialToToman`
- `formatNumber`
- `toJalali`
- `todayJalali`
- `fullJalali`

کتابخانه تاریخ:

```text
dayjs + jalaliday
```

### نتیجه

در `src/shared/format` wrapper سبک ساخته می‌شود که از همین توابع استفاده کند، نه اینکه logic جدید و ناسازگار بسازد.

---

## 5) cn / clsx / tailwind-merge

فایل موجود:

```text
lib/utils/cn.ts
```

وابستگی‌ها:

```text
clsx
tailwind-merge
```

### نتیجه

تمام کامپوننت‌های جدید از همین `cn` استفاده می‌کنند.

---

## 6) تصمیم مسیر کامپوننت‌های جدید

چون UI فعلی در `components/shared` است و نباید شکسته شود، مسیر جدید طبق فاز B ساخته می‌شود:

```text
src/shared/ui/
src/shared/format/
```

این مسیرها برای Panelهای جدید فاز ۹ به بعد استفاده می‌شوند.

---

## 7) انتخاب‌های کلیدی Design System

| تصمیم | دلیل |
|---|---|
| ساخت موازی در `src/shared/ui` | عدم شکستن UI فعلی |
| استفاده از CSS variables موجود | سازگاری با ThemeProvider فعلی |
| اضافه کردن tokenهای semantic | نیاز مالی/ERP برای status و finance state |
| wrapper format روی `lib/utils/format.ts` | جلوگیری از دوباره‌کاری و ناسازگاری |
| کامپوننت‌های ضروری فقط | مینیمال و مناسب مراحل ۹/۱۰/۱۱ |
| Showcase در `/dev/ui` داخل `(app)` | پشت auth و AppShell فعلی، امن‌تر از route عمومی |

---

## 8) کامپوننت‌هایی که ساخته می‌شوند

```text
Button
IconButton
Input
NumberInput
Field
Select
Textarea
Badge
StatusPill
Card
Section
DataTable
PanelShell
Tabs
Spinner
Skeleton
EmptyState
Toast/useToast
```

این‌ها هسته لازم برای:

- ContactPanel
- ProductPanel
- InvoicePanel
- Workspace tables
- Picker/Panel polishing

هستند.
