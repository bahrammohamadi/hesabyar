# ممیزی تطابق قابلیت Modalهای قدیمی با Panelهای جدید — مرحله ۱۵

> هدف: حذف فقط Modalهایی که ۱۰۰٪ با Panel جدید پوشش داده شده‌اند  
> نتیجه کلی: **هیچ Modal قدیمی در این مرحله حذف نشد**  
> دلیل: هیچ موردی با اطمینان ۱۰۰٪ پوشش کامل ندارد. چند مورد ساده‌تر نزدیک هستند، اما حتی آن‌ها فیلدها/رفتارهای جاافتاده دارند.

---

## 1) خلاصه تصمیم نهایی

| گروه | نتیجه |
|---|---|
| Contact modals | حذف نشوند |
| Product modals | حذف نشوند |
| Invoice/payment/cancel modals | حذف نشوند |
| POS/Purchase create modals | حذف نشوند |
| CRM/Interaction/Wallet/etc | خارج از پوشش Panel فعلی، حذف نشوند |

لیست قطعی حذف‌شده‌ها:

```text
هیچ موردی حذف نشد.
```

---

## 2) جدول کامل ممیزی Modalهای مرتبط

| Modal | فایل | قابلیت‌های دقیق | معادل در Panel جدید | پوشش ۱۰۰٪؟ | کسری دقیق | تصمیم |
|---|---|---|---|---|---|---|
| `ContactModal` | `app/(app)/contacts/page.tsx` | ساخت/ویرایش contact، فیلدهای first_name, last_name, name, type, phone, email, birth_date, national_code, job_title, gender, address, description، ذخیره meta، set org_id/branch_id، code auto توسط DB | `ContactPanel` create/edit | خیر، جزئی | ContactPanel فعلی فقط name, phone, type, address, description دارد. فیلدهای meta مثل email, birth_date, national_code, job_title, gender, first/last name مستقل پوشش داده نشده‌اند. code read-only است. | نگه‌داشتن |
| `ContactEditModal` | `app/(app)/contacts/[id]/page.tsx` | ویرایش contact در صفحه detail، شامل name/type/phone/address/description/code و meta | `ContactPanel` edit | خیر، جزئی | ContactPanel کد را read-only نگه می‌دارد و metaهای کامل را پوشش نمی‌دهد. صفحه detail هم context کامل‌تری دارد. | نگه‌داشتن |
| `InteractionModal` | `app/(app)/contacts/[id]/page.tsx` | ثبت تعامل CRM برای contact: type/title/description/next follow-up | معادل ندارد | خیر | ContactPanel فعلی تب/فرم interaction ندارد. | نگه‌داشتن |
| `TxModal` | `app/(app)/contacts/[id]/page.tsx` | دریافت/پرداخت مستقیم برای contact، insert در transactions، انتخاب حساب | فعلاً معادل کامل ندارد | خیر | PaymentPanel واقعی برای contact هنوز ساخته نشده. ContactPanel فقط مانده و اسناد را نشان می‌دهد. | نگه‌داشتن |
| `ContactSelector` create mode | `components/shared/contact-selector.tsx` | انتخاب contact + ایجاد سریع contact داخل selector | Picker جدید + ContactPanel create | خیر، جزئی | Picker جدید فقط search/select است و ContactPanel create وجود دارد، اما جریان embedded create داخل selector قدیمی هنوز با call siteهای قدیمی یکپارچه است. حذف آن call siteها را می‌شکند. | نگه‌داشتن |
| `ProductModal` | `app/(app)/products/page.tsx` | ساخت/ویرایش product، فیلدهای name, code, season, material, description, image_url, category_id, brand_id, low_stock_threshold، چند variant همزمان، sku/barcode/color/size/prices/stock، موجودی اولیه با stock_movements | `ProductPanel` create/edit + create/update variant | خیر، جزئی | ProductPanel فعلی category_id, brand_id, image_url را در فرم ندارد. ProductPanel افزودن variant را دارد ولی چند variant همزمان مثل ProductModal ندارد. موجودی اولیه از RPC درست شده اما همه فیلدهای قدیمی پوشش کامل ندارند. | نگه‌داشتن |
| `ProductEditModal` | `app/(app)/products/[id]/page.tsx` | ویرایش product در صفحه detail شامل name, code, season, material, description, category_id, brand_id, low_stock_threshold | `ProductPanel` edit | خیر، جزئی | ProductPanel category/brand را ندارد. اگر حذف شود کاربر مسیر ویرایش دسته/برند از صفحه کامل را از دست می‌دهد. | نگه‌داشتن |
| `PriceChangeModal` | `app/(app)/products/[id]/page.tsx` | تغییر قیمت خرید/فروش product/variants با RPC `change_product_price` و ثبت history/activity | معادل ندارد | خیر | ProductPanel فقط قیمت‌های پایه/variant را update می‌کند و مسیر رسمی `change_product_price`، history و apply-to-variants کامل ندارد. | نگه‌داشتن |
| `AdjustModal` | `app/(app)/products/[id]/page.tsx` | تعدیل موجودی چند variant، ثبت stock_movements با reason=count، note، activity log | معادل ندارد | خیر | ProductPanel در ۹-ب فقط initial stock برای variant جدید دارد؛ تعدیل موجودی موجود را ندارد. | نگه‌داشتن |
| `EditInvoiceModal` | `app/(app)/sales/[id]/page.tsx` | ویرایش فاکتور فروش: تاریخ، مشتری، اقلام، qty, price, discount, tax, note، ProductSelector/ContactSelector، RPC `update_sale_invoice` | `InvoicePanel` | خیر | InvoicePanel فعلی view + workflow/payment است، اما edit اقلام/مشتری/تخفیف/مالیات ندارد. | نگه‌داشتن |
| `CancelSaleModal` | `app/(app)/sales/[id]/page.tsx` | ابطال فروش با reason و RPC legacy `cancel_sale`، خنثی‌سازی موجودی/پرداخت legacy | `InvoicePanel` reverse با `fn_transition_document` | خیر، جزئی/رفتاری متفاوت | InvoicePanel reverse دارد، اما مسیر legacy cancel_sale و semantics cancelled/returned متفاوت است. حذف باعث از دست رفتن مسیر قدیمی و رفتار آشنا می‌شود. | نگه‌داشتن |
| `SalePaymentModal` | `app/(app)/sales/[id]/page.tsx` | ثبت پرداخت فروش، انتخاب account، method cash/card/transfer/cheque، note، RPC legacy `record_sale_payment` | `InvoicePanel` payment با `fn_register_payment` | خیر، جزئی | InvoicePanel payment دارد اما account انتخاب نمی‌کند و methodها محدودترند. مسیر legacy ممکن است برای حسابداری فعلی لازم باشد. | نگه‌داشتن |
| `EditPurchaseModal` | `app/(app)/purchases/[id]/page.tsx` | ویرایش خرید: supplier, date, items, prices, extra/tax/discount/note، RPC `update_purchase_invoice` | `InvoicePanel` | خیر | InvoicePanel هنوز edit خرید و اقلام خرید ندارد. | نگه‌داشتن |
| `CancelPurchaseModal` | `app/(app)/purchases/[id]/page.tsx` | ابطال خرید با reason و RPC legacy `cancel_purchase` | `InvoicePanel` reverse | خیر، جزئی/رفتاری متفاوت | reverse جدید و cancel legacy رفتار/پیام/semantics متفاوت دارند. حذف زود است. | نگه‌داشتن |
| `PurchasePaymentModal` | `app/(app)/purchases/[id]/page.tsx` | ثبت پرداخت خرید، account, method, note، RPC `record_purchase_payment` | `InvoicePanel` payment با `fn_register_payment` | خیر، جزئی | InvoicePanel account/note ندارد و methodهای legacy چک/حساب را کامل پوشش نمی‌دهد. | نگه‌داشتن |
| `PosModal` | `app/(app)/sales/page.tsx` | ساخت فروش/POS، customer picker، product picker، cart، discount, cash/card/wallet/credit، price list، ثبت sale، success modal | InvoicePanel | خیر | InvoicePanel create ندارد و POS flow ندارد. | نگه‌داشتن |
| `QuickSaleModal` | `app/(app)/dashboard/page.tsx` | فروش سریع از dashboard با cart/payment/customer/product | InvoicePanel | خیر | InvoicePanel create/POS ندارد. | نگه‌داشتن |
| `PurchaseModal` | `app/(app)/purchases/page.tsx` | ساخت خرید جدید با supplier, items, payment, note، افزایش موجودی | InvoicePanel | خیر | InvoicePanel create purchase ندارد. | نگه‌داشتن |
| `PurchaseReturnModal` | `app/(app)/purchases/returns/page.tsx` | مرجوعی خرید و خروج موجودی | معادل ندارد | خیر | ReturnPanel/Document create برای return ساخته نشده. | نگه‌داشتن |
| `Sales return modal` | `app/(app)/sales/returns/page.tsx` | ثبت مرجوعی فروش | معادل ندارد | خیر | Return flow هنوز در Panel architecture پیاده نشده. | نگه‌داشتن |
| `QuickTxModal` | `app/(app)/dashboard/page.tsx` | ثبت expense/receipt سریع از dashboard | Payment/TransactionPanel واقعی ندارد | خیر | Payment placeholder هنوز واقعی نیست. | نگه‌داشتن |
| `AccountModal` | `app/(app)/settings/page.tsx` | ساخت حساب صندوق/بانک | معادل Panel ندارد | خیر | AccountPanel ساخته نشده. | نگه‌داشتن |
| `CreateUserModal` | `app/(app)/settings/page.tsx` | ساخت کاربر و permissionها | معادل Panel ندارد | خیر | UserPanel ساخته نشده. | نگه‌داشتن |
| `FollowupModal` | `components/shared/crm-automation-page.tsx` | ثبت پیگیری کمپین | معادل Panel ندارد | خیر | CRM actions در ContactPanel پوشش ندارد. | نگه‌داشتن |
| `InteractionModal` | `components/shared/crm-page.tsx` | ثبت تعامل مشتری در CRM overview | معادل Panel ندارد | خیر | ContactPanel هنوز interaction create ندارد. | نگه‌داشتن |
| `WalletModal` | `components/shared/loyalty-page.tsx` | تغییر اعتبار/کیف پول مشتری | معادل Panel ندارد | خیر | Loyalty/WalletPanel ساخته نشده. | نگه‌داشتن |
| `EntityQuickView Modal` | `components/shared/entity-quick-view.tsx` | quick-view قدیمی entity | Panelهای جدید view-mode | خیر، جزئی | ممکن است با Panelها overlap داشته باشد، اما هنوز call siteها و UX آن جداست. حذف بدون audit call siteها پرریسک است. | نگه‌داشتن |
| `ProductSelector Modal` | `components/shared/product-selector.tsx` | انتخاب variant با فیلترهای کامل برای فروش/خرید/انبار | Picker جدید | خیر، جزئی | Picker جدید global search ساده است؛ ProductSelector فیلترهای category/brand/color/size/price/stock دارد. | نگه‌داشتن |

---

## 3) کاندیدهای احتمالی حذف و نتیجه تست دستی

هیچ Modalی به وضعیت «پوشش ۱۰۰٪» نرسید؛ بنابراین تست تطابق دستی حذف انجام نشد.

موارد نزدیک اما ناکامل:

### ContactModal

نزدیک‌ترین مورد بود، اما حذف نشد چون این فیلدها در ContactPanel پوشش کامل ندارند:

```text
first_name
last_name
email
birth_date
national_code
job_title
gender
code editable در detail
```

### ProductModal

نزدیک بود، اما حذف نشد چون این موارد پوشش کامل ندارند:

```text
category_id
brand_id
image_url
چند variant همزمان
```

### SalePaymentModal / PurchasePaymentModal

InvoicePanel پرداخت دارد، اما حذف نشد چون:

```text
account_id ندارد
note ندارد
cheque legacy ندارد
RPC legacy متفاوت است
```

---

## 4) لیست قطعی حذف‌شده‌ها

```text
هیچ Modal حذف نشد.
```

بنابراین:

- هیچ import حذف نشد.
- هیچ state/handler حذف نشد.
- هیچ دکمه قدیمی حذف نشد.
- هیچ فایل Modal حذف نشد.

---

## 5) لیست نگه‌داشته‌شده‌ها و دلیل کوتاه

| Modal | دلیل نگه‌داشتن |
|---|---|
| ContactModal | meta fields کامل پوشش ندارد |
| ContactEditModal | code/meta fields و context detail کامل پوشش ندارد |
| InteractionModal / CRM Interaction | ContactPanel interaction create ندارد |
| TxModal | Payment/TransactionPanel برای contact ساخته نشده |
| ProductModal | category/brand/image/multi-variant کامل پوشش ندارد |
| ProductEditModal | category/brand ندارد |
| PriceChangeModal | RPC price history/change_product_price پوشش ندارد |
| AdjustModal | stock adjustment موجود را پوشش نمی‌دهد |
| EditInvoiceModal/EditPurchaseModal | InvoicePanel edit اقلام ندارد |
| CancelSale/PurchaseModal | مسیر legacy cancel با reverse جدید برابر نیست |
| Sale/PurchasePaymentModal | account/note/cheque legacy پوشش ندارد |
| PosModal/PurchaseModal | InvoicePanel create ندارد |
| Return modals | return document create ندارد |
| QuickTxModal | TransactionPanel واقعی ندارد |
| Settings modals | Account/User panel ساخته نشده |

---

## 6) نتیجه‌گیری صادقانه

در این نقطه، حذف Modalهای قدیمی زود است. Panelهای جدید برای عملیات روزمره سریع و entity-based آماده‌اند، اما هنوز همه قابلیت‌های advanced legacy را ندارند.

دو مسیر تصمیم وجود دارد:

### گزینه A — تکمیل شکاف‌ها و سپس حذف تدریجی

اگر هدف نهایی حذف Modalهای قدیمی است، باید ابتدا این شکاف‌ها در Panelها تکمیل شوند:

```text
ContactPanel: interactions + transactions/payment + full meta fields
ProductPanel: category/brand/image + price history/change price + stock adjust + movement/sales/purchase history
InvoicePanel: edit line items + print/CSV + cancel/reverse semantics کامل + account/note payment
TransactionPanel/PaymentPanel واقعی
ReturnPanel/Document create flow
```

بعد از آن می‌توان دوباره parity audit انجام داد و حذف کرد.

### گزینه B — پذیرش طراحی دو سطحی

می‌توان طراحی نهایی را این‌گونه پذیرفت:

```text
Panel = عملیات روزمره سریع و خلاصه
Full page / legacy modal = عملیات پیشرفته و پرجزئیات
```

در این مدل حذف کامل Modalها الزامی نیست و فقط مسیرهای پرکاربرد به پنل منتقل می‌شوند.

### پیشنهاد من

فعلاً گزینه B عملی‌تر و امن‌تر است. برای حذف واقعی، اول باید شکاف‌های بزرگ بالا تکمیل شوند.

---

## 7) وضعیت اجرا

چون هیچ Modalی ۱۰۰٪ پوشش نداشت، بخش حذف واقعی اجرا نشد.

```text
کد اجرایی تغییر نکرد.
فقط این گزارش اضافه شد.
```
