# MIGRATION NOTES — یکپارچه‌سازی سیستم کامپوننت UI

> وضعیت: **در حال بررسی** · برنچ: `design/stitch-refresh` · تاریخ: ۱۴۰۵/۰۵/۰۶
> این سند فقط یادداشت تصمیم است. تا این لحظه **هیچ کدی تغییر نکرده**.

---

## ۱) مسئله

در پروژه دو سیستم کامپوننت UI به‌صورت موازی وجود دارد:

| سیستم | تعداد فایل مصرف‌کننده | تعداد export |
|---|---|---|
| `components/shared/ui.tsx` | ۳۲ | ۵ |
| `src/shared/ui/*` | ۱۹ | ۳۰ (در ۱۲ فایل) |

۶ فایل **همزمان از هر دو** import می‌کنند:

```
app/(app)/crm/rfm/page.tsx
app/(app)/inventory/as-of/page.tsx
app/(app)/inventory/stock-card/page.tsx
app/(app)/purchases/page.tsx
app/(app)/reports/sellers/page.tsx
app/(app)/sales/page.tsx
```

این وضعیت نتیجه‌ی یک مهاجرت نیمه‌تمام از `components/` به `src/` است.

---

## ۲) ⚠️ نکته مهم: عدد «۳۲ در برابر ۱۶» گمراه‌کننده است

تصمیم اولیه («`components/shared/ui.tsx` سیستم اصلی بماند») بر پایه‌ی تعداد فایل‌های مصرف‌کننده گرفته شد. اما بررسی محتوا نشان می‌دهد **این دو فایل هم‌وزن نیستند**:

### الف) پوشش کامپوننتی

`components/shared/ui.tsx` فقط **۵ کامپوننت** دارد:

```
PageHeader · StatCard · Spinner · EmptyState · Modal
```

`src/shared/ui/*` **۳۰ export** دارد، شامل کل لایه‌ی فرم و داده:

```
Button · IconButton · Input · NumberInput · Select · Textarea · Field
DataTable + Column<T> · Badge · StatusPill · Card · Section
PanelShell · Tabs · Toast · ConfirmDialog · HelpTip · Skeleton
```

یعنی ۳۲ فایلی که از `components/shared/ui.tsx` استفاده می‌کنند، عمدتاً فقط `PageHeader` و `Modal` می‌گیرند — نه یک سیستم طراحی کامل.

### ب) پشتیبانی از تم و دارک‌مود ← تعیین‌کننده

| معیار | `components/shared/ui.tsx` | `src/shared/ui/*` |
|---|---|---|
| توکن معنایی (`bg-card`, `text-muted-foreground`) | **۰ مورد** | **۴۹ مورد** |
| رنگ هاردکد (`slate-*`) | **۲۵ مورد** | کم |
| واریانت `dark:` | **۰** | **۱۳** |

پروژه یک سیستم تم کامل دارد:
- `app/globals.css` → متغیرهای HSL برای light + بلوک `.dark` (خط ۸۴)
- `tailwind.config.ts` → نگاشت `card`, `muted`, `primary`, `border`, `destructive`, `success`, `warning`, `info`
- `lib/theme.ts` + `components/shared/theme-provider.tsx` → تعویض تم و مود

**`components/shared/ui.tsx` از این سیستم استفاده نمی‌کند.** رنگ‌هایش (`slate-900`, `slate-400`, …) ثابت‌اند و به دارک‌مود واکنش نشان نمی‌دهند.

### نتیجه

اگر `components/shared/ui.tsx` مبنا شود، بازطراحی UI عملاً یعنی **بازنویسی آن با توکن‌های معنایی** — یعنی همان کاری که در `src/shared/ui/*` قبلاً انجام شده.

📌 **پیشنهاد:** پیش از شروع بازطراحی، این تصمیم بازبینی شود. گزینه‌ها در بخش ۵.

---

## ۳) exportهای موجود در `src/shared/ui/*` که معادلی در `components/shared/ui.tsx` ندارند

**۲۷ مورد از ۳۰ export بدون معادل‌اند.** فقط `Spinner` و `EmptyState` در هر دو وجود دارند.

### فرم و ورودی — بدون معادل
| Export | فایل |
|---|---|
| `Input` | `Inputs.tsx` |
| `NumberInput` | `Inputs.tsx` |
| `Select` | `Inputs.tsx` |
| `Textarea` | `Inputs.tsx` |
| `Field` | `Inputs.tsx` |

### اکشن — بدون معادل
| Export | فایل |
|---|---|
| `Button` + `ButtonProps` / `ButtonVariant` / `ButtonSize` | `Button.tsx` |
| `IconButton` | `IconButton.tsx` |

### نمایش داده — بدون معادل
| Export | فایل |
|---|---|
| `DataTable` | `Table.tsx` |
| `Column<T>` (type) | `Table.tsx` |
| `Badge` + `BadgeTone` | `Badge.tsx` |
| `StatusPill` | `Badge.tsx` |
| `Card` | `Card.tsx` |
| `Section` | `Card.tsx` |

### چیدمان و ناوبری — بدون معادل
| Export | فایل |
|---|---|
| `PanelShell` | `PanelShell.tsx` |
| `Tabs` + `TabItem` | `Tabs.tsx` |

### بازخورد و سرویس‌های سراسری — بدون معادل
| Export | فایل | نکته |
|---|---|---|
| `ToastProvider` | `Toast.tsx` | 🔴 در `components/providers.tsx` استفاده شده |
| `useToast` | `Toast.tsx` | در ۵ فایل + سرویس‌های core |
| `ConfirmProvider` | `ConfirmDialog.tsx` | 🔴 در `components/providers.tsx` استفاده شده |
| `useConfirm` + `ConfirmOptions` / `ConfirmTone` | `ConfirmDialog.tsx` | |
| `Skeleton` | `Feedback.tsx` | |
| `HelpTip` | `HelpTip.tsx` | |

### دارای معادل (نیازمند یکسان‌سازی، نه حذف)
| Export | تفاوت |
|---|---|
| `Spinner` | امضای متفاوت: نسخه `src` مقدار پیش‌فرض `"در حال بارگذاری..."` دارد، نسخه `components` ندارد |
| `EmptyState` | نسخه `components` پراپ‌های اضافی `icon` و `message` دارد؛ نسخه `src` ندارد |

### فقط در `components/shared/ui.tsx` (بدون معادل در `src`)
`PageHeader` · `StatCard` · `Modal`

---

## ۴) 🔴 وابستگی بحرانی: `src/shared/ui` قابل حذف ساده نیست

`src/shared/ui/*` صرفاً توسط صفحات مصرف نمی‌شود؛ **زیرساخت runtime به آن وابسته است**:

```
components/providers.tsx          → ToastProvider, ConfirmProvider  ← ریشه‌ی درخت اپ
src/core/picker/PickerHost.tsx    → UI
src/core/services/contact-service.ts   → useToast
src/core/services/invoice-service.ts   → useToast
src/core/services/product-service.ts   → useToast
src/shared/panels/ContactPanel.tsx     → PanelShell و…
src/shared/panels/InvoicePanel.tsx
src/shared/panels/ProductPanel.tsx
src/shared/panels/PlaceholderPanels.tsx
```

`ToastProvider` و `ConfirmProvider` در `components/providers.tsx` کل اپ را می‌پوشانند. حذف `src/shared/ui` بدون جایگزینی این دو، **کل اپلیکیشن را می‌شکند**.

بنابراین «حذف تدریجی» باید با این ترتیب انجام شود و نه هیچ ترتیب دیگری:

1. کامپوننت‌های برگ (`Badge`, `Skeleton`, `HelpTip`)
2. فرم‌ها (`Input`, `Select`, `Field`, …)
3. داده (`DataTable`, `Card`, `Section`)
4. چیدمان (`PanelShell`, `Tabs`)
5. **آخر از همه:** `ToastProvider` / `ConfirmProvider` — نیازمند مهاجرت هم‌زمان `providers.tsx` + ۳ سرویس core + ۴ پنل

---

## ۵) گزینه‌های پیش‌رو

### گزینه A — تثبیت `components/shared/ui.tsx` (تصمیم فعلی)
- باید ۲۷ کامپوننت به آن اضافه شود
- باید ۲۵ رنگ هاردکد با توکن معنایی جایگزین شود تا دارک‌مود کار کند
- ۱۹ فایل باید import عوض کنند
- ریسک: بازنویسی چیزی که کار می‌کند

### گزینه B — تثبیت `src/shared/ui/*` ✅ پیشنهادی
- فقط ۳ کامپوننت (`PageHeader`, `StatCard`, `Modal`) باید منتقل شود
- سازگاری با تم/دارک‌مود از پیش موجود است
- ۳۲ فایل باید import عوض کنند (تغییر مکانیکی مسیر، نه بازنویسی)
- زیرساخت core دست‌نخورده می‌ماند

### گزینه C — سیستم سوم بر پایه‌ی `DESIGN.md`
- منطقی اگر بازطراحی عمیق باشد
- هر دو سیستم قدیمی به‌تدریج بازنشسته می‌شوند
- پرهزینه‌ترین گزینه

**توصیه:** اگر بازطراحی شامل دارک‌مود یا تعویض تم است → گزینه B یا C. گزینه A فقط وقتی منطقی است که دارک‌مود کنار گذاشته شود.

---

## ۶) یادداشت جانبی: سیستم سوم Tabs

`components/ui/tabs.tsx` وجود دارد (`Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`) اما **هیچ فایلی آن را import نمی‌کند**. کد مرده است و می‌تواند بدون ریسک حذف شود.

---

## ۷) قوانین در حین بازطراحی

- ❌ import جدید از `src/shared/ui` در فایل‌های تازه اضافه نکنید تا تصمیم بخش ۵ نهایی شود
- ❌ منطق کسب‌وکار و کوئری‌های Supabase در جریان این مهاجرت تغییر نکند
- ✅ هر تغییر با `npx tsc --noEmit` و `npx vitest run` تأیید شود
- ✅ ۶ فایلی که از هر دو سیستم import می‌کنند، اولویت پاک‌سازی‌اند
