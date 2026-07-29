# design-reference

این پوشه **مرجع بصری** برای بازطراحی UI پروژه حساب‌یار است.

## ⚠️ قانون اصلی

> **هیچ فایلی از این پوشه نباید مستقیماً در کد اپلیکیشن `import` شود.**

این پوشه فقط حاوی مستندات طراحی، اسکرین‌شات‌ها و مراجع بصری است. محتوای آن در build نهایی شرکت نمی‌کند و صرفاً برای مشاهده در حین بازطراحی است.

---

## 🔴 وضعیت فعلی: مراجع هنوز آپلود نشده‌اند

تسک بازطراحی داشبورد به فایل‌های Stitch ارجاع می‌دهد، اما این فایل‌ها در ورک‌اسپیس موجود نیستند. جستجوی کامل فایل‌سیستم انجام شد و هیچ `code.html`، `screen.png` یا `DESIGN.md` پیدا نشد.

### ساختار مورد انتظار

```
design-reference/
├── DESIGN.md                ← نسخه‌ی «hesabyar» (مرجع اصلی نیت طراحی)
├── DESIGN-alt.md            ← نسخه‌ی دوم
├── _1/  screen.png + code.html   ← چیدمان اصلی داشبورد (اولویت ۱)
├── _2/  … تا _5/
├── _6/  screen.png + code.html   ← الگوی «هشدار موجودی» + «کالاهای پرفروش»
└── _7/ … _10/
```

### حداقل لازم برای شروع تسک داشبورد

فقط این چهار فایل کافی است:

| فایل | نقش |
|---|---|
| `_1/code.html` + `_1/screen.png` | چیدمان اصلی داشبورد |
| `_6/code.html` + `_6/screen.png` | ویجت‌های هشدار موجودی و پرفروش‌ها |
| `DESIGN.md` (نسخه hesabyar) | قواعد spacing و breakpoint |

---

## قانون رنگ (طبق تسک)

مقادیر hex خام در `DESIGN.md` و بلوک‌های Tailwind داخل `code.html` **نادیده گرفته می‌شوند**. هر رنگ باید به توکن‌های معنایی موجود پروژه نگاشت شود:

```
background · foreground · card · primary (HSL 165 65% 24%) · secondary
muted · accent · destructive · success · warning · info · border · input · ring
finance.profit / finance.loss / finance.debt / finance.credit
```

این توکن‌ها در `app/globals.css` (بلوک `:root` و `.dark` در خط ۸۴) و `tailwind.config.ts` تعریف شده‌اند. استفاده‌ی مستقیم از hex باعث می‌شود دارک‌مود و تعویض تم از کار بیفتد.

`DESIGN.md` نسخه‌ی hesabyar (`primary #004c3e`, `background #f7faf7`) نزدیک‌ترین تطابق با توکن‌های واقعی است و به‌عنوان *نیت طراحی* استفاده می‌شود، نه به‌عنوان منبع مقدار رنگ.

---

## وضعیت آمادگی زیرساخت

آماده‌سازی‌های لازم پیش از بازطراحی انجام شده است:

| مورد | وضعیت |
|---|---|
| `Button`, `Input(s)`, `Select`, `Table`, `Card`, `Badge`, `Tabs`, `IconButton`, `PanelShell`, `ConfirmDialog`, `Toast`, `HelpTip` | ✅ در `src/shared/ui/` |
| `Modal` | ✅ منتقل شد به `src/shared/ui/Modal.tsx` |
| `PageHeader`, `StatCard` | ✅ منتقل شدند |
| `EmptyState` | ✅ از نظر پراپ سازگار شد (`icon` / `message`) |
| `Spinner` | ⏸️ نیازمند تصمیم (به `MIGRATION_NOTES.md` بخش ۳ مراجعه کنید) |
| PanelManager / PanelHost / Panel Stack | ✅ موجود در `src/core/panel-manager/` و `src/shared/panels/` |
| توکن‌های معنایی + دارک‌مود | ✅ موجود |
| هوک‌های داده‌ی داشبورد | ✅ دست‌نخورده — فقط ظرف‌ها restyle می‌شوند |

بازطراحی در برنچ `design/stitch-refresh` دنبال می‌شود.
