# مرحله ۱۴ — افزودن لینک قابل‌کشف گزارش‌های جدید

## گام صفر

### 1) محل Sidebar

فایل Sidebar:

```text
components/shared/sidebar.tsx
```

ساختار navigation به صورت آرایه `NAV` است. گروه گزارش‌ها:

```ts
{
  label: "گزارش‌ها",
  icon: BarChart3,
  children: [
    { href: "/reports/sales", label: "فروش", icon: TrendingUp },
    { href: "/reports/products", label: "کالا", icon: Package },
    { href: "/reports/profitability", label: "سود کالا/فاکتور", icon: TrendingUp },
    { href: "/reports/customer-profitability", label: "مشتریان سودآور", icon: Users },
    { href: "/reports/financial", label: "مالی", icon: Wallet },
    { href: "/reports/contacts", label: "اشخاص", icon: Users },
    { href: "/reports/sellers", label: "عملکرد فروشنده", icon: UserCheck },
    { href: "/activity", label: "فعالیت کاربران", icon: Activity },
  ]
}
```

تصمیم: لینک جدید در ابتدای همین گروه اضافه شود تا قابل کشف باشد، اما لینک‌های قدیمی بدون حذف/جابه‌جایی مخرب باقی بمانند.

---

### 2) صفحه اصلی `/reports`

فایل:

```text
app/(app)/reports/page.tsx
```

این صفحه تب‌های legacy دارد:

```text
sales, products, financial, contacts, profit
```

فضای مناسب برای معرفی گزارش‌های جدید بالای تب‌ها وجود دارد، بعد از PageHeader و قبل از محتوای گزارش.

تصمیم: یک Card/Banner ساده و غیرقابل‌بستن اضافه شود. dismiss/localStorage لازم نیست و پیچیدگی بی‌مورد ایجاد می‌کند.

---

### 3) Badge / New pattern

الگوی رسمی Badge جدید برای sidebar وجود ندارد، اما پروژه کلاس `.badge` در `globals.css` دارد و در جاهای مختلف استفاده می‌شود.

تصمیم: برای Sidebar، به دلیل محدودیت ساختار label string، عنوان آیتم به صورت:

```text
گزارش‌های جدید
```

اضافه می‌شود و Badge فقط در Banner صفحه `/reports` استفاده می‌شود.

---

## تغییرات اعمال‌شده

1. افزودن لینک Sidebar:

```text
/reports/overview-v2 → گزارش‌های جدید
```

2. افزودن Banner در صفحه legacy `/reports`:

```text
گزارش‌های جدید در دسترس است
نمای بدهکاران، سودآوری کالا و فروش روزانه با طراحی تازه
[مشاهده]
```

هیچ گزارش legacy حذف یا مخفی نشد.
