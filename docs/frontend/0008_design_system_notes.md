# یادداشت فنی مرحله ۸ — Design System سبک فاز B

## هدف

این Design System برای Panelها و Workspaceهای آینده ساخته شده و موازی UI فعلی است. هیچ کامپوننت قدیمی حذف نشده است.

---

## مسیرها

```text
src/shared/ui/
src/shared/format/
app/(app)/dev/ui/page.tsx
```

---

## کامپوننت‌ها

### Button

```tsx
<Button>ذخیره</Button>
<Button variant="secondary">انصراف</Button>
<Button variant="danger" loading>حذف</Button>
<Button variant="ghost" size="sm">کم‌اهمیت</Button>
```

Variants:

```text
primary | secondary | danger | ghost
```

Sizes:

```text
sm | md
```

---

### IconButton

```tsx
<IconButton aria-label="گزینه‌ها"><MoreVertical /></IconButton>
```

---

### Input / NumberInput / Field

```tsx
<Field label="مبلغ" hint="به تومان نمایش داده می‌شود">
  <NumberInput value={amount} onValueChange={setAmount} />
</Field>
```

`NumberInput` ورودی اعداد فارسی/عربی/انگلیسی را normalize می‌کند و نمایش هزارگان دارد.

---

### Select / Textarea

```tsx
<Select defaultValue="confirmed">
  <option value="confirmed">تأییدشده</option>
</Select>

<Textarea placeholder="توضیحات" />
```

---

### Badge / StatusPill

```tsx
<Badge tone="success">موفق</Badge>
<StatusPill status="confirmed" />
<StatusPill kind="payment" status="partial" />
```

Document statuses:

| status | label |
|---|---|
| draft | پیش‌نویس |
| confirmed | تأییدشده |
| paid | پرداخت‌شده |
| settled | تسویه‌شده |
| reversed | برگشت‌خورده |
| cancelled | لغوشده |
| returned | مرجوعی |

Payment statuses:

| status | label |
|---|---|
| unpaid | پرداخت‌نشده |
| partial | پرداخت جزئی |
| paid | پرداخت‌شده |

---

### Card / Section

```tsx
<Section title="اطلاعات مشتری" description="خلاصه وضعیت">
  ...
</Section>
```

---

### DataTable

```tsx
<DataTable
  rows={rows}
  keyExtractor={(row) => row.id}
  columns={[
    { key: "name", header: "نام", render: (row) => row.name },
    { key: "amount", header: "مبلغ", align: "left", render: (row) => <Money value={row.amount} /> },
  ]}
/>
```

---

### PanelShell

قالب استاندارد پنل‌ها:

```tsx
<PanelShell title="ContactPanel" subtitle="مشتری" icon={<User />} onClose={closeTop} footer={<Button>ذخیره</Button>}>
  ...
</PanelShell>
```

Placeholderهای مرحله ۷ اکنون از همین PanelShell استفاده می‌کنند.

---

### Tabs

```tsx
<Tabs items={[{ value: "summary", label: "خلاصه", content: <Summary /> }]} />
```

---

### Spinner / Skeleton / EmptyState

```tsx
<Spinner />
<Skeleton className="h-8" />
<EmptyState title="داده‌ای نیست" />
```

---

### Toast

Provider در ریشه نصب شده است.

```tsx
const { toast } = useToast();
toast({ title: "ذخیره شد", tone: "success" });
```

---

## Formatters

مسیر:

```text
src/shared/format
```

### Money

```tsx
<Money value={24180000} tone="debt" />
```

از `formatToman` موجود استفاده می‌کند؛ مبالغ دیتابیس ریال هستند و نمایش تومان است.

### PersianDate

```tsx
<PersianDate value={date} />
```

از `dayjs + jalaliday` موجود استفاده می‌کند.

---

## Showcase

صفحه نمایش کامپوننت‌ها:

```text
/dev/ui
```

این route داخل `(app)` است، پس پشت login و AppShell قرار دارد.

---

## نکات مرحله بعد

از این به بعد Panelهای واقعی باید به جای کلاس‌ها/Modalهای پراکنده از این‌ها استفاده کنند:

```text
PanelShell
Section
Button
Field
StatusPill
Money
PersianDate
DataTable
Toast
```
