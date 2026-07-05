# 0037 — ContactPanel CRM/Transactions completion

## گام صفر — ممیزی مودال‌های قدیمی

### InteractionModal قدیمی
فایل:

```text
app/(app)/contacts/[id]/page.tsx
```

فیلدها:

- `type`: نوع تعامل با گزینه‌های `note`, `call`, `followup`, `meeting`
- `title`: عنوان
- `description`: توضیح/یادداشت

جدول مقصد:

```text
contact_interactions
```

کد قدیمی مستقیم insert می‌کرد:

```ts
supabase.from("contact_interactions").insert({
  org_id,
  contact_id,
  type,
  title,
  description,
})
```

در schema جدول، فیلدهای اضافه هم وجود دارد:

```text
next_followup, created_at, updated_at, created_by
```

بنابراین ContactPanel نسخه کامل‌تر را پوشش می‌دهد و `next_followup` را هم اضافه کرده است.

### TxModal قدیمی
فایل:

```text
app/(app)/contacts/[id]/page.tsx
```

فیلدها:

- `amount` مبلغ به تومان
- `account_id` حساب
- `note` توضیح
- `type`: از بیرون modal به‌صورت `receipt` یا `payment` می‌آمد

رفتار:

- از `fn_register_payment` استفاده نمی‌کرد.
- مستقیم در جدول `transactions` insert می‌کرد.
- `method` را همیشه `cash` می‌گذاشت.

کد قدیمی:

```ts
supabase.from("transactions").insert({
  org_id,
  branch_id,
  type,
  amount,
  account_id,
  contact_id,
  method: "cash",
  note,
})
```

ContactPanel جدید این را کامل‌تر پوشش می‌دهد:

- نوع: دریافت/پرداخت
- مبلغ
- حساب
- روش: نقد، کارت، انتقال، چک، سایر
- یادداشت

## تغییرات سرویس

فایل:

```text
src/core/services/contact-service.ts
```

اضافه/تکمیل شد:

- `getInteractions(contactId)`
- `createInteraction(input)`
- `useContactInteractions(contactId)`
- `useCreateInteraction()`
- `getContactTransactions(contactId)`
- `createContactTransaction(input)`
- `useContactTransactions(contactId)`
- `useCreateContactTransaction()`

هیچ RPC جدید ساخته نشد. برای تراکنش مستقل از الگوی موجود TxModal استفاده شد؛ یعنی insert مستقیم در `transactions`.

## تغییرات UI

فایل:

```text
src/shared/panels/ContactPanel.tsx
```

اضافه شد:

### تب «تعاملات»

- DataTable با ستون‌های:
  - تاریخ
  - نوع
  - عنوان
  - یادداشت
  - پیگیری بعدی
- فرم افزودن تعامل:
  - نوع تعامل
  - عنوان
  - یادداشت
  - پیگیری بعدی

### تب «تراکنش‌ها»

- DataTable با ستون‌های:
  - تاریخ
  - نوع
  - مبلغ
  - روش
  - حساب
  - یادداشت
- فرم ثبت تراکنش مستقل:
  - دریافت/پرداخت
  - مبلغ
  - حساب
  - روش پرداخت
  - یادداشت

### پشتیبانی از باز شدن مستقیم تب‌ها

`ContactPanel` حالا `panel.props.initialTab` را می‌خواند؛ بنابراین صفحه detail می‌تواند مستقیم تب «تعاملات» یا «تراکنش‌ها» را باز کند.

## حذف Modalها

فایل:

```text
app/(app)/contacts/[id]/page.tsx
```

حذف شد:

- `InteractionModal`
- `TxModal`
- stateهای `payOpen`, `recvOpen`, `interactionOpen`

دکمه‌های دریافت/پرداخت و actionهای URL اکنون ContactPanel را با تب مناسب باز می‌کنند.

## نتیجه ممیزی

| Modal | نتیجه | دلیل |
|---|---|---|
| InteractionModal | حذف شد | همه فیلدهای قبلی + `next_followup` در ContactPanel پوشش داده شد. |
| TxModal | حذف شد | همه فیلدهای قبلی + روش پرداخت/چک در ContactPanel پوشش داده شد. |
| ContactEditModal | حذف نشد | فیلد `code` هنوز در detail modal قابل ویرایش است ولی در ContactPanel read-only است. |

## تست واقعی دیتابیس

با حساب تست، یک مخاطب تستی ساخته شد؛ سپس یک تعامل و یک تراکنش برای آن ثبت شد، از دیتابیس خوانده و تأیید شد، سپس رکوردهای تست پاکسازی شدند.

نتیجه خام تست:

```text
docs/frontend/0037_contact_crm_completion_test_result.json
```

خلاصه:

```text
contact_id: f7498a71-daf9-43b0-87ff-57c5ae51f12e
interaction: type=note, title=تست تعامل ContactPanel
transaction: type=receipt, amount=1234500
cleanup: interaction + transaction + contact deleted
```

## Build/Test

```text
next build: passed
vitest: 2 files / 8 tests passed
```
