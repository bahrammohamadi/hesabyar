# مرحله ۹-الف — گام صفر و یادداشت Service/View Panels

> هدف: ساخت Service Layer سبک و ContactPanel/ProductPanel واقعی فقط در حالت view/read-only  
> تغییرات نوشتنی/ویرایشی در داده: ندارد  
> حذف Modalهای فعلی: ندارد

---

## 1) امضای hookهای موجود

### `useContactSummary`

مسیر:

```text
lib/hooks/useContactSummary.ts
```

امضا:

```ts
export function useContactSummary(contactId?: string | null, options?: { enabled?: boolean })
```

خروجی type:

```ts
export interface ContactSummary {
  id: string;
  name: string;
  phone: string | null;
  type: string;
  balance: number;
  invoiceCount: number;
  totalSales: number;
  totalPurchases: number;
  lastSaleDate: string | null;
  lastPurchaseDate: string | null;
  lastPaymentDate: string | null;
  lastPaymentAmount: number;
  lastInteractionDate: string | null;
  lastInteractionTitle: string | null;
  lastInteractionType: string | null;
}
```

نکته: این hook هنوز از `contact_balances` قدیمی استفاده می‌کند، نه `v_contact_balance` جدید.

---

### `useProductSummary`

مسیر:

```text
lib/hooks/useProductSummary.ts
```

امضا:

```ts
export function useProductSummary(productId?: string | null, options?: { enabled?: boolean })
```

خروجی type:

```ts
export interface ProductSummary {
  id: string;
  name: string;
  code: string | null;
  imageUrl: string | null;
  basePurchasePrice: number;
  baseSalePrice: number;
  currentPurchasePrice: number;
  currentSalePrice: number;
  stock: number;
  variantCount: number;
  lastSaleDate: string | null;
  lastPurchaseDate: string | null;
  movementCount: number;
}
```

این hook برای summary مناسب است، ولی برای ProductPanel واقعی variantهای کامل، SKU/barcode و `v_product_stock` لازم است؛ پس service جدید ساخته می‌شود.

---

## 2) queryKey pattern فعلی

الگوی موجود در:

```text
lib/entities/query-keys.ts
```

نمونه:

```ts
export const entityQueryKeys = {
  contactSummary: (contactId?: string | null) => ["entity", "contact", "summary", contactId] as const,
  productSummary: (productId?: string | null) => ["entity", "product", "summary", productId] as const,
  timeline: (type: EntityType, id?: string | null) => ["entity", type, "timeline", id] as const,
};
```

برای hookهای جدید همین الگو رعایت می‌شود:

```text
["entity", "contact", "detail", id]
["entity", "contact", "documents", id]
["entity", "product", "detail", id]
["entity", "product", "stock", id]
```

staleTime پیشنهادی: `60_000` مثل summary hookهای موجود.

---

## 3) مسیر Supabase Client

کلاینت مرورگر فعلی:

```text
lib/supabase/client.ts
```

امضا:

```ts
export function createClient()
```

و از این استفاده می‌کند:

```ts
createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

پس serviceهای جدید از همین مسیر import می‌کنند:

```ts
import { createClient } from "@/lib/supabase/client";
```

---

## 4) وضعیت org_id filter

در queryهای فعلی frontend بعضی جاها `org_id` دستی فیلتر می‌شود و بعضی جاها نه.

نمونه‌هایی که دستی org فیلتر نمی‌کنند:

```ts
supabase.from("contacts").select("*").eq("is_active", true)
supabase.from("products").select(...).eq("is_active", true)
```

علت قابل قبول بودن فعلی:

- فاز A، RLS org-scoped را فعال کرده است.
- policy از `public.user_org_ids()` استفاده می‌کند.
- frontend با authenticated key و session کاربر وصل می‌شود.

تصمیم در مرحله ۹-الف:

- در serviceهای جدید برای `getById` فقط `id` فیلتر می‌شود و RLS org scope را enforce می‌کند.
- برای viewها مثل `v_contact_balance`, `v_documents`, `v_product_stock` نیز RLS/security_invoker فعال است.
- فیلتر org دستی اضافه نمی‌شود تا با الگوی فعلی هماهنگ باشد و نیاز به دریافت orgId در Panel نباشد.

---

## 5) تصمیم reuse در این مرحله

- `useContactSummary` برای این مرحله کافی نیست، چون `code`, `address`, `is_active`, `v_contact_balance` و اسناد از `v_documents` لازم است.
- `useProductSummary` مفید است ولی برای variant table کامل کافی نیست.
- بنابراین serviceهای سبک جدید ساخته می‌شوند و hookهای React Query روی آن‌ها قرار می‌گیرند.

---

## 6) اصل معماری رعایت‌شده

Panelها مستقیماً Supabase را صدا نمی‌زنند.

مسیر مجاز:

```text
ContactPanel/ProductPanel → useContactEntity/useProductEntity → contact-service/product-service → lib/supabase/client.ts
```
