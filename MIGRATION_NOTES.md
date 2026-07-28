# MIGRATION NOTES — یکپارچه‌سازی سیستم کامپوننت UI

> برنچ: `design/stitch-refresh` · آخرین به‌روزرسانی: ۱۴۰۵/۰۵/۰۶
> وضعیت: **فاز ۱ اجرا شد.** هیچ تغییری در ظاهر صفحات یا منطق کسب‌وکار داده نشده.

---

## ۱) تصمیم نهایی (بازنگری‌شده)

پس از بررسی محتوایی دو سیستم، تصمیم اولیه **برعکس شد**:

| | سیستم |
|---|---|
| ✅ **باقی‌مانده / اصلی** | `src/shared/ui/*` |
| ⏳ **منسوخ، حذف تدریجی** | `components/shared/ui.tsx` |

### چرا برعکس شد؟

تصمیم اولیه بر پایه‌ی «۳۲ فایل در برابر ۱۹ فایل» بود — یعنی تعداد *مصرف‌کننده*، نه وزن سیستم. بررسی محتوا نشان داد این معیار گمراه‌کننده است:

| معیار | `components/shared/ui.tsx` | `src/shared/ui/*` |
|---|---|---|
| تعداد export | ۵ | ۳۰ |
| توکن معنایی (`bg-card`, `text-muted-foreground`) | **۰** | **۴۹** |
| رنگ هاردکد (`slate-*`) | **۲۵** | کم |
| واریانت `dark:` | **۰** | **۱۳** |
| پوشش | فقط چیدمان صفحه | فرم، جدول، بازخورد، پنل، تم |

پروژه یک سیستم تم کامل دارد (`app/globals.css` با بلوک `.dark` در خط ۸۴ + نگاشت در `tailwind.config.ts` + `lib/theme.ts`). `components/shared/ui.tsx` از آن استفاده نمی‌کند و به دارک‌مود واکنش نشان نمی‌دهد. تثبیت آن یعنی بازنویسی چیزی که در سیستم دیگر از قبل درست کار می‌کند.

---

## ۲) فاز ۱ — آنچه انجام شد ✅

### الف) انتقال دو کامپوننت به سیستم اصلی

| کامپوننت | مقصد جدید |
|---|---|
| `PageHeader` (+ helper داخلی `HeaderHelpTip`) | `src/shared/ui/PageHeader.tsx` |
| `StatCard` | `src/shared/ui/StatCard.tsx` |

کد **عیناً** منتقل شد. با `diff` تأیید شد که بدنه‌ی هر سه (`PageHeader`, `StatCard`, `HeaderHelpTip`) بایت‌به‌بایت با نسخه‌ی اصلی یکسان است. بازنویسی با توکن‌های معنایی **انجام نشد** — فاز بعدی.

هر دو به `src/shared/ui/index.ts` اضافه شدند.

> نکته: `HeaderHelpTip` عمداً با `HelpTip` موجود ادغام **نشد**. ابعادشان فرق دارد (`h-6/w-6` + آیکون ۱۴ + عرض `w-72` در برابر `h-5/w-5` + آیکون ۱۳ + عرض `w-64`). ادغام یک تغییر بصری است.

### ب) حذف کد مرده

`components/ui/tabs.tsx` حذف شد. با سه الگوی جستجوی مستقل تأیید شد که هیچ فایلی آن را import نمی‌کند (تنها ارجاعات، تعاریف خودش بودند). پوشه‌ی `components/ui/` اکنون خالی است.

### ج) تبدیل `components/shared/ui.tsx` به shim موقت

فایل حذف نشد تا ۳۰ فایل مصرف‌کننده بدون تغییر کار کنند:

```ts
export { PageHeader, StatCard } from "@/src/shared/ui";  // منتقل‌شده
export function Spinner(...)      // هنوز اینجا — به بخش ۳ مراجعه کنید
export function EmptyState(...)   // هنوز اینجا
export function Modal(...)        // هنوز اینجا
```

**هیچ فایل مصرف‌کننده‌ای تغییر نکرد.** فقط ۴ فایل لمس شد.

### د) تأیید سلامت

```
npx tsc --noEmit   → صفر خطا
npx vitest run     → ۱۴/۱۴ سبز
npm run build      → موفق، ۶۹/۶۹ صفحه
```

---

## ۳) 🔴 سه موردی که عمداً منتقل نشدند — نیازمند تصمیم شما

### `EmptyState` — بلوکه‌کننده‌ی واقعی

نسخه‌ی `src` این دو پراپ را **ندارد**:

| پراپ | تعداد استفاده | نسخه `src` |
|---|---|---|
| `icon` | ۲۵ مورد | ❌ ندارد |
| `message` | ۹ مورد | ❌ ندارد |

جمعاً **۳۴ محل در ۱۷ فایل**. re-export ساده ⇒ ۳۴ خطای TypeScript + ناپدید شدن آیکون‌ها.

تفاوت بصری هم هست: نسخه `components` بدون کادر است (`py-16`)، نسخه `src` کادر خط‌چین دارد (`border-dashed` + `p-8`).

<details>
<summary>۱۷ فایل متأثر</summary>

```
app/(app)/activity/page.tsx
app/(app)/checks/page.tsx
app/(app)/crm/rfm/page.tsx
app/(app)/inventory/as-of/page.tsx
app/(app)/inventory/stock-card/page.tsx
app/(app)/products/[id]/page.tsx
app/(app)/purchases/returns/page.tsx
app/(app)/reports/customer-profitability/page.tsx
app/(app)/reports/page.tsx            ← ۷ محل، بیشترین
app/(app)/reports/profitability/page.tsx
app/(app)/reports/sellers/page.tsx
app/(app)/sales/orders/page.tsx
app/(app)/sales/returns/page.tsx
app/(app)/settings/price-lists/page.tsx
components/shared/crm-automation-page.tsx
components/shared/crm-page.tsx
components/shared/loyalty-page.tsx
```
</details>

**گزینه‌ها:** (الف) افزودن `icon` و `message` به نسخه `src` به‌عنوان پراپ اختیاری — سازگار با گذشته، کم‌ریسک · (ب) بازنویسی ۳۴ محل · (ج) فعلاً بماند.

### `Spinner` — تفاوت ظاهری خاموش

| | `components` | `src` |
|---|---|---|
| `label` پیش‌فرض | ندارد | `"در حال بارگذاری..."` |
| فاصله | `py-12` | `py-8` |
| رنگ | `text-slate-400` | `text-muted-foreground` |

۳۰ محل `<Spinner />` بدون پراپ است. با سوییچ، **در هر ۳۰ محل ناگهان متن «در حال بارگذاری...» ظاهر می‌شود** و ارتفاع تغییر می‌کند. خطای تایپ نمی‌دهد — یعنی بی‌صدا رخ می‌دهد.

**گزینه‌ها:** (الف) `label` را در نسخه `src` اختیاری بدون پیش‌فرض کن · (ب) پذیرش تغییر ظاهر · (ج) فعلاً بماند.

### `Modal` — معادلی وجود ندارد

در `src/shared/ui` هیچ `Modal` نیست. `PanelShell` جایگزین نیست:

| | `Modal` | `PanelShell` |
|---|---|---|
| نمایش | overlay + backdrop از طریق `createPortal` | پنل کشویی درون `PanelHost` |
| backdrop | `bg-black/40` دارد | ندارد |
| کنترل | `open` / `onClose` | فقط `onClose` |
| اندازه | `md` / `lg` / `xl` | ندارد |
| موبایل | `mobileFullscreen` | ندارد |

در ۱۶ فایل استفاده می‌شود. **گزینه‌ها:** (الف) انتقال عیناً به `src/shared/ui/Modal.tsx` — ساده و بی‌ریسک · (ب) ادغام با معماری Panel Manager — تغییر رفتاری، فاز جدا.

---

## ۴) وابستگی بحرانی که ترتیب کار را تعیین می‌کند

`src/shared/ui` فقط توسط صفحات مصرف نمی‌شود؛ زیرساخت runtime به آن وابسته است:

```
components/providers.tsx              → ToastProvider, ConfirmProvider  ← ریشه‌ی درخت اپ
src/core/picker/PickerHost.tsx
src/core/services/{contact,invoice,product}-service.ts  → useToast
src/shared/panels/{Contact,Invoice,Product,Placeholder}Panel.tsx
```

چون **جهت مهاجرت اکنون به‌سمت `src` است**، این وابستگی دیگر خطر نیست — بلکه تأییدی بر درستی تصمیم است. `src/shared/ui` هیچ import ای از `components/` ندارد (بررسی شد) پس ریسک import حلقوی صفر است.

---

## ۵) نقشه‌ی فازهای بعدی

| فاز | کار | وضعیت |
|---|---|---|
| ۱ | انتقال `PageHeader` + `StatCard`، حذف `tabs.tsx`، ساخت shim | ✅ انجام شد |
| ۲ | تصمیم درباره `EmptyState` / `Spinner` / `Modal` (بخش ۳) | ⏳ منتظر شما |
| ۳ | تغییر import در ۳۰ فایل از `@/components/shared/ui` به `@/src/shared/ui` | ⏳ |
| ۴ | حذف کامل `components/shared/ui.tsx` | ⏳ |
| ۵ | بازنویسی `PageHeader` و `StatCard` با توکن معنایی + پشتیبانی dark | ⏳ |

---

## ۶) قوانین در حین بازطراحی

- ✅ در فایل‌های **جدید** فقط از `@/src/shared/ui` import کنید
- ❌ به `components/shared/ui.tsx` چیزی اضافه نکنید — این فایل فقط کوچک می‌شود
- ❌ منطق کسب‌وکار و کوئری‌های Supabase در جریان مهاجرت تغییر نکند
- ✅ هر تغییر با `npx tsc --noEmit` و `npx vitest run` تأیید شود
- ⚠️ مراقب تغییرات بصری خاموش باشید (مثل `Spinner`) که کامپایلر آن‌ها را نمی‌گیرد
