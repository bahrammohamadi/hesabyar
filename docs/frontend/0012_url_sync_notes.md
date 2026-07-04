# مرحله ۱۲ — URL Sync برای Panel Stack

## 1) تصمیم معماری

برای این پروژه، راه‌حل انتخاب‌شده:

```text
Query params ساده با کلید panels + History API مستقیم
```

نه Next.js Parallel/Intercepting Routes.

### دلیل

Panelها باید روی هر workspace باز شوند، نه فقط روی چند route خاص. همچنین stack چندلایه داریم:

```text
Contact → Invoice → Product
```

Parallel/Intercepting Routes برای modalهای route-specific مناسب است، اما برای stack runtime که روی همه صفحات باید کار کند، پیچیدگی زیادی ایجاد می‌کند.

---

## 2) فرمت URL

فرمت انتخابی:

```text
?panels=contact:view:<id>,invoice:sale:view:<id>,product:view:<id>
```

نمونه:

```text
/dashboard?panels=contact:view:929c...,invoice:sale:view:9671...,product:view:a428...
```

### فرمت segmentها

Contact:

```text
contact:<mode>:<id|new>
```

Product:

```text
product:<mode>:<id|new>
```

Invoice:

```text
invoice:<docType>:<mode>:<id|new>
```

Payment:

```text
payment:<mode>:<id|new>
```

این فرمت از JSON خواناتر است، راحت‌تر copy/share می‌شود، و برای debug دستی مناسب‌تر است.

---

## 3) Back/Forward behavior

تصمیم:

- باز کردن پنل جدید با `history.pushState` انجام می‌شود.
- بستن پنل با `closeTop/closeAll` با `history.replaceState` انجام می‌شود.
- کلیک Back مرورگر وقتی پنل باز است، به URL قبلی برمی‌گردد و stack از URL parse می‌شود.

نتیجه:

```text
Back مرورگر = بستن پنل بالایی، اگر entry قبلی stack کمتر داشته باشد.
```

اگر stack خالی شود، رفتار back بعدی مرورگر عادی است.

---

## 4) useSearchParams و Suspense

در مرحله ۷ برای جلوگیری از build/static rendering issue از `window.location.search` استفاده شده بود.

در این مرحله هم از `next/navigation` استفاده نشد و مستقیماً از History API استفاده شد:

```text
window.history.pushState
window.history.replaceState
window.addEventListener('popstate')
```

این روش:

- نیاز به Suspense boundary ندارد.
- امضای PanelManager را تغییر نمی‌دهد.
- در client-only Provider فعلی امن است.

---

## 5) Mount اولیه / Refresh

در mount اولیه `PanelManagerStoreProvider`، اگر `?panels=` وجود داشته باشد:

- stack از URL بازسازی می‌شود.
- فقط id/type/mode/docType از URL خوانده می‌شود.
- داده‌ها توسط خود Panelها از serviceها refetch می‌شوند.

یعنی refresh صفحه با پنل باز، پنل‌ها را برمی‌گرداند و داده تازه می‌خواند.

---

## 6) id نامعتبر

در سطح URL parser، idهای غیر UUID و segmentهای ناقص حذف می‌شوند و URL با مقدار تمیز replace می‌شود.

اگر id از نظر UUID معتبر باشد ولی رکورد در DB حذف شده باشد، Panel مربوطه EmptyState نشان می‌دهد و crash نمی‌کند. پاک‌سازی URL برای رکورد حذف‌شده نیاز به fetch در سطح Panel دارد و به عنوان TODO آینده قابل بهبود است.

---

## 7) حفظ API عمومی

امضاهای عمومی تغییر نکردند:

```ts
openEntity(type, id?, opts?)
openDocument(docType, id?, opts?)
openPanel(type, opts?)
closeTop()
closeAll()
replaceTop()
```

پس نقاط استفاده قبلی در contacts/products/sales/purchases/dashboard/global search/picker سالم می‌مانند.
