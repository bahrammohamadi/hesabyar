# 0040 — Panel stack duplication blocking bug

## خلاصه باگ
ورود به مسیرهای route-based create مثل:

```text
/contacts/new-customer
/contacts/new-supplier
/products?action=new
```

می‌توانست باعث push شدن چندین پنل create یکسان روی stack شود. نتیجه در UI این بود که چند لایه پنل/overlay روی هم قرار می‌گرفتند و کلیک/تایپ در فرم مشتری/کالا عملاً مسدود می‌شد.

## گام صفر — بررسی دقیق مسیر route-level

### فایل‌های route

```text
app/(app)/contacts/new-customer/page.tsx
app/(app)/contacts/new-supplier/page.tsx
```

این دو فایل مستقیم پنل را باز نمی‌کردند، بلکه `ContactsPageContent` را با propهای اجباری mount می‌کردند:

```tsx
<ContactsPageContent forcedType="customer" forcedAction="new" />
<ContactsPageContent forcedType="supplier" forcedAction="new" />
```

منطق باز کردن پنل داخل فایل زیر بود:

```text
app/(app)/contacts/page.tsx
```

قبل از اصلاح:

```tsx
useEffect(() => {
  ...
  if (action === "new") {
    openEntity("contact", undefined, { mode: "create", ... });
  }
}, [searchParams, forcedType, forcedFilter, forcedAction, openEntity]);
```

### علت re-render loop

`openEntity` از `PanelManagerStoreProvider` می‌آید و identity آن به `openPanel` وابسته است؛ `openPanel` هم به `stack` وابسته بود. بنابراین:

1. صفحه mount می‌شد.
2. effect اجرا می‌شد و `openEntity(contact/create)` را صدا می‌زد.
3. stack تغییر می‌کرد.
4. Provider re-render می‌شد.
5. identity تابع `openEntity` تغییر می‌کرد.
6. dependency array دوباره effect را اجرا می‌کرد.
7. یک پنل create دیگر push می‌شد.
8. این چرخه تکرار می‌شد.

این فرضیه درست بود و علت route-level باگ محسوب می‌شود.

## بررسی PanelManager store

فایل:

```text
src/core/panel-manager/panel-manager.store.ts
```

قبل از اصلاح، `openPanel` همیشه panel جدید push می‌کرد و هیچ guard مرکزی نداشت:

```tsx
const next = normalizeStack([...stripStack(stack), panel]);
setStack(next, "push");
```

یعنی اگر بالای stack دقیقاً همان `type + mode + entityId + docType` وجود داشت، باز هم نمونه جدید اضافه می‌شد.

این ریشه مرکزی باگ بود؛ چون هر مسیر دیگری هم می‌توانست همین duplication را ایجاد کند.

## بررسی URL sync / parsePanelsFromUrl

قبل از اصلاح، اگر URL شامل segmentهای تکراری پشت‌سرهم بود:

```text
?panels=contact:create:new,contact:create:new,contact:create:new
```

`parsePanelsFromUrl` آن‌ها را به همان تعداد به stack تبدیل می‌کرد. اگر serialization متفاوت نبود، URL را تمیز نمی‌کرد. بنابراین duplication موجود در URL هم باقی می‌ماند.

## بررسی pointer-events/z-index

`PanelHost` فقط پنل top را interactive می‌کند و برای پنل‌های غیر top این class را می‌گذارد:

```text
pointer-events-none
```

اما وقتی stack ده‌ها پنل تکراری داشته باشد، DOM و transform/right offsets زیاد می‌شود و کاربر فقط لایه بالایی را می‌بیند؛ مشکل اصلی pointer-events نبود، بلکه تعداد زیاد panel instance و overlayهای انباشته بود.

## اصلاحات انجام‌شده

### 1) idempotent push در مرکز PanelManager

در `panel-manager.store.ts` اضافه شد:

```ts
isSamePanelIdentity(a, b)
dedupeConsecutivePanelStack(stack)
getNextPanelStack(currentStack, panel, replace)
```

`openPanel` حالا قبل از push بررسی می‌کند:

```ts
if (!replace && isSamePanelIdentity(top, panel)) {
  return existingTop.id;
}
```

پس اگر درخواست جدید دقیقاً همان پنل بالای stack باشد، دیگر push انجام نمی‌شود.

### 2) dedupe دفاعی URL

در `parsePanelsFromUrl`، segmentهای تکراری پشت‌سرهم حذف می‌شوند و URL با نسخه تمیزشده replace می‌شود.

### 3) guard در route-level create

در `app/(app)/contacts/page.tsx` اضافه شد:

```ts
autoOpenCreateRef
```

بنابراین `/contacts/new-customer` و `/contacts/new-supplier` فقط یک بار در mount اولیه پنل create را باز می‌کنند.

همین الگو برای:

```text
app/(app)/products/page.tsx
```

و `?action=new` اعمال شد.

## تست دائمی اضافه‌شده

فایل:

```text
tests/panel-manager.test.ts
```

سناریوی اصلی:

```text
فراخوانی مکرر open/getNextPanelStack با پارامترهای یکسان نباید stack را رشد دهد.
```

تست‌ها:

- duplicate create contact سه‌بار پشت‌سرهم → stack length همیشه 1
- dedupe segmentهای پشت‌سرهم URL
- identity comparison فقط بر اساس type/mode/entityId/docType
- serialize یک create panel به `contact:create:new`

## نتیجه تست

```text
npm test
Test Files: 3 passed
Tests: 12 passed
```

## نتیجه build

```text
npm run build: passed
```

## توصیه برای بررسی بعدی

این باگ می‌توانست هر جایی رخ دهد که route یا effect در mount مستقیم `openEntity` را صدا می‌زند. مواردی که بررسی/اصلاح شدند:

- `/contacts/new-customer`
- `/contacts/new-supplier`
- `/contacts?action=new`
- `/products?action=new`

موارد احتمالی برای ممیزی بعدی:

- هر route آینده که در `useEffect` با dependency شامل `openEntity/openDocument` پنل باز کند.
- هر deep-link جدید که از `?panels=` استفاده کند و ممکن است segment تکراری بسازد.

## اصلاح تکمیلی پس از تست کاربر

پس از گزارش ادامه‌دار کاربر، محافظت مرکزی سخت‌گیرانه‌تر شد:

- duplicate فقط در top بررسی نمی‌شود؛ اگر همان panel identity هر جای stack باشد، stack تا همان panel کوتاه می‌شود و push جدید انجام نمی‌شود.
- برای URL، dedupe فقط consecutive نیست؛ duplicateهای غیرمجاور هم حذف می‌شوند.
- `openEntityForResult` از این dedupe عمومی مستثنیِ منطقی شد: اگر panel جدید `resultRequestId` داشته باشد، با create panel معمولی یکی حساب نمی‌شود؛ وگرنه promise انتخابگر به پنل قبلی وصل نمی‌شد.
- `PanelHost` برای محافظت در برابر stackهای آلوده قدیمی فقط آخرین ۴ panel را render می‌کند.

تست‌های اضافه‌شده:

```text
- duplicate غیرمجاور در URL dedupe می‌شود.
- create-for-result با create معمولی یکی حساب نمی‌شود.
```

نتیجه نهایی:

```text
Test Files: 3 passed
Tests: 14 passed
```
