# یادداشت فنی مرحله ۷ — Core Runtime / PanelManager

## هدف

این مرحله زیرساخت اولیه Entity/Panel-based UI را بدون شکستن UI فعلی اضافه می‌کند. هیچ modal قدیمی حذف نشده و هیچ صفحه‌ای refactor نشده است.

---

## فایل‌های اصلی

```text
src/core/panel-manager/types.ts
src/core/panel-manager/panel-manager.store.ts
src/core/panel-manager/PanelManagerProvider.tsx
src/core/panel-manager/PanelHost.tsx
src/core/panel-manager/EntityLink.tsx
src/core/panel-manager/CoreRuntimeDevButton.tsx

src/core/picker/types.ts
src/core/picker/usePicker.ts
src/core/picker/PickerHost.tsx

src/core/services/search-service.ts
src/shared/panels/PlaceholderPanels.tsx
src/shared/pickers/README.md
```

---

## API عمومی PanelManager

```ts
const {
  openEntity,
  openDocument,
  openPicker, // از usePicker
  closeTop,
  closeAll,
  replaceTop,
  stack,
  topPanel,
} = usePanelManager();
```

### openEntity

```ts
openEntity("contact", contactId, { mode: "view", context: "entity-link" });
openEntity("product", productId, { mode: "view" });
```

### openDocument

```ts
openDocument("sale", saleId, { mode: "view" });
openDocument("purchase", purchaseId, { mode: "edit" });
```

### openPicker

```ts
const { openPicker } = usePicker();

openPicker("contact", (item) => {
  openEntity("contact", item.id, { title: item.title });
});
```

---

## Stack Behavior

- هر `openEntity` یا `openDocument` یک panel جدید push می‌کند.
- `closeTop()` فقط panel بالایی را می‌بندد.
- panelهای زیرین در DOM باقی می‌مانند و state آن‌ها حفظ می‌شود.
- فقط panel بالایی interactive است.
- Esc یا backdrop باعث `closeTop()` می‌شود.

سناریوی هدف:

```text
InvoicePanel
  → ContactPanel
    → ProductPanel
      close → ContactPanel
    close → InvoicePanel
```

---

## Picker Foundation

Picker عمومی از RPC زیر استفاده می‌کند:

```text
fn_global_search(q, p_limit)
```

- debounce حدود 250ms
- keyboard navigation: ArrowUp/ArrowDown/Enter/Esc
- filter بر اساس type: contact/product/document/all
- picker فقط انتخاب می‌کند، edit/create انجام نمی‌دهد.

---

## Service Layer

کامپوننت‌های picker مستقیم به Supabase وصل نشده‌اند. مسیر درست:

```text
PickerHost → search-service → lib/supabase/client.ts → fn_global_search
```

این مطابق قانون معماری است:

```text
UI component نباید مستقیماً DB call پراکنده داشته باشد.
```

---

## نصب در App

در `components/providers.tsx` اضافه شده است:

```text
QueryClientProvider
  ThemeProvider
    PanelManagerProvider
      PickerProvider
        children
        PickerHost
        CoreRuntimeDevButton
```

---

## PoC روی سایت

برای فعال کردن PoC، به هر route لاگین‌شده این query را اضافه کنید:

```text
?core_poc=1
```

مثلاً:

```text
/dashboard?core_poc=1
```

یک دکمه کوچک نمایش داده می‌شود:

```text
تست Picker → ContactPanel
```

رفتار:

1. Picker باز می‌شود.
2. با `fn_global_search` مشتری جستجو می‌شود.
3. انتخاب مشتری باعث باز شدن `ContactPanel` موقت می‌شود.
4. داخل ContactPanel می‌توان ProductPanel موقت را روی stack باز کرد.
5. بستن ProductPanel به ContactPanel برمی‌گردد.
6. بستن ContactPanel به workspace برمی‌گردد.

---

## نکات مرحله بعد

در مرحله‌های بعدی باید placeholderها جایگزین شوند با:

```text
ContactPanel واقعی
ProductPanel واقعی
InvoicePanel واقعی
Payment/TransactionPanel واقعی
```

همچنین `components/shared/entity-link.tsx` فعلی می‌تواند تدریجاً به `src/core/panel-manager/EntityLink.tsx` مهاجرت کند.
