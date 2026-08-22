"use client";

/**
 * قطعات بصری صفحه فروش (POS) — مطابق مراجع طراحی step1/step2.
 *
 * ⚠️ این فایل فقط «ظرف بصری» است. هیچ منطق سبد خرید، جستجوی بارکد،
 * محاسبه‌ی مبلغ یا مدیریت روش پرداخت اینجا نیست — همه در
 * app/(app)/sales/page.tsx دست‌نخورده باقی مانده‌اند.
 */

import * as React from "react";
import type { ReactNode } from "react";
import { Barcode, Mic, Package, Percent, ScanLine, Trash2, UserPlus, Users, X } from "lucide-react";
import { Badge, Button, Card } from "@/src/shared/ui";
import { EntityLink } from "@/components/shared/entity-link";
import { EntityActionMenu } from "@/components/shared/entity-action-menu";
import { PhoneLink } from "@/components/shared/phone-link";
import { formatToman, rialToToman, toEnDigits, toFaDigits } from "@/lib/utils/format";
import { allowsFraction, formatQty, normalizeQty, unitLabel, type UnitKind } from "@/lib/units";
import { useOrgPrefs } from "@/lib/hooks/useOrgPrefs";
import { DatePicker } from "@/components/shared/date-picker";
import type { CartItem } from "@/types/db";
import {
  discountRialToPercent, lineDiscountRial, lineNetRial,
  marginPercent, percentFromPrice, priceFromPercent, saleFromMargin,
  type LineDiscountMode,
} from "@/lib/cart-pricing";

/* ------------------------------------------------------------------ */
/* نوار جستجو / ورود بارکد — مطابق مرجع step1                          */
/*                                                                     */
/* ⚠️ اسکن با دوربین موبایل پیاده‌سازی نشده است. این ورودی با           */
/* بارکدخوان فیزیکی (که مثل کیبورد تایپ می‌کند) کار می‌کند: پنل         */
/* ProductSelector خودکار فوکوس می‌گیرد و روی فیلد barcode جستجو        */
/* می‌کند. متن UI عمداً «ورود بارکد» است نه «اسکن»، تا قابلیتی که       */
/* وجود ندارد به کاربر وعده داده نشود.                                 */
/* ------------------------------------------------------------------ */

export function PosSearchBar({
  onOpenPicker,
  onOpenScanner,
  onOpenVoice,
  scanMiss,
  onDismissMiss,
}: {
  onOpenPicker: () => void;
  /** باز کردن اسکنر دوربین. اگر داده نشود، دکمه نمایش داده نمی‌شود. */
  onOpenScanner?: () => void;
  /**
   * باز کردن ورودی صوتی.
   * اگر مرورگر تشخیص گفتار نداشته باشد پاس داده نمی‌شود و دکمه
   * اصلاً رندر نمی‌شود — بهتر از دکمه‌ای که کلیک شود و کار نکند.
   */
  onOpenVoice?: () => void;
  /** بارکدی که اسکن شد ولی کالایی با آن پیدا نشد. */
  scanMiss?: string | null;
  onDismissMiss?: () => void;
}) {
  return (
    <Card className="p-3 sm:p-4">
      <p className="mb-2 text-xs font-bold text-muted-foreground">جستجوی کالا یا ورود بارکد</p>
      {/*
        سه عنصر (نوار جستجو + اسکن + افزودن سریع) در پنل ۵۶۰px کنار هم
        جا نمی‌شوند و دکمه‌ی اسکن از لبه بیرون می‌زد.
        نوار جستجو خط اول را کامل می‌گیرد و دکمه‌ها زیرش می‌آیند.
      */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onOpenPicker}
          className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border border-input bg-background px-3.5 text-right text-sm text-muted-foreground transition hover:border-primary/40 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <Barcode size={18} className="shrink-0 text-muted-foreground" />
          <span className="truncate">نام کالا، کد کالا یا بارکد را وارد کنید (سازگار با بارکدخوان)</span>
        </button>

        <div className="flex gap-2">
          {onOpenScanner && (
            <Button
              variant="secondary"
              onClick={onOpenScanner}
              icon={<ScanLine size={17} />}
              className="flex-1"
              aria-label="اسکن بارکد با دوربین"
            >
              اسکن با دوربین
            </Button>
          )}

          {onOpenVoice && (
            <Button
              variant="secondary"
              onClick={onOpenVoice}
              icon={<Mic size={17} />}
              className="flex-1"
              aria-label="افزودن کالا با صدا"
            >
              افزودن با صدا
            </Button>
          )}

          <Button onClick={onOpenPicker} icon={<Package size={17} />} className="flex-1">
            افزودن سریع
          </Button>
        </div>
      </div>

      {/*
        بارکد خوانده شد ولی کالایی نداشت.

        در داده‌ی واقعی فقط ۴ کالا از ۳۸۵ بارکد دارند، پس این حالت
        نادر نیست و باید راه خروج روشنی داشته باشد — نه یک پیام
        بن‌بست.
      */}
      {scanMiss && (
        <div
          role="status"
          className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-warning-soft px-3 py-2 text-xs text-warning-onSoft"
        >
          <span>
            کالایی با بارکد <span dir="ltr" className="font-bold tabular-nums">{scanMiss}</span> پیدا نشد.
          </span>
          <span className="flex gap-2">
            <button type="button" onClick={onOpenPicker} className="font-bold underline underline-offset-2">
              جستجوی دستی
            </button>
            {onDismissMiss && (
              <button type="button" onClick={onDismissMiss} className="font-bold underline underline-offset-2">
                بستن
              </button>
            )}
          </span>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* کارت انتخاب مشتری — مطابق مرجع step1/step2                          */
/* ------------------------------------------------------------------ */

export function PosCustomerCard({
  customer,
  walletCredit,
  onPick,
  onClear,
  variant = "sale",
}: {
  customer: { id: string; name: string; phone?: string | null } | null;
  walletCredit?: number | null;
  onPick: () => void;
  onClear: () => void;
  /** در خرید، طرف حساب تأمین‌کننده است نه مشتری. */
  variant?: "sale" | "purchase";
}) {
  /*
    واحد پول سازمان. این کامپوننت مشترک است بین فاکتور فروش و
    خرید، پس hook در خودش صدا زده می‌شود نه از بالا پاس داده —
    وگرنه هر مصرف‌کننده باید یادش بماند آن را بفرستد.
  */
  const { money, unitLabel: unitWord } = useOrgPrefs();
  const isPurchase = variant === "purchase";
  return (
    <Card className="p-3 sm:p-4">
      <div className="mb-3 flex items-center gap-2">
        <Users size={16} className="text-primary" />
        <h2 className="text-sm font-extrabold text-foreground">{isPurchase ? "انتخاب تأمین‌کننده" : "انتخاب مشتری"}</h2>
      </div>

      {customer ? (
        <div className="rounded-2xl border border-primary/20 bg-primary/[0.05] p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-foreground">{customer.name}</div>
              {customer.phone && <PhoneLink phone={customer.phone} className="text-xs" />}
            </div>
            <button
              type="button"
              onClick={onClear}
              aria-label={isPurchase ? "حذف تأمین‌کننده" : "حذف مشتری"}
              className="shrink-0 rounded-lg p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
            >
              <X size={16} />
            </button>
          </div>
          {typeof walletCredit === "number" && walletCredit > 0 && (
            <div className="mt-2 text-xs text-muted-foreground">
              اعتبار کیف پول: <span className="font-bold tabular-nums text-primary">{money(walletCredit)}</span>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={onPick}
          className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-dashed border-input px-3.5 text-sm text-muted-foreground transition hover:border-primary/40 hover:text-primary focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <UserPlus size={17} />
          {isPurchase ? "جستجوی تأمین‌کننده یا شماره تماس" : "جستجوی مشتری یا شماره تماس"}
        </button>
      )}
    </Card>
  );
}

/**
 * درصد سود با دکمه‌ی «اعمال».
 *
 * 🔴 چرا دکمه لازم بود (خواسته‌ی صریح کاربر):
 *   نسخه‌ی قبلی با هر بار تایپ، قیمت فروش را بازمحاسبه می‌کرد. برای
 *   رسیدن به «۳۰» کاربر اول «۳» را تایپ می‌کرد و قیمت فروش فوراً
 *   روی ۳٪ سود می‌پرید؛ بعد «۰» و دوباره پرش. عدد وسط راه، قیمت را
 *   خراب می‌کرد و کاربر نمی‌توانست عدد دورقمی وارد کند.
 *
 *   حالا عدد آزادانه تایپ می‌شود و فقط با زدن دکمه (یا Enter) روی
 *   قیمت فروش می‌نشیند — دقیقاً همان رفتاری که کاربر از نرم‌افزار
 *   قبلی‌اش توصیف کرد.
 */
function MarginInput({
  item,
  value,
  onApply,
}: {
  item: CartItem;
  value: number;
  onApply: (percent: number) => void;
}) {
  const [draft, setDraft] = React.useState<string | null>(null);

  /*
    وقتی کاربر در حال تایپ نیست، مقدار محاسبه‌شده نشان داده می‌شود.
    این یعنی تغییر قیمت خرید یا فروش از جای دیگر، درصد را خودکار
    به‌روز می‌کند.
  */
  const shown = draft ?? String(value);

  function commit() {
    if (draft === null) return;
    const pct = Number(toEnDigits(draft).replace(/[^\d-]/g, "")) || 0;
    onApply(pct);
    setDraft(null);
  }

  return (
    <div className="flex items-center gap-1">
      <input
        className={`input h-10 min-h-10 flex-1 text-center text-sm font-bold ${
          value >= 0 ? "text-success-onSoft" : "text-destructive-text"
        }`}
        inputMode="numeric"
        aria-label={`درصد سود ${item.product_name}`}
        value={shown}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        // ترک فیلد هم اعمال می‌کند تا کاربر مجبور به زدن دکمه نباشد.
        onBlur={commit}
      />
      <button
        type="button"
        onClick={commit}
        disabled={draft === null}
        aria-label={`اعمال درصد سود روی قیمت فروش ${item.product_name}`}
        title="اعمال درصد روی قیمت فروش"
        className="inline-flex h-10 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition hover:border-primary/40 hover:text-primary disabled:opacity-40"
      >
        <Percent size={14} aria-hidden />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* قیمت یک قلم — تومان یا درصدِ تغییر نسبت به قیمت پایه                 */
/* ------------------------------------------------------------------ */

/**
 * ورودی قیمت با کلید تعویض «تومان ⇄ درصد».
 *
 * خواسته‌ی کاربر: «قیمت رو هم بشه تغییر داد تو خرید و فروش مثل درصد
 * تخفیف». یعنی همان الگوی آشنای کادر تخفیف، این‌بار روی خود قیمت.
 *
 * سه نکته‌ی طراحی که هرکدام از یک اشتباه واقعی آمده:
 *
 *   ۱. مبنای درصد، `base_price` است نه قیمت فعلی. اگر قیمت فعلی مبنا
 *      بود، زدن «۱۰» دو بار می‌شد ۲۱٪ و بازگشت به قیمت اصلی غیرممکن.
 *
 *   ۲. در حالت درصد، مثل MarginInput از draft + دکمه‌ی اعمال استفاده
 *      می‌شود. اعمالِ لحظه‌ای هنگام تایپ باعث می‌شد کاربر برای رسیدن
 *      به «۳۰» اول روی «۳» بپرد و قیمت خراب شود. در حالت تومان
 *      این مشکل وجود ندارد (عدد همان چیزی است که تایپ می‌شود)، پس
 *      همان‌جا لحظه‌ای می‌ماند تا رفتار قبلی تغییر نکند.
 *
 *   ۳. عدد منفی در حالت درصد مجاز است: «۱۰-» یعنی ده درصد ارزان‌تر.
 */
function PriceInput({
  item,
  label,
  mode,
  onModeChange,
  onChange,
}: {
  item: CartItem;
  /** برای aria-label — «قیمت واحد» در فروش، «قیمت خرید» در خرید. */
  label: string;
  mode: LineDiscountMode;
  onModeChange: (mode: LineDiscountMode) => void;
  /** مقدار به **تومان** (رشته) داده می‌شود تا با onPriceChange موجود یکی باشد. */
  onChange: (tomanValue: string) => void;
}) {
  /* واحد پول سازمان — «تومان» یا «ریال» روی کلید تعویض. */
  const { unitLabel: unitWord } = useOrgPrefs();
  const isPercent = mode === "percent";
  const base = item.base_price ?? item.unit_price;
  const [draft, setDraft] = React.useState<string | null>(null);

  const computedPercent = percentFromPrice(base, item.unit_price);
  const shown = isPercent
    ? (draft ?? String(computedPercent))
    : String(rialToToman(item.unit_price));

  function commitPercent() {
    if (draft === null) return;
    // علامت منفی حفظ می‌شود؛ «۱۰-» یعنی تخفیف روی قیمت.
    const pct = Number(toEnDigits(draft).replace(/[^\d-]/g, "")) || 0;
    onChange(String(rialToToman(priceFromPercent(base, pct))));
    setDraft(null);
  }

  return (
    <div className="flex items-center gap-1">
      <input
        className="input h-10 min-h-10 flex-1 text-left text-sm tabular-nums"
        inputMode="numeric"
        aria-label={`${label} ${item.product_name}${isPercent ? " به درصد" : ` به ${unitWord}`}`}
        value={shown}
        onChange={(e) => {
          if (isPercent) setDraft(e.target.value);
          else onChange(e.target.value);
        }}
        onKeyDown={(e) => {
          if (isPercent && e.key === "Enter") {
            e.preventDefault();
            commitPercent();
          }
        }}
        onBlur={() => {
          if (isPercent) commitPercent();
        }}
      />
      <button
        type="button"
        onClick={() => {
          /*
            پیش از تعویض، هر عدد نیمه‌تایپ‌شده اعمال می‌شود؛ وگرنه
            کاربر عدد را می‌زند، دکمه را می‌زند و کارش بی‌صدا گم می‌شود.
          */
          if (isPercent) commitPercent();
          setDraft(null);
          onModeChange(isPercent ? "amount" : "percent");
        }}
        aria-label={`تغییر واحد ${label} ${item.product_name} — اکنون ${isPercent ? "درصد" : unitWord}`}
        title={
          isPercent
            ? `درصد نسبت به قیمت اصلی کالا — برای تغییر به ${unitWord} کلیک کنید`
            : `${unitWord} — برای تغییر به درصد کلیک کنید`
        }
        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-2xs font-extrabold transition ${
          isPercent
            ? "border-primary bg-primary/10 text-primary"
            : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
        }`}
      >
        {isPercent ? <Percent size={15} aria-hidden /> : unitWord}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* تخفیف یک قلم — مبلغ یا درصد                                         */
/* ------------------------------------------------------------------ */

/**
 * ورودی تخفیف هر قلم با کلید تعویض «تومان ⇄ درصد».
 *
 * چرا دکمه‌ی تعویض و نه دو کادر جدا؟
 *   کاربر توصیف کرد که در نرم‌افزار قبلی‌اش «عدد را می‌زد و یک دکمه
 *   کنارش آن را به درصد تبدیل می‌کرد». دو کادر جدا هم فضا می‌گیرد و
 *   هم این سؤال را می‌سازد که اگر هر دو پر شوند کدام برنده است.
 *
 * ⚠️ مقدار ذخیره‌شده در سبد **همیشه ریال** است. درصد فقط روش ورود
 * است، نه واحد نگهداری. اگر درصد را ذخیره می‌کردیم، تغییر بعدیِ
 * تعداد یا قیمت، تخفیف را بی‌صدا عوض می‌کرد.
 */
function LineDiscountInput({
  item,
  mode,
  onModeChange,
  onChange,
}: {
  item: CartItem;
  mode: LineDiscountMode;
  onModeChange: (mode: LineDiscountMode) => void;
  onChange: (discountRial: number) => void;
}) {
  /* واحد پول سازمان — «تومان» یا «ریال» روی کلید تعویض. */
  const { unitLabel: unitWord } = useOrgPrefs();
  const isPercent = mode === "percent";

  /*
    مقدار نمایشی از روی تخفیف ریالیِ ذخیره‌شده ساخته می‌شود، نه از یک
    state جدا. این یعنی هر جای دیگری هم تخفیف را عوض کند، کادر
    خودبه‌خود هماهنگ می‌ماند.
  */
  const shown = isPercent
    ? discountRialToPercent(item.unit_price, item.qty, item.discount)
    : rialToToman(item.discount);

  function apply(raw: string) {
    const n = Number(toEnDigits(raw).replace(/[^\d]/g, "")) || 0;
    // در حالت مبلغ، ورودی تومان است و باید به ریال تبدیل شود.
    const value = isPercent ? n : n * 10;
    onChange(lineDiscountRial(item.unit_price, item.qty, mode, value));
  }

  return (
    <div className="flex items-center gap-1">
      <input
        className="input h-10 min-h-10 flex-1 text-left text-sm tabular-nums"
        inputMode="numeric"
        aria-label={`تخفیف ${item.product_name} به ${isPercent ? "درصد" : unitWord}`}
        value={String(shown === 0 ? "" : shown)}
        placeholder="۰"
        onChange={(e) => apply(e.target.value)}
      />
      <button
        type="button"
        onClick={() => onModeChange(isPercent ? "amount" : "percent")}
        aria-label={`تغییر واحد تخفیف ${item.product_name} — اکنون ${isPercent ? "درصد" : unitWord}`}
        title={isPercent ? `درصد — برای تغییر به ${unitWord} کلیک کنید` : `${unitWord} — برای تغییر به درصد کلیک کنید`}
        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-2xs font-extrabold transition ${
          isPercent
            ? "border-primary bg-primary/10 text-primary"
            : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
        }`}
      >
        {isPercent ? <Percent size={15} aria-hidden /> : unitWord}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* لیست اقلام فاکتور — جدول در دسکتاپ، کارت در موبایل                  */
/* ------------------------------------------------------------------ */

/**
 * فهرست اقلام سند.
 *
 * یک کامپوننت برای هر دو سند، نه دو کپی.
 *
 * تفاوت فروش و خرید فقط در دو ستون اضافه است: در خرید، فروشنده همان
 * لحظه که کالا را می‌خرد قیمت فروش و درصد سودش را هم تعیین می‌کند —
 * برای فروشگاه پوشاک این کار اصلی است، نه یک قابلیت جانبی.
 *
 * چرا prop اختیاری و نه کامپوننت جدا؟
 *   نسخه‌ی قبلی خرید یک کپی مستقل ۱۰۰ خطی داشت که چیدمان موبایلش با
 *   فروش فرق می‌کرد. همان چیزی که کاربر از آن شکایت داشت: «هردو یک کار
 *   انجام می‌دهند ولی ظاهر و فرمشان متفاوت است.»
 */
export function PosCartList({
  cart,
  onQtyChange,
  onPriceChange,
  onRemove,
  variant = "sale",
  onSalePriceChange,
  onDiscountChange,
  onBatchChange,
}: {
  cart: CartItem[];
  onQtyChange: (variantId: string, qty: number) => void;
  onPriceChange: (variantId: string, tomanValue: string) => void;
  onRemove: (variantId: string) => void;
  /** حالت خرید ستون‌های «قیمت فروش» و «سود٪» را اضافه می‌کند. */
  variant?: "sale" | "purchase";
  /** فقط در حالت خرید لازم است. */
  onSalePriceChange?: (variantId: string, tomanValue: string) => void;
  /**
   * سری ساخت و تاریخ انقضا — فقط در خرید.
   *
   * ⚠️ اگر داده نشود، ردیف بچ اصلاً رندر نمی‌شود. فروش و مرجوعی
   * بچ نمی‌گیرند: در فروش بچ باید از موجودی **انتخاب** شود نه
   * تایپ، و آن یک قابلیت جداست.
   */
  onBatchChange?: (variantId: string, patch: { lot_no?: string; expiry_date?: string }) => void;
  /**
   * تخفیف هر قلم (ریال). اگر داده نشود، ستون تخفیف رندر نمی‌شود —
   * سندهایی مثل مرجوعی که تخفیف سطری ندارند دست‌نخورده می‌مانند.
   */
  onDiscountChange?: (variantId: string, discountRial: number) => void;
}) {
  /*
    واحد پول سازمان. این کامپوننت مشترک است بین فاکتور فروش و
    خرید، پس hook در خودش صدا زده می‌شود نه از بالا پاس داده —
    وگرنه هر مصرف‌کننده باید یادش بماند آن را بفرستد.
  */
  const { money, unitLabel: unitWord } = useOrgPrefs();
  const isPurchase = variant === "purchase";
  const showDiscount = Boolean(onDiscountChange);

  /*
    حالت ورود تخفیف، به تفکیک هر سطر.

    چرا per-row و نه یک حالت سراسری؟ کاربر ممکن است روی یک کالا
    «۵۰ هزار تومان» تخفیف بدهد و روی دیگری «۱۰ درصد». تحمیل یک حالت
    به همه، او را مجبور می‌کرد خودش حساب کند.
  */
  const [discountModes, setDiscountModes] = React.useState<Record<string, LineDiscountMode>>({});
  const modeOf = (id: string): LineDiscountMode => discountModes[id] ?? "amount";

  /*
    حالت ورود *قیمت* هم به تفکیک سطر نگه داشته می‌شود، جدا از حالت
    تخفیف. یک کالا ممکن است قیمتش درصدی تنظیم شود و تخفیفش ریالی.
  */
  const [priceModes, setPriceModes] = React.useState<Record<string, LineDiscountMode>>({});
  const priceModeOf = (id: string): LineDiscountMode => priceModes[id] ?? "amount";

  /*
    در حالت خرید دو ستون بیشتر داریم. عرض نام کالا کم شده تا در پنل
    ۵۶۰ پیکسلی هم چیزی از لبه بیرون نزند.

    ستون تخفیف فقط وقتی اضافه می‌شود که واقعاً فعال باشد؛ وگرنه
    چیدمان سندهای بدون تخفیف بی‌دلیل فشرده می‌شد.

    عرض ستون قیمت‌ها ۱۰px زیاد شد چون حالا هرکدام یک دکمه‌ی ۴۰px
    تعویض واحد کنارشان دارند.
  */
  const gridCols = isPurchase
    ? showDiscount
      ? "grid-cols-[minmax(120px,1.2fr)_150px_110px_78px_100px_140px_minmax(96px,1fr)_44px]"
      : "grid-cols-[minmax(140px,1.5fr)_150px_110px_78px_110px_minmax(96px,1fr)_44px]"
    : showDiscount
      ? "grid-cols-[minmax(140px,2fr)_110px_170px_150px_minmax(100px,1fr)_44px]"
      : "grid-cols-[minmax(190px,2.2fr)_120px_170px_minmax(110px,1fr)_44px]";

  /** درصد سود بر مبنای قیمت خرید — از منبع مشترک lib/cart-pricing. */
  const marginOf = (item: CartItem) => marginPercent(item.unit_price, item.sale_price ?? 0);

  return (
    /*
      🔴 `pos-list-scope` یک container query مستقل روی خودِ فهرست است.

      قبلاً تصمیم «جدول یا کارت» به عرض *کل فرم* بسته بود؛ ولی فرم از
      ۸۶۰px به بعد دوستونی می‌شود و ۳۴۰px را به ستون کناری می‌دهد —
      یعنی همان لحظه که فرم پهن‌تر می‌شد، فهرست باریک‌تر می‌شد و جدول
      از لبه بیرون می‌زد (اندازه‌گیری: سرریز ۲۴۲px در فروش، ۳۲۲px در
      خرید). حالا مبنا عرض واقعی خودِ این عنصر است.
    */
    <Card className="pos-list-scope overflow-hidden">
      <div className="flex items-center justify-between gap-3 p-3 sm:p-4">
        <h2 className="text-sm font-extrabold text-foreground">{isPurchase ? "لیست اقلام خرید" : "لیست اقلام فاکتور"}</h2>
        <Badge tone={cart.length > 0 ? "primary" : "neutral"}>
          {toFaDigits(cart.length)} قلم کالا
        </Badge>
      </div>

      {cart.length === 0 ? (
        <div className="mx-3 mb-3 rounded-2xl border border-dashed border-border py-10 text-center sm:mx-4 sm:mb-4">
          <Package size={26} className="mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">هنوز کالایی انتخاب نشده است</p>
        </div>
      ) : (
        <div className="max-h-[46vh] overflow-y-auto px-3 pb-3 sm:px-4 sm:pb-4">
          {/* سربرگ جدول — فقط دسکتاپ، مطابق مرجع (نوار تیره) */}
          <div className={`pos-row-desktop${isPurchase ? " pos-row-purchase" : ""} sticky top-0 z-[1] ${gridCols} items-center gap-2 rounded-2xl bg-primary px-3 py-2.5 text-xs font-extrabold text-primary-foreground`}>
            <span>نام محصول</span>
            {isPurchase && <span>قیمت خرید</span>}
            {isPurchase && <span>قیمت فروش</span>}
            {isPurchase && <span className="text-center">سود٪</span>}
            <span className="text-center">تعداد</span>
            {!isPurchase && <span>قیمت واحد</span>}
            {showDiscount && <span className="text-center">تخفیف</span>}
            <span className="text-left">مجموع ({unitWord})</span>
            <span />
          </div>

          <ul className="divide-y divide-border">
            {cart.map((c) => (
              <li key={c.variant_id} className="py-3">
                {/* دسکتاپ */}
                <div className={`pos-row-desktop${isPurchase ? " pos-row-purchase" : ""} ${gridCols} items-center gap-2`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <EntityLink type="product" id={c.product_id} className="truncate text-sm font-bold">
                        {c.product_name}
                      </EntityLink>
                      <EntityActionMenu type="product" id={c.product_id} label={c.product_name} />
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">{c.variant_label || "ساده"}</div>
                  </div>

                  {isPurchase && (
                    <PriceInput
                      item={c}
                      label="قیمت خرید"
                      mode={priceModeOf(c.variant_id)}
                      onModeChange={(next) =>
                        setPriceModes((prev) => ({ ...prev, [c.variant_id]: next }))
                      }
                      onChange={(toman) => onPriceChange(c.variant_id, toman)}
                    />
                  )}
                  {isPurchase && (
                    <input
                      className="input h-10 min-h-10 text-left text-sm tabular-nums"
                      inputMode="numeric"
                      aria-label={`قیمت فروش ${c.product_name}`}
                      value={String(rialToToman(c.sale_price ?? 0))}
                      onChange={(e) => onSalePriceChange?.(c.variant_id, e.target.value)}
                    />
                  )}
                  {isPurchase && (
                    <MarginInput
                      item={c}
                      value={marginOf(c)}
                      onApply={(pct) =>
                        onSalePriceChange?.(
                          c.variant_id,
                          String(rialToToman(saleFromMargin(c.unit_price, pct)))
                        )
                      }
                    />
                  )}

                  <QtyStepper qty={c.qty} onChange={(n) => onQtyChange(c.variant_id, n)} unit={c.unit ?? "count"} label={c.unit && c.unit !== "count" ? unitLabel(c.unit, c.unit_label) : undefined} />

                  {!isPurchase && (
                    <PriceInput
                      item={c}
                      label="قیمت واحد"
                      mode={priceModeOf(c.variant_id)}
                      onModeChange={(next) =>
                        setPriceModes((prev) => ({ ...prev, [c.variant_id]: next }))
                      }
                      onChange={(toman) => onPriceChange(c.variant_id, toman)}
                    />
                  )}

                  {/*
                    تخفیف سطری حالا در خرید هم هست (ستون قبل از مجموع).
                    پیش‌تر فقط فروش داشت و کاربر مجبور بود تخفیف
                    تأمین‌کننده را دستی از قیمت خرید کم کند — یعنی
                    قیمت واقعی توافق‌شده در سند گم می‌شد.
                  */}
                  {showDiscount && (
                    <LineDiscountInput
                      item={c}
                      mode={modeOf(c.variant_id)}
                      onModeChange={(next) =>
                        setDiscountModes((prev) => ({ ...prev, [c.variant_id]: next }))
                      }
                      onChange={(rial) => onDiscountChange?.(c.variant_id, rial)}
                    />
                  )}

                  <div className="text-left text-sm font-black tabular-nums text-foreground">
                    {money(lineNetRial(c.unit_price, c.qty, c.discount), false)}
                  </div>

                  <button
                    type="button"
                    onClick={() => onRemove(c.variant_id)}
                    aria-label={`حذف ${c.product_name}`}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/*
                  🔴 سری ساخت و تاریخ انقضا — فقط در خرید.

                  اینجا و نه در یک پنجره‌ی جدا: کاربری که کارتن
                  شیر را ثبت می‌کند، تاریخ انقضا روی همان کارتن
                  جلوی چشمش است. هر کلیک اضافه یعنی احتمال بیشتر
                  که اصلاً واردش نکند و گزارش انقضا خالی بماند.
                */}
                {isPurchase && onBatchChange && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-border px-2 py-2">
                    <span className="text-2xs text-muted-foreground">سری ساخت</span>
                    <input
                      className="input h-9 min-h-9 w-28 text-xs"
                      placeholder="اختیاری"
                      aria-label={`سری ساخت ${c.product_name}`}
                      value={c.lot_no ?? ""}
                      onChange={(e) => onBatchChange(c.variant_id, { lot_no: e.target.value })}
                    />
                    <span className="text-2xs text-muted-foreground">انقضا</span>
                    <div className="w-36">
                      <DatePicker
                        value={c.expiry_date ?? ""}
                        onChange={(v) => onBatchChange(c.variant_id, { expiry_date: v })}
                      />
                    </div>
                  </div>
                )}

                {/* موبایل و تبلت — کارت، مطابق مرجع step2 */}
                <div className={`pos-row-mobile${isPurchase ? " pos-row-purchase" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <EntityLink type="product" id={c.product_id} className="truncate text-sm font-bold">
                        {c.product_name}
                      </EntityLink>
                      <div className="mt-0.5 text-xs text-muted-foreground">{c.variant_label || "ساده"}</div>
                      {/*
                        🔴 در خرید، قیمت پایین‌تر در کادر ویرایش می‌شود؛
                        نمایش دوباره‌اش اینجا فقط تکرار است. در فروش اما
                        این تنها جای دیدن قیمت بود — و فقط *دیدن*، نه
                        ویرایش. کاربر گزارش داد در موبایل نمی‌تواند قیمت
                        را عوض کند. حالا کادر واقعی زیرش آمده و این خط
                        فقط قیمت اصلی کالا را برای مقایسه نشان می‌دهد.
                      */}
                      {!isPurchase && (c.base_price ?? c.unit_price) !== c.unit_price && (
                        <div className="mt-1 text-2xs text-muted-foreground line-through tabular-nums">
                          {money(c.base_price ?? c.unit_price, false)} {unitWord}
                        </div>
                      )}
                      {isPurchase && (
                        <div className="mt-1 text-xs font-bold tabular-nums text-primary">
                          {money(c.unit_price, false)} {unitWord}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(c.variant_id)}
                      aria-label={`حذف ${c.product_name}`}
                      className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {/*
                    در موبایل، سه فیلد خرید زیر هم می‌آیند نه کنار هم.
                    نسخه‌ی قبلی خرید اینها را در گرید دوستونی می‌چید و
                    فیلدها در ۳۹۰px به‌هم می‌ریختند.
                  */}
                  {/*
                    قیمت واحد در فروشِ موبایل.
                    🔴 این کادر اصلاً وجود نداشت: در نسخه‌ی موبایل فقط
                    یک متن ثابت قیمت نشان داده می‌شد و کاربر هیچ راهی
                    برای تغییر قیمت نداشت — همان چیزی که گزارش کرد.
                  */}
                  {!isPurchase && (
                    <div className="mt-2.5">
                      <span className="mb-1 block text-2xs text-muted-foreground">قیمت واحد</span>
                      <PriceInput
                        item={c}
                        label="قیمت واحد"
                        mode={priceModeOf(c.variant_id)}
                        onModeChange={(next) =>
                          setPriceModes((prev) => ({ ...prev, [c.variant_id]: next }))
                        }
                        onChange={(toman) => onPriceChange(c.variant_id, toman)}
                      />
                    </div>
                  )}
                  {isPurchase && (
                    <div className="mt-2.5 space-y-2">
                      {/*
                        🔴 چیدمان از سه‌ستونه به «یک ردیف کامل + دو ستون»
                        تغییر کرد. کادر قیمت خرید حالا یک دکمه‌ی ۴۰px
                        تعویض واحد هم دارد؛ در یک‌سوم عرض ۳۹۰px برای خودِ
                        عدد کمتر از ۵۰px می‌ماند و رقم‌ها بریده می‌شدند.
                      */}
                      <label className="block">
                        <span className="mb-1 block text-2xs text-muted-foreground">قیمت خرید</span>
                        <PriceInput
                          item={c}
                          label="قیمت خرید"
                          mode={priceModeOf(c.variant_id)}
                          onModeChange={(next) =>
                            setPriceModes((prev) => ({ ...prev, [c.variant_id]: next }))
                          }
                          onChange={(toman) => onPriceChange(c.variant_id, toman)}
                        />
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="mb-1 block text-2xs text-muted-foreground">قیمت فروش</span>
                        <input
                          className="input h-10 min-h-10 text-left text-sm tabular-nums"
                          inputMode="numeric"
                          aria-label={`قیمت فروش ${c.product_name}`}
                          value={String(rialToToman(c.sale_price ?? 0))}
                          onChange={(e) => onSalePriceChange?.(c.variant_id, e.target.value)}
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-2xs text-muted-foreground">سود٪</span>
                        <MarginInput
                          item={c}
                          value={marginOf(c)}
                          onApply={(pct) =>
                            onSalePriceChange?.(
                              c.variant_id,
                              String(rialToToman(saleFromMargin(c.unit_price, pct)))
                            )
                          }
                        />
                      </label>
                      </div>
                    </div>
                  )}
                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <QtyStepper qty={c.qty} onChange={(n) => onQtyChange(c.variant_id, n)} unit={c.unit ?? "count"} label={c.unit && c.unit !== "count" ? unitLabel(c.unit, c.unit_label) : undefined} />
                    <strong className="text-sm font-black tabular-nums text-foreground">
                      {money(lineNetRial(c.unit_price, c.qty, c.discount), false)}
                    </strong>
                  </div>

                  {/* تخفیف هر قلم — موبایل (هم فروش، هم خرید) */}
                  {showDiscount && (
                    <div className="mt-2.5">
                      <span className="mb-1 block text-2xs text-muted-foreground">تخفیف این قلم</span>
                      <LineDiscountInput
                        item={c}
                        mode={modeOf(c.variant_id)}
                        onModeChange={(next) =>
                          setDiscountModes((prev) => ({ ...prev, [c.variant_id]: next }))
                        }
                        onChange={(rial) => onDiscountChange?.(c.variant_id, rial)}
                      />
                    </div>
                  )}
                </div>

                {/*
                  هشدار موجودی فقط در فروش معنا دارد. در خرید، موجودی
                  قرار است *زیاد* شود؛ نمایش «موجودی کافی نیست» آنجا
                  فقط کاربر را می‌ترساند.
                */}
                {!isPurchase && c.qty > c.stock_qty && (
                  <div className="mt-2 text-xs font-medium text-warning">
                    ⚠ موجودی کافی نیست (موجودی: {toFaDigits(c.stock_qty)})
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

/**
 * ورودی تعداد.
 *
 * 🔴 پیش از این فقط دو دکمه‌ی + و − بود و هیچ راهی برای **تایپ**
 * مقدار وجود نداشت. یعنی:
 *   • «۱٫۵ کیلو گوشت» اصلاً قابل ثبت نبود
 *   • «۲۴ عدد» یعنی بیست‌وچهار بار کلیک
 *
 * حالا کادر قابل تایپ است و برای کالای وزنی گام اعشاری دارد.
 */
function QtyStepper({
  qty,
  onChange,
  unit = "count",
  label,
}: {
  qty: number;
  onChange: (n: number) => void;
  unit?: UnitKind;
  /** برچسب واحد برای نمایش کنار کادر. */
  label?: string;
}) {
  const fractional = allowsFraction(unit);
  const step = fractional ? 0.25 : 1;

  /*
    متن در حالت ویرایش جدا از مقدار نگه داشته می‌شود.

    🔴 اگر مستقیم روی مقدار می‌نوشتیم، کاربر که می‌خواهد «۱٫۵» بزند
    به‌محض تایپ «۱٫» عددش به ۱ گرد می‌شد و ممیز پاک می‌شد — تایپ
    عدد اعشاری عملاً ناممکن بود.
  */
  const [draft, setDraft] = React.useState<string | null>(null);

  function commit(raw: string) {
    const parsed = Number(toEnDigits(raw).replace(/[^\d.-]/g, ""));
    setDraft(null);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      onChange(0);
      return;
    }
    onChange(normalizeQty(parsed, unit));
  }

  return (
    <div className="mx-auto flex items-center gap-1">
      <div className="flex h-10 items-center overflow-hidden rounded-xl border border-input bg-background">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, normalizeQty(qty - step, unit)))}
          aria-label="کم کردن تعداد"
          className="flex h-10 w-9 shrink-0 items-center justify-center text-muted-foreground transition hover:bg-muted"
        >
          −
        </button>
        <input
          type="text"
          inputMode={fractional ? "decimal" : "numeric"}
          aria-label="تعداد"
          value={draft ?? toFaDigits(formatQty(qty, unit))}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="h-10 w-14 border-0 bg-transparent text-center text-sm font-bold tabular-nums outline-none focus:ring-0"
        />
        <button
          type="button"
          onClick={() => onChange(normalizeQty(qty + step, unit))}
          aria-label="زیاد کردن تعداد"
          className="flex h-10 w-9 shrink-0 items-center justify-center text-muted-foreground transition hover:bg-muted"
        >
          +
        </button>
      </div>
      {label && <span className="shrink-0 text-2xs text-muted-foreground">{label}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* کارت جمع مبالغ — کارت تیره مطابق مرجع step1                         */
/* ------------------------------------------------------------------ */

export function PosSummaryCard({
  subtotal,
  discountRial,
  total,
  paidWalletRial,
  credit,
  children,
  variant = "sale",
}: {
  subtotal: number;
  discountRial: number;
  total: number;
  paidWalletRial: number;
  credit: number;
  children?: ReactNode;
  variant?: "sale" | "purchase";
}) {
  /*
    واحد پول سازمان. این کامپوننت‌ها مشترک‌اند بین فاکتور فروش و
    خرید، پس hook در خودشان صدا زده می‌شود نه از بالا پاس داده —
    وگرنه هر مصرف‌کننده باید یادش بماند آن را بفرستد.
  */
  const { money, unitLabel: unitWord } = useOrgPrefs();
  const isPurchase = variant === "purchase";
  return (
    <div className="rounded-[1.75rem] bg-primary p-4 text-primary-foreground shadow-sm sm:p-5">
      <SummaryRow label="جمع کل اقلام:" value={money(subtotal, false)} />
      {discountRial > 0 && (
        <SummaryRow label="مجموع تخفیف‌ها:" value={`(${money(discountRial, false)}−)`} />
      )}
      {paidWalletRial > 0 && (
        <SummaryRow label="پرداخت از اعتبار:" value={money(paidWalletRial, false)} />
      )}
      {credit > 0 && <SummaryRow label={isPurchase ? "بدهی به تأمین‌کننده:" : "باقیمانده (نسیه):"} value={money(credit, false)} />}

      <div className="mt-3 border-t border-primary-foreground/20 pt-3">
        <div className="text-xs text-primary-foreground/90">{isPurchase ? "جمع کل خرید:" : "مبلغ قابل پرداخت:"}</div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-2xl font-black tabular-nums sm:text-3xl">{money(total, false)}</span>
          <span className="text-xs text-primary-foreground/90">{unitWord}</span>
        </div>
      </div>

      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-primary-foreground/10 py-2 text-sm last:border-0">
      <span className="text-primary-foreground/90">{label}</span>
      <span className="font-bold tabular-nums">{value}</span>
    </div>
  );
}
