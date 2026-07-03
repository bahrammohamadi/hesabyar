# مرحله ۱۰-الف — گام صفر و یادداشت Invoice View

> هدف: ساخت invoice-service و InvoicePanel واقعی فقط view-mode  
> mutation: انجام نمی‌شود  
> RPCهای پرریسک `fn_transition_document` و `fn_register_payment`: در این مرحله صدا زده نمی‌شوند

---

## 1) نحوه خواندن فعلی sale detail

مسیر:

```text
app/(app)/sales/[id]/page.tsx
```

الگو: React Query داخل خود صفحه و اتصال مستقیم به Supabase.

queryKey:

```ts
["sale-invoice-view", id]
```

نمونه خواندن سند:

```ts
const { data: sale, error: saleError } = await supabase
  .from("sales")
  .select("*")
  .eq("id", id)
  .single();
```

خواندن contact:

```ts
sale.customer_id
  ? supabase.from("contacts").select("id,name,phone,address,code").eq("id", sale.customer_id).maybeSingle()
  : Promise.resolve({ data: null, error: null } as any)
```

خواندن اقلام:

```ts
supabase
  .from("sale_items")
  .select("id, variant_id, qty, unit_price, discount, line_total, cost_price")
  .eq("sale_id", id)
  .order("created_at", { ascending: true })
```

برای نام کالا، صفحه فعلی بعداً این کار را انجام می‌دهد:

```ts
product_variants.select("id,product_id,color,size,sku,barcode").in("id", variantIds)
products.select("id,name,code").in("id", productIds)
```

یعنی اقلام فروش مستقیماً نام کالا ندارند و باید از `product_variants → products` join شوند.

---

## 2) نحوه خواندن فعلی purchase detail

مسیر:

```text
app/(app)/purchases/[id]/page.tsx
```

queryKey:

```ts
["purchase-detail", id]
```

نمونه خواندن سند خرید:

```ts
const { data: purchase, error: purchaseError } = await supabase
  .from("purchases")
  .select(
    `*, supplier:contacts(id, name, phone, code),
     purchase_items(id, qty, unit_price, line_total,
       variant:product_variants(id, color, size, sku, barcode, product:products(id, name, code)))`
  )
  .eq("id", id)
  .single();
```

در purchase detail، join کالا داخل خود query انجام می‌شود.

---

## 3) contact_id / customer_id / supplier_id

در read-model جدید:

```text
v_documents.contact_id
```

در جدول‌های فیزیکی:

| doc_type | ستون واقعی contact |
|---|---|
| sale | `sales.customer_id` |
| purchase | `purchases.supplier_id` |

هر دو می‌توانند nullable باشند.

برای فروش بدون مشتری:

```text
مشتری نقدی / پیش‌فرض
```

نمایش داده می‌شود.

---

## 4) اقلام سند و نام کالا

`v_document_lines` این ستون‌ها را دارد:

```text
line_id, doc_id, doc_type, product_id, product_variant_id, qty, unit_price, discount, line_total
```

اما نام کالا / code / sku / barcode ندارد.

بنابراین `invoice-service.ts` باید بعد از خواندن `v_document_lines`، به صورت سبک این دو جدول را بخواند:

```text
product_variants(id, product_id, color, size, sku, barcode)
products(id, name, code)
```

---

## 5) org filter و RLS

Viewهای فاز A با `security_invoker=true` ساخته شده‌اند. RLS org-scoped فعال است.

بنابراین queryهای frontend برای این viewها نیازی به org_id دستی ندارند؛ authenticated session و RLS کاربر را محدود می‌کند.

---

## 6) doc_type در routing قدیمی

routeهای قدیمی جدا هستند:

```text
/sales/[id]       → sale
/purchases/[id]   → purchase
```

در Core Runtime جدید، docType از EntityLink/PanelManager می‌آید:

```tsx
<EntityLink type="invoice" docType="sale" id={docId}>
```

و Panel از این دو مقدار استفاده می‌کند:

```ts
panel.docType
panel.entityId
```

پس InvoicePanel نیازی به URL ندارد.

---

## 7) تصمیم اجرایی ۱۰-الف

- `invoice-service.ts` ساخته می‌شود.
- فقط توابع read ساخته می‌شود.
- `fn_transition_document` و `fn_register_payment` صدا زده نمی‌شوند.
- `InvoicePanel` فقط view-mode خواهد بود.
- `payment` و `transition` برای مرحله ۱۰-ب باقی می‌ماند.
