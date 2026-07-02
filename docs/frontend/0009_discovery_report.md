# Discovery Report — ContactPanel / ProductPanel قبل از مرحله ۹

> نوع تسک: فقط کشف و گزارش  
> تغییر کد اجرایی: انجام نشد  
> migration/DB change: انجام نشد  
> تنها فایل خروجی: `docs/frontend/0009_discovery_report.md`

---

# ۱. Data Fetching — contacts / products

## ۱.۱ الگوی کلی Data Fetching فعلی

پروژه الگوی یکپارچه service-layer ندارد. بیشتر صفحات و کامپوننت‌ها مستقیماً این کار را انجام می‌دهند:

```ts
const supabase = createClient();
await supabase.from("...").select(...)
```

Data fetching غالباً با React Query انجام می‌شود، اما queryها داخل خود page/component تعریف شده‌اند.

Provider سراسری React Query در:

```text
components/providers.tsx
```

نمونه config فعلی:

```ts
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})
```

Supabase client سمت مرورگر در:

```text
lib/supabase/client.ts
```

نمونه:

```ts
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

نتیجه: frontend با anon/authenticated key کار می‌کند، نه service_role.

---

## ۱.۲ contacts — آیا hook/service وجود دارد؟

### useContacts / contacts-service

یافت نشد.

هیچ فایل مستقل مثل این‌ها وجود ندارد:

```text
useContacts
useContact
contacts-service
getContacts
```

اما چند query مستقیم وجود دارد.

---

## ۱.۳ contacts — صفحه لیست

فایل:

```text
app/(app)/contacts/page.tsx
```

در این فایل contacts مستقیماً با React Query خوانده می‌شود.

نمونه کد:

```ts
const { data: contacts, isLoading } = useQuery({
  queryKey: ["contacts", orgId, search, typeFilter],
  enabled: !!orgId,
  queryFn: async () => {
    const supabase = createClient();
    let q = supabase
      .from("contacts")
      .select("*")
      .eq("is_active", true)
      .order("name");
    if (search.trim()) {
      const t = search.trim();
      q = q.or(`name.ilike.%${t}%,phone.ilike.%${t}%,code.ilike.%${t}%`);
    }
    if (typeFilter) q = q.in("type", typeFilter === "both" ? ["both"] : [typeFilter, "both"]);
    const { data, error } = await q;
    if (error) throw error;
    return data as Contact[];
  },
});
```

ویژگی‌ها:

- React Query دارد.
- queryKey: `["contacts", orgId, search, typeFilter]`
- مستقیم به Supabase وصل می‌شود.
- service layer ندارد.
- search با `or(name.ilike, phone.ilike, code.ilike)` انجام می‌شود.
- orgId مستقیماً filter نشده، اما RLS فعال است.

---

## ۱.۴ contacts — detail summary hook

فایل:

```text
lib/hooks/useContactSummary.ts
```

این تنها hook نزدیک به contact entity است، اما برای summary/quick-view است، نه CRUD کامل.

امضا:

```ts
export function useContactSummary(contactId?: string | null, options?: { enabled?: boolean })
```

نمونه کد:

```ts
return useQuery({
  queryKey: entityQueryKeys.contactSummary(contactId),
  enabled: !!contactId && (options?.enabled ?? true),
  staleTime: 60_000,
  queryFn: async (): Promise<ContactSummary | null> => {
    const supabase = createClient();
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("id, name, phone, type")
      .eq("id", contactId)
      .single();
    ...
  },
});
```

این hook علاوه بر خود contact، این‌ها را هم می‌خواند:

```text
contact_balances
sales
purchases
transactions
contact_interactions
```

نکته: هنوز از view جدید `v_contact_balance` استفاده نمی‌کند و از view قدیمی `contact_balances` استفاده می‌کند.

---

## ۱.۵ contacts — صفحه detail

فایل:

```text
app/(app)/contacts/[id]/page.tsx
```

این صفحه queryهای جداگانه دارد:

```ts
supabase.from("contacts").select("*").eq("id", id).single();
supabase.from("contact_balances").select("balance").eq("contact_id", id).single();
supabase.from("sales").select(...).eq("customer_id", id).limit(50);
supabase.from("purchases").select(...).eq("supplier_id", id).limit(50);
supabase.from("transactions").select(...).eq("contact_id", id).limit(50);
```

یعنی detail page هم service مشترک ندارد.

---

## ۱.۶ contacts — selector

فایل:

```text
components/shared/contact-selector.tsx
```

تعریف type:

```ts
export interface SelectableContact {
  id: string;
  name: string;
  phone: string | null;
  type: ContactType;
}
```

خواندن داده:

```ts
const { data: contacts, isLoading } = useQuery({
  queryKey: ["all-contacts", orgId, filterType],
  enabled: !!orgId && open,
  queryFn: async (): Promise<SelectableContact[]> => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("contacts")
      .select("id, name, phone, type")
      .eq("is_active", true)
      .in("type", [filterType, "both"])
      .order("name")
      .limit(5000);
    if (error) throw error;
    return (data as SelectableContact[]) ?? [];
  },
});
```

نکته مهم: selector فعلی فقط select نیست؛ قابلیت create سریع هم دارد. این با معماری هدف Picker ≠ Editor ناسازگار است.

---

## ۱.۷ products — آیا hook/service وجود دارد؟

### useProducts

وجود دارد:

```text
lib/hooks/useProducts.ts
```

امضا:

```ts
export function useProducts(orgId: string | null, search = "")
```

این hook product و variants را با هم می‌خواند.

نمونه query:

```ts
const { data, error } = await supabase
  .from("products")
  .select(
    `id, name, code, season, material, description, image_url, category_id, brand_id,
     base_purchase_price, base_sale_price, low_stock_threshold, is_active,
     category:categories(name), brand:brands(name),
     product_variants(id, color, size, sku, barcode, purchase_price, sale_price, stock_qty, is_active)`
  )
  .eq("is_active", true)
  .order("created_at", { ascending: false });
```

ویژگی‌ها:

- React Query دارد.
- queryKey: `["products", orgId, search]`
- service layer ندارد.
- مستقیم Supabase را صدا می‌زند.
- search بعد از fetch در سمت client انجام می‌شود.
- همه محصولات فعال را می‌گیرد و بعد filter می‌کند.

### ProductWithVariants

در همان فایل تعریف شده:

```ts
export interface ProductWithVariants {
  id: string;
  name: string;
  code: string | null;
  season: string | null;
  material: string | null;
  description: string | null;
  image_url: string | null;
  category_id: string | null;
  brand_id: string | null;
  base_purchase_price: number;
  base_sale_price: number;
  low_stock_threshold: number;
  is_active: boolean;
  category?: { name: string } | null;
  brand?: { name: string } | null;
  product_variants: {
    id: string;
    color: string | null;
    size: string | null;
    sku: string | null;
    barcode: string | null;
    purchase_price: number | null;
    sale_price: number | null;
    stock_qty: number;
    is_active: boolean;
  }[];
}
```

---

## ۱.۸ products — summary hook

فایل:

```text
lib/hooks/useProductSummary.ts
```

امضا:

```ts
export function useProductSummary(productId?: string | null, options?: { enabled?: boolean })
```

این hook product + variants + last sale/purchase + movement count را می‌خواند.

نمونه query اصلی:

```ts
const { data: product, error } = await supabase
  .from("products")
  .select(
    "id, name, code, image_url, base_purchase_price, base_sale_price, product_variants(id, purchase_price, sale_price, stock_qty)"
  )
  .eq("id", productId)
  .single();
```

سپس بر اساس variantIds این‌ها را می‌خواند:

```text
sale_items
purchase_items
stock_movements
```

این hook برای ProductPanel قابل reuse است.

---

## ۱.۹ products — selector

فایل:

```text
components/shared/product-selector.tsx
```

تعریف type:

```ts
export interface SelectableVariant {
  variant_id: string;
  product_id: string | null;
  product_name: string;
  product_code: string | null;
  color: string | null;
  size: string | null;
  sku: string | null;
  barcode: string | null;
  sale_price: number;
  purchase_price: number;
  stock_qty: number;
  category_id: string | null;
  brand_id: string | null;
}
```

query:

```ts
const { data, error } = await supabase
  .from("product_variants")
  .select(
    `id, color, size, sku, barcode, sale_price, purchase_price, stock_qty,
     product:products!inner(id, name, code, category_id, brand_id, base_sale_price, base_purchase_price)`
  )
  .eq("is_active", true)
  .limit(5000);
```

سپس map می‌شود به `SelectableVariant`.

نکته: ProductSelector فعلی فقط picker است و create/edit داخل خودش ندارد، اما فیلتر و sort زیادی دارد. برای Picker جدید core می‌توان بخشی از منطق انتخاب variant را reuse کرد.

---

# ۲. Data Mutation — create/update/delete

## ۲.۱ contacts — create/update/delete

### create/update

در فایل:

```text
app/(app)/contacts/page.tsx
```

کامپوننت:

```text
ContactModal
```

تابع:

```ts
async function handleSave()
```

نمونه update:

```ts
const { error: e } = await supabase.from("contacts").update(payload).eq("id", editing.id);
```

نمونه insert:

```ts
const { error: e } = await supabase
  .from("contacts")
  .insert({ ...payload, org_id: orgId, branch_id: branchId });
```

### delete

حذف واقعی نیست؛ soft-delete با `is_active=false` است:

```ts
await supabase.from("contacts").update({ is_active: false }).eq("id", id);
qc.invalidateQueries({ queryKey: ["contacts"] });
qc.invalidateQueries({ queryKey: ["contact-balances"] });
```

### React Query mutation?

`useMutation` استفاده نشده است. عملیات mutation داخل functionهای local انجام می‌شود.

### invalidate

بعد از حذف:

```ts
qc.invalidateQueries({ queryKey: ["contacts"] });
qc.invalidateQueries({ queryKey: ["contact-balances"] });
```

بعد از modal save، در `onClose` فقط `contacts` invalidate می‌شود.

---

## ۲.۲ contact detail mutations

در:

```text
app/(app)/contacts/[id]/page.tsx
```

کامپوننت‌ها:

```text
ContactEditModal
InteractionModal
TxModal
```

نمونه update contact:

```ts
await supabase.from("contacts").update({ ... }).eq("id", contact.id);
```

نمونه transaction:

```ts
await supabase.from("transactions").insert({ org_id, branch_id, type, amount, account_id, contact_id, method: "cash" });
```

Service مشترک وجود ندارد.

---

## ۲.۳ products — create/update/delete

### create/update

در:

```text
app/(app)/products/page.tsx
```

کامپوننت:

```text
ProductModal
```

تابع:

```ts
async function handleSave()
```

نمونه update product:

```ts
const { error: e } = await supabase.from("products").update(baseFields).eq("id", editing.id);
```

نمونه insert product:

```ts
const { data, error: e } = await supabase
  .from("products")
  .insert({ org_id: orgId, branch_id: branchId, ...baseFields })
  .select("id")
  .single();
```

### variants

برای variant موجود:

```ts
await supabase
  .from("product_variants")
  .update(payload)
  .eq("id", v.id);
```

برای variant جدید:

```ts
const { data: newV, error: e } = await supabase
  .from("product_variants")
  .insert({ ...payload, stock_qty: 0 })
  .select("id")
  .single();
```

اگر stock اولیه وجود داشته باشد، مستقیماً `stock_movements` insert می‌کند:

```ts
await supabase.from("stock_movements").insert({
  org_id: orgId,
  branch_id: branchId,
  variant_id: newV.id,
  type: "in",
  reason: "opening",
  qty,
  note: "موجودی اول دوره",
});
```

نکته مهم: بعد از فاز A، بهتر است در آینده به جای insert مستقیم `stock_movements` از `fn_add_stock_movement` استفاده شود، اما فعلاً کد موجود مستقیم insert می‌کند.

### delete product

در `products/page.tsx` دکمه حذف و `Trash2` وجود دارد، اما در بخش‌های بررسی‌شده handler کامل delete روشن دیده نشد. در `ProductModal` هم delete وجود ندارد. بنابراین حذف/غیرفعال‌سازی product به شکل service/hook مستقل یافت نشد.

---

## ۲.۴ product detail mutations

در:

```text
app/(app)/products/[id]/page.tsx
```

کامپوننت‌ها:

```text
ProductEditModal
PriceChangeModal
AdjustModal
```

نمونه update product:

```ts
await supabase.from("products").update({ ... }).eq("id", product.id);
```

نمونه stock adjustment:

```ts
await supabase.from("stock_movements").insert({ org_id, branch_id, variant_id, type: "adjust", reason: "count", qty: diff, note });
```

باز هم service مشترک یا mutation hook وجود ندارد.

---

## ۲.۵ validation

### zod / yup / react-hook-form

در dependencies این‌ها وجود دارند:

```text
zod
react-hook-form
```

اما در کد بررسی‌شده usage واقعی یافت نشد:

```text
z.object → یافت نشد
useForm → یافت نشد
react-hook-form usage → یافت نشد
yup → یافت نشد
```

Validation فعلی mostly دستی است، مثل:

```ts
if (!displayName) {
  setError("نام یا نام خانوادگی الزامی است.");
  return;
}
```

یا:

```ts
if (!name.trim()) {
  setError("نام کالا الزامی است.");
  return;
}
```

---

# ۳. صفحات و Modalهای فعلی

## ۳.۱ صفحه contacts

مسیر:

```text
app/(app)/contacts/page.tsx
```

ویژگی‌ها:

- لیست contacts را نمایش می‌دهد.
- search دارد.
- type filter دارد.
- balance filter دارد.
- sort دارد.
- نمایش به شکل card list است، نه table کلاسیک.
- از `EntityLink` قدیمی پروژه برای link به contact استفاده می‌کند.
- `ContactModal` برای create/edit دارد.
- delete = soft delete (`is_active=false`).

Modal:

```text
ContactModal
```

کار:

- create contact
- edit contact
- فیلدهای meta مثل first_name, last_name, email, birth_date, national_code, job_title, gender

---

## ۳.۲ صفحه contact detail

مسیر:

```text
app/(app)/contacts/[id]/page.tsx
```

ویژگی‌ها:

- اطلاعات contact
- balance
- فروش‌های مرتبط
- خریدهای مرتبط
- transactionها
- tabs داخلی
- action menu

Modalهای مرتبط:

```text
ContactEditModal
InteractionModal
TxModal
```

---

## ۳.۳ صفحه products

مسیر:

```text
app/(app)/products/page.tsx
```

ویژگی‌ها:

- از `useProducts` استفاده می‌کند.
- لیست محصولات را به شکل card list نمایش می‌دهد.
- search و sort دارد.
- موجودی totalStock از sum variant.stock_qty محاسبه می‌شود.
- variantها را زیر محصول نمایش می‌دهد.
- `ProductModal` برای create/edit دارد.
- category/brand را با hooks موجود می‌خواند.

Modal:

```text
ProductModal
```

کار:

- create product
- edit product
- create/update variants
- ثبت موجودی اولیه از طریق insert مستقیم stock_movements

---

## ۳.۴ صفحه product detail

مسیر:

```text
app/(app)/products/[id]/page.tsx
```

ویژگی‌ها:

- product detail
- variants
- stock movements
- sale history
- purchase history
- tabs داخلی
- price/profit/stock summary

Modalها:

```text
ProductEditModal
PriceChangeModal
AdjustModal
```

---

## ۳.۵ selectorهای مرتبط

### ContactSelector

مسیر:

```text
components/shared/contact-selector.tsx
```

کار:

- انتخاب contact
- create سریع contact داخل همان modal

نکته: در معماری هدف، picker نباید editor/create باشد. پس این باید در آینده به picker خالص + ContactPanel(create) شکسته شود.

### ProductSelector

مسیر:

```text
components/shared/product-selector.tsx
```

کار:

- انتخاب product variant
- search/filter/sort client-side
- create/edit ندارد

برای pickerهای مرحله بعد قابل reuse/الهام است.

---

## ۳.۶ لیست Modalهای contact/product

| فایل | Modal | کار |
|---|---|---|
| `app/(app)/contacts/page.tsx` | `ContactModal` | create/edit contact |
| `app/(app)/contacts/[id]/page.tsx` | `ContactEditModal` | edit contact در صفحه detail |
| `app/(app)/contacts/[id]/page.tsx` | `InteractionModal` | ثبت تعامل CRM |
| `app/(app)/contacts/[id]/page.tsx` | `TxModal` | دریافت/پرداخت مرتبط با contact |
| `components/shared/contact-selector.tsx` | internal create mode | ایجاد سریع contact داخل selector |
| `app/(app)/products/page.tsx` | `ProductModal` | create/edit product + variants |
| `app/(app)/products/[id]/page.tsx` | `ProductEditModal` | edit product در detail |
| `app/(app)/products/[id]/page.tsx` | `PriceChangeModal` | تغییر قیمت |
| `app/(app)/products/[id]/page.tsx` | `AdjustModal` | تعدیل موجودی |

---

# ۴. Types واقعی — Contact / Product / ProductVariant

## ۴.۱ فایل اصلی type

مسیر:

```text
types/db.ts
```

Supabase generated types کامل یافت نشد؛ فایلی مثل `database.types.ts` یافت نشد. Typeها دستی نوشته شده‌اند.

---

## ۴.۲ Contact type

کپی مستقیم از `types/db.ts`:

```ts
export type ContactType = "customer" | "supplier" | "both";

export interface Contact {
  id: string;
  org_id: string;
  branch_id: string | null;
  name: string;
  type: ContactType;
  phone: string | null;
  address: string | null;
  description: string | null;
  credit_limit: number;
  opening_balance: number;
  tags: string[];
  meta: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}
```

### بررسی فیلدهای خواسته‌شده

| فیلد | وضعیت |
|---|---|
| `name` | واقعی ✅ |
| `phone` | واقعی ✅ |
| `code` | در دیتابیس و کد استفاده می‌شود، اما در `Contact` type اصلی نیست ⚠️ |
| `mobile` | یافت نشد ❌ |
| `address` | واقعی ✅ |
| `contact_type` | با نام `type` واقعی است ✅ |
| `balance` | در خود contact نیست؛ از `contact_balances` یا `v_contact_balance` خوانده می‌شود |
| `org_id` | واقعی ✅ |

نکته: type دستی `Contact` با schema واقعی کامل sync نیست، چون `code` در کد استفاده شده اما در interface نیست.

---

## ۴.۳ Product type

کپی مستقیم از `types/db.ts`:

```ts
export interface Product {
  id: string;
  org_id: string;
  branch_id: string | null;
  name: string;
  category_id: string | null;
  brand_id: string | null;
  description: string | null;
  image_url: string | null;
  base_purchase_price: number;
  base_sale_price: number;
  low_stock_threshold: number;
  is_active: boolean;
  created_at: string;
}
```

### ProductWithVariants واقعی‌تر

در `lib/hooks/useProducts.ts` تعریف شده و کامل‌تر است:

```ts
export interface ProductWithVariants {
  id: string;
  name: string;
  code: string | null;
  season: string | null;
  material: string | null;
  description: string | null;
  image_url: string | null;
  category_id: string | null;
  brand_id: string | null;
  base_purchase_price: number;
  base_sale_price: number;
  low_stock_threshold: number;
  is_active: boolean;
  category?: { name: string } | null;
  brand?: { name: string } | null;
  product_variants: {
    id: string;
    color: string | null;
    size: string | null;
    sku: string | null;
    barcode: string | null;
    purchase_price: number | null;
    sale_price: number | null;
    stock_qty: number;
    is_active: boolean;
  }[];
}
```

### بررسی فیلدهای خواسته‌شده product

| فیلد | وضعیت |
|---|---|
| `name` | واقعی ✅ |
| `code` | واقعی در DB/query، اما در `Product` interface اصلی نیست ⚠️ |
| `base_purchase_price` | واقعی ✅ |
| `base_sale_price` | واقعی ✅ |
| `sku` | روی product نیست؛ روی variant است ✅ |
| `barcode` | روی product نیست؛ روی variant است ✅ |

---

## ۴.۴ ProductVariant type

کپی مستقیم از `types/db.ts`:

```ts
export interface ProductVariant {
  id: string;
  org_id: string;
  product_id: string;
  color: string | null;
  size: string | null;
  sku: string | null;
  barcode: string | null;
  purchase_price: number | null;
  sale_price: number | null;
  stock_qty: number;
  is_active: boolean;
}
```

### بررسی فیلدها

| فیلد | وضعیت |
|---|---|
| `sku` | واقعی ✅ |
| `barcode` | واقعی ✅ |
| `stock_qty` | واقعی ✅ |
| `purchase_price` | واقعی ✅ |
| `sale_price` | واقعی ✅ |

---

# ۵. یکپارچگی با Core Runtime

## ۵.۱ PanelManager فعلی

در مرحله ۷ ساخته شده است:

```text
src/core/panel-manager/
```

API اصلی:

```ts
openEntity(type, id?, opts?)
openDocument(docType, id?, opts?)
openPanel(type, opts?)
closeTop()
closeAll()
replaceTop()
```

## ۵.۲ PanelInstance

```ts
export interface PanelInstance {
  id: string;
  type: PanelType;
  entityId?: string;
  docType?: DocumentType;
  mode: PanelMode;
  stackIndex: number;
  context?: PanelContext;
  title?: string;
  props?: Record<string, unknown>;
}
```

Panelها `entityId` را از prop `panel.entityId` دریافت می‌کنند. Placeholder فعلی در:

```text
src/shared/panels/PlaceholderPanels.tsx
```

از همین استفاده می‌کند:

```tsx
{panel.entityId ?? "create-mode"}
```

پس ContactPanel/ProductPanel واقعی باید prop زیر را بگیرند:

```ts
{ panel: PanelInstance }
```

و بر اساس:

```ts
panel.entityId
panel.mode
```

داده را بخوانند یا create/edit mode نشان دهند.

---

## ۵.۳ viewهای فاز A در frontend

### استفاده فعلی در کد

جستجو در کد نشان داد استفاده مستقیم از viewهای جدید فاز A هنوز وجود ندارد:

```text
v_contact_balance → استفاده فعلی یافت نشد
v_document_balance → استفاده فعلی یافت نشد
v_documents → استفاده فعلی یافت نشد
v_document_lines → استفاده فعلی یافت نشد
v_product_stock → استفاده فعلی یافت نشد
```

کد فعلی هنوز از view قدیمی `contact_balances` استفاده می‌کند.

### قابل خواندن با Supabase client؟

بله، از نظر backend فاز A، این viewها ساخته شده‌اند و با Supabase client قابل query هستند. در مراحل قبل REST/Supabase تست شده‌اند. برای frontend می‌توان از این مسیر استفاده کرد:

```ts
const { data } = await supabase.from("v_contact_balance").select("*").eq("contact_id", id);
```

یا برای سند:

```ts
const { data } = await supabase.from("v_document_balance").select("*").eq("doc_id", id);
```

---

# ۶. توصیه — Recommendation

## ۶.۱ موارد قابل reuse

### برای ContactPanel

قابل reuse:

```text
lib/hooks/useContactSummary.ts
app/(app)/contacts/[id]/page.tsx query patterns
components/shared/phone-link.tsx
components/shared/entity-action-menu.tsx
lib/utils/format.ts
```

اما `useContactSummary` بهتر است در آینده به view جدید `v_contact_balance` مهاجرت کند، چون اکنون از `contact_balances` قدیمی استفاده می‌کند.

### برای ProductPanel

قابل reuse:

```text
lib/hooks/useProductSummary.ts
lib/hooks/useProducts.ts → ProductWithVariants type
components/shared/product-mini-card.tsx احتمالی
components/shared/entity-action-menu.tsx
```

`useProductSummary` برای overview مناسب است و می‌تواند اولین hook ProductPanel باشد.

### برای Pickerها

قابل reuse/الهام:

```text
components/shared/product-selector.tsx
components/shared/contact-selector.tsx
```

اما ContactSelector فعلی با معماری هدف مشکل دارد چون create سریع داخل picker دارد.

---

## ۶.۲ مواردی که باید تازه ساخته شوند

### contact-service / product-service

چون service layer واقعی برای contact/product وجود ندارد، پیشنهاد می‌شود در مرحله ۹ ساخته شود:

```text
src/core/services/contact-service.ts
src/core/services/product-service.ts
```

یا اگر ساختار feature-based شروع شود:

```text
src/features/contacts/services/contact-service.ts
src/features/products/services/product-service.ts
```

این serviceها باید queryهای پراکنده فعلی را wrap کنند.

### hooks جدید برای Panelها

پیشنهاد:

```text
useContactPanelData(contactId)
useProductPanelData(productId)
```

این hookها می‌توانند از hookهای موجود reuse کنند اما خروجی را مناسب Panel normalize کنند.

### فرم‌های canonical

باید تازه ساخته شوند:

```text
ContactForm
ProductForm
VariantForm
```

چون فرم‌های فعلی داخل Modalها local هستند و reuse مستقیم سخت است.

---

## ۶.۳ مواردی که باید wrap شوند

### formatters

همان‌طور که در مرحله ۸ انجام شد، باید از wrapperهای زیر استفاده شود:

```text
src/shared/format/Money
src/shared/format/PersianDate
```

نه فراخوانی پراکنده `formatToman/toJalali` در هر panel.

### Supabase client

Panelها مستقیم Supabase را صدا نزنند. مسیر بهتر:

```text
Panel → hook/service → lib/supabase/client.ts
```

### EntityLink قدیمی

اکنون دو EntityLink وجود دارد:

```text
components/shared/entity-link.tsx  // قدیمی، route-based
src/core/panel-manager/EntityLink.tsx // جدید، panel-based
```

در مرحله‌های بعد باید تدریجی از route-based به panel-based مهاجرت شود.

---

## ۶.۴ ریسک‌ها

### ریسک ۱ — نبود service layer

بیشتر صفحات مستقیم Supabase را صدا می‌زنند. اگر همین ادامه پیدا کند، Panelها هم logic تکراری خواهند داشت.

راه‌حل: قبل یا همزمان با ساخت ContactPanel/ProductPanel، service layer سبک ساخته شود.

---

### ریسک ۲ — types دستی با schema واقعی sync نیستند

نمونه:

- `Contact` interface فاقد `code` است، ولی کد از `code` استفاده می‌کند.
- `Product` interface فاقد `code`, `season`, `material` است، ولی queryها و UI از آن‌ها استفاده می‌کنند.
- `Sale.status` type هنوز statusهای جدید مثل `paid/settled/reversed` را ندارد.
- `TxMethod` هنوز `credit/other/wallet` را ندارد.

راه‌حل: یا types دستی را آپدیت کنیم، یا Supabase generated types بسازیم.

---

### ریسک ۳ — validation پراکنده و دستی

zod/react-hook-form نصب هستند اما استفاده واقعی یافت نشد. فرم‌های فعلی validation دستی دارند.

راه‌حل: فرم‌های canonical پنل‌ها با schema مشخص ساخته شوند، حتی اگر اول ساده باشند.

---

### ریسک ۴ — ContactSelector فعلی picker+creator است

این برخلاف معماری هدف است:

```text
Picker فقط select
EntityPanel مسئول create/edit
```

راه‌حل: در مراحل بعد ContactPicker جدید فقط انتخاب کند و create را با `openEntity('contact', undefined, { mode: 'create' })` انجام دهد.

---

### ریسک ۵ — Product stock operations مستقیم stock_movements insert می‌کنند

کد فعلی در create product/adjust stock مستقیم `stock_movements` insert می‌کند. بعد از فاز A، بهتر است این به RPC زیر مهاجرت کند:

```text
fn_add_stock_movement
```

تا audit و balance_after و mapping استاندارد رعایت شود.

---

## ۶.۵ پیشنهاد اجرای مرحله ۹

برای مرحله ۹ بهتر است ترتیب زیر رعایت شود:

1. ساخت `contact-service.ts` و `product-service.ts` سبک با reuse queryهای فعلی.
2. ساخت `ContactPanel` واقعی با `PanelShell` و `useContactSummary` + `v_contact_balance`.
3. ساخت `ProductPanel` واقعی با `useProductSummary` و `v_product_stock`.
4. فعلاً create/edit را read-only یا محدود نگه داریم.
5. بعد از stable شدن view mode، فرم‌های edit/create canonical ساخته شوند.

پیشنهاد مهم:

> اول Panelها را view-mode واقعی کنیم، بعد edit/create را منتقل کنیم. این کم‌ریسک‌ترین مسیر برای مهاجرت از UI فعلی به Entity-based UI است.
