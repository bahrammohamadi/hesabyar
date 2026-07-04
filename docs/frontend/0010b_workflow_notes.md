# مرحله ۱۰-ب — گام صفر Workflow/Payment در InvoicePanel

> هدف: افزودن اکشن‌های حساس سند به InvoicePanel با تأیید صریح  
> mutationهای مجاز این مرحله: فقط از طریق `invoice-service.ts`  
> RPCهای استفاده‌شده: `fn_transition_document`, `fn_register_payment`

---

## 1) رفتار صفحات قدیمی فروش/خرید

### فروش — `/sales/[id]`

مسیر:

```text
app/(app)/sales/[id]/page.tsx
```

دکمه‌ها/Modalهای موجود:

```text
CancelSaleModal
SalePaymentModal
EditInvoiceModal
```

ثبت پرداخت فروش فعلی:

```ts
const { error } = await supabase.rpc("record_sale_payment", {
  p_sale: saleId,
  p_amount: amountRial,
  p_account: accountId || null,
  p_method: method,
  p_note: note.trim() || null,
});
```

لغو فروش فعلی:

```ts
const { error } = await supabase.rpc("cancel_sale", {
  p_sale: saleId,
  p_reason: reason.trim() || "ابطال از صفحه فاکتور"
});
```

Confirm قدیمی:

- برای cancel، یک Modal هشدار قرمز دارد.
- برای payment، Modal ثبت پرداخت دارد.
- برای confirm/settle workflow جدید دکمه‌ای در صفحه قدیمی یافت نشد.

---

### خرید — `/purchases/[id]`

مسیر:

```text
app/(app)/purchases/[id]/page.tsx
```

دکمه‌ها/Modalهای موجود:

```text
CancelPurchaseModal
PurchasePaymentModal
EditPurchaseModal
```

ثبت پرداخت خرید فعلی:

```ts
const { error: e } = await supabase.rpc("record_purchase_payment", {
  p_purchase: purchaseId,
  p_amount: amountRial,
  p_account: accountId || null,
  p_method: method,
  p_note: note.trim() || null,
});
```

لغو خرید فعلی:

```ts
const { error } = await supabase.rpc("cancel_purchase", {
  p_purchase: purchaseId,
  p_reason: reason.trim() || "ابطال از صفحه خرید"
});
```

---

## 2) تفاوت مسیر جدید

در InvoicePanel جدید از RPCهای استاندارد فاز A استفاده می‌شود:

```text
fn_transition_document
fn_register_payment
```

نه RPCهای legacy:

```text
record_sale_payment
record_purchase_payment
cancel_sale
cancel_purchase
```

دلیل: مسیر جدید باید روی Workflow Engine واحد و Document abstraction ساخته شود.

---

## 3) Permission فعلی

در صفحه‌های قدیمی sale/purchase detail، بررسی permission برای reverse/confirm/payment به‌صورت UI-level یافت نشد.

پروژه hook زیر را دارد:

```text
lib/hooks/usePermission.ts
```

اما در صفحات `sales/[id]` و `purchases/[id]` برای این دکمه‌ها استفاده نشده است.

نتیجه:

> در این مرحله محدودیت نمایشی permission در UI اعمال نمی‌شود. Enforcement فعلاً در DB/RPC/RLS است. این یک TODO آینده برای granular permission UI است.

---

## 4) فرمت واقعی خطای RPC

تست واقعی روی یک سند confirmed با transition نامعتبر انجام شد:

```text
fn_transition_document('sale', existingConfirmedSaleId, 'confirmed')
```

نتیجه Supabase REST:

```json
{
  "code": "P0001",
  "details": null,
  "hint": null,
  "message": "انتقال وضعیت غیرمجاز است: confirmed → confirmed"
}
```

در `supabase-js` پیام قابل نمایش همان `error.message` است و فارسی است. بنابراین در UI پیام RPC مستقیم در toast خطا نمایش داده می‌شود.

---

## 5) دکمه‌های workflow بر اساس status

| status | actions |
|---|---|
| `draft` | تأیید سند → confirmed |
| `confirmed` | ثبت پرداخت، تسویه → settled، برگشت سند → reversed |
| `paid` | تسویه → settled، برگشت سند → reversed |
| `settled` | برگشت سند → reversed |
| `reversed/cancelled/returned` | هیچ transition |

---

## 6) تأییدیه‌ها

برای transitionها از `window.confirm` استفاده می‌شود چون ConfirmDialog کامل هنوز در DS ساخته نشده است.

پیام‌ها:

- Confirm:

```text
با تأیید سند، موجودی انبار کم/زیاد می‌شود. ادامه می‌دهید؟
```

- Settled:

```text
سند به وضعیت تسویه‌شده تغییر کند؟
```

- Reverse:

```text
⚠️ این عملیات موجودی را برمی‌گرداند و سند دیگر قابل ویرایش نیست. مطمئن هستید؟
```

برای overpay:

```text
مبلغ واردشده بیشتر از مانده سند است. ادامه می‌دهید؟
```

---

## 7) Invalidation الزامی

بعد از transition یا payment باید invalidate شود:

```text
["entity", "invoice", docType, "detail", docId]
["entity", "contact", "detail", contactId]
["entity", "contact", "documents", contactId]
["entity", "product", "stock", productId]
["entity", "product", "detail", productId]
```

چون یک اکشن سند روی سه حوزه اثر دارد:

1. خود سند
2. موجودی کالاهای سند
3. مانده/اسناد مخاطب
