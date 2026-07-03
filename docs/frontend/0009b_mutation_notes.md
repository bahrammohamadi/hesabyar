# مرحله ۹-ب — گام صفر Mutation برای ContactPanel/ProductPanel

> هدف: اضافه کردن create/update/soft-delete واقعی به ContactPanel و ProductPanel از طریق Service Layer  
> حذف/تغییر Modalهای قدیمی: انجام نمی‌شود  
> migration/DB change: لازم نیست

---

## 1) قوانین کسب‌وکاری ContactModal قدیمی

مسیر:

```text
app/(app)/contacts/page.tsx
```

کامپوننت:

```text
ContactModal
```

### فیلدهایی که می‌نویسد

```ts
const payload = {
  name: displayName,
  type,
  phone: phone.trim() || null,
  address: address.trim() || null,
  description: description.trim() || null,
  meta: {
    ...(editing?.meta as Record<string, unknown> | undefined),
    first_name: firstName.trim() || null,
    last_name: lastName.trim() || null,
    email: email.trim() || null,
    birth_date: birthDate || null,
    national_code: nationalCode.trim() || null,
    job_title: jobTitle.trim() || null,
    gender: gender || null,
  },
};
```

### Create

```ts
await supabase
  .from("contacts")
  .insert({ ...payload, org_id: orgId, branch_id: branchId });
```

### Update

```ts
await supabase.from("contacts").update(payload).eq("id", editing.id);
```

### Soft delete

در صفحه لیست contact:

```ts
await supabase.from("contacts").update({ is_active: false }).eq("id", id);
```

### Validation قدیمی

```ts
const displayName = name.trim() || [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
if (!displayName) {
  setError("نام یا نام خانوادگی الزامی است.");
  return;
}
```

### org_id / branch_id

`org_id` و `branch_id` از hook زیر گرفته و دستی به insert پاس داده می‌شوند:

```text
useOrg()
```

---

## 2) کد/شماره Contact

در create قدیمی contact، ستون `code` ارسال نمی‌شود. پس code توسط trigger دیتابیس تولید می‌شود:

```text
trg_set_contact_code → set_contact_code()
```

در detail edit قدیمی، امکان update دستی code دیده می‌شود، اما در فرم Panel مرحله ۹-ب برای حفظ امنیت و جلوگیری از ناسازگاری، code read-only باقی می‌ماند.

---

## 3) قوانین کسب‌وکاری ProductModal قدیمی

مسیر:

```text
app/(app)/products/page.tsx
```

کامپوننت:

```text
ProductModal
```

### فیلدهای base product

```ts
const baseFields = {
  name: name.trim(),
  code: code.trim() || null,
  season: season.trim() || null,
  material: material.trim() || null,
  description: description.trim() || null,
  image_url: imageUrl.trim() || null,
  category_id: categoryId || null,
  brand_id: brandId || null,
  low_stock_threshold: Number(toEnDigits(lowStock)) || 0,
};
```

### Create product

```ts
const { data, error: e } = await supabase
  .from("products")
  .insert({ org_id: orgId, branch_id: branchId, ...baseFields })
  .select("id")
  .single();
```

### Update product

```ts
await supabase.from("products").update(baseFields).eq("id", editing.id);
```

### Variant payload

```ts
const payload = {
  org_id: orgId,
  branch_id: branchId,
  product_id: productId,
  color: v.color.trim() || null,
  size: v.size.trim() || null,
  sku: v.sku.trim() || null,
  barcode: v.barcode.trim() || null,
  purchase_price: v.purchase_price ? tomanToRial(Number(toEnDigits(v.purchase_price))) : null,
  sale_price: v.sale_price ? tomanToRial(Number(toEnDigits(v.sale_price))) : null,
};
```

### Create variant قدیمی

```ts
const { data: newV, error: e } = await supabase
  .from("product_variants")
  .insert({ ...payload, stock_qty: 0 })
  .select("id")
  .single();
```

### موجودی اولیه قدیمی

قدیم مستقیم در `stock_movements` insert می‌کرد:

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

### تصمیم ۹-ب

طبق فاز A، دیگر direct insert برای stock movement در مسیر جدید انجام نمی‌شود. برای موجودی اولیه variant جدید از RPC زیر استفاده می‌شود:

```text
fn_add_stock_movement(product_id, variant_id, 'opening', qty, null, null, note)
```

---

## 4) code محصول

در create product قدیمی:

```ts
code: code.trim() || null
```

اگر خالی باشد، trigger دیتابیس کد تولید می‌کند:

```text
trg_set_product_code → set_product_code()
```

در Panel جدید، code برای محصول قابل وارد کردن است ولی اگر خالی بماند دیتابیس تولید می‌کند. برای contact، code read-only نگه داشته شد.

---

## 5) Validation مرحله ۹-ب

### Contact

- `name` اجباری.
- `phone` اگر وارد شود باید بعد از تبدیل ارقام فارسی/عربی، حداقل 7 و حداکثر 15 رقم داشته باشد.

### Product

- `name` اجباری.
- قیمت‌ها ورودی تومان هستند و به ریال تبدیل می‌شوند.
- موجودی اولیه variant عدد صحیح است.

---

## 6) Query invalidation

الگو:

```text
["entity", "contact", "detail", id]
["entity", "contact", "documents", id]
["contacts"]
["contact-balances"]

["entity", "product", "detail", id]
["entity", "product", "stock", id]
["products"]
```

---

## 7) Audit

Audit به صورت خودکار توسط triggerهای فاز A انجام می‌شود:

```text
trg_audit_contacts
trg_audit_products
trg_audit_product_variants
trg_audit_stock_movements
```

برای stock اولیه variant جدید، `fn_add_stock_movement` خودش علاوه بر trigger، audit با `source='rpc'` ثبت می‌کند.
