"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShoppingCart, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { Button, Card, Field } from "@/src/shared/ui";
import { PosCartList, PosCustomerCard, PosSearchBar, PosSummaryCard } from "@/app/(app)/sales/components/PosPieces";
import { PosInvoiceFields, PosPaymentMethods, type PayMethod } from "@/app/(app)/sales/components/PosPayment";
import { ProductSelector, type SelectableVariant } from "@/components/shared/product-selector";
import { ContactSelector, type SelectableContact } from "@/components/shared/contact-selector";
import { BarcodeScanner } from "@/components/shared/barcode-scanner";
import { useBarcodeLookup } from "@/lib/hooks/useBarcodeLookup";
import { VoiceOrder, isVoiceSupported } from "@/components/shared/voice-order";
import { useAllVariants } from "@/lib/hooks/useAllVariants";
import { formatToman, toEnDigits, rialToToman, tomanToRial } from "@/lib/utils/format";
import { lineNetRial } from "@/lib/cart-pricing";
import { logActivity } from "@/lib/utils/activity-log";
import type { CartItem } from "@/types/db";

/**
 * فرم ساخت فاکتور خرید — قرینه‌ی InvoiceCreateForm.
 *
 * چرا ساخته شد؟
 *   کاربر گزارش داد «پنجره‌ی خرید و مشتری جدید هم در همه‌جا مثل پنجره‌ی
 *   فروش جدید باشد». بررسی نشان داد خرید یک Modal محلی ۲۰۰ خطی داخل
 *   app/(app)/purchases/page.tsx داشت که:
 *     • بارکدخوان نداشت
 *     • ورود صوتی نداشت
 *     • انتخاب تاریخ نداشت (همیشه «الان» ثبت می‌شد، با اینکه
 *       create_purchase از قبل p_date را می‌پذیرفت)
 *     • تخفیف نداشت (باز هم RPC پشتیبانی می‌کرد)
 *     • تفکیک نقدی/کارتی نداشت
 *     • چیدمان موبایلش با فروش فرق داشت
 *     • و openDocument("purchase") پیام «از این مسیر ممکن نیست» می‌داد
 *
 * همان اجزای بصری فروش استفاده می‌شوند (PosCartList و…) با
 * `variant="purchase"`, نه کپی دوم — چون ریشه‌ی شکایت کاربر دقیقاً
 * وجود دو پیاده‌سازی موازی بود.
 *
 * تفاوت‌های عمدی با فروش:
 *   • هر قلم علاوه بر قیمت خرید، «قیمت فروش» و «سود٪» هم دارد.
 *     برای فروشگاه پوشاک این کار اصلی است: کالا را می‌خرد و همان لحظه
 *     قیمت ویترین را می‌گذارد.
 *   • لیست قیمت و کیف پول ندارد (مفاهیم سمت فروش‌اند).
 *   • هشدار «موجودی کافی نیست» ندارد؛ خرید موجودی را زیاد می‌کند.
 */
export function PurchaseCreateForm({
  onClose,
  onCreated,
  insidePanel = true,
}: {
  onClose: () => void;
  onCreated?: (purchaseId: string) => void;
  /**
   * 🔴 مثل فرم فروش: اگر false باشد، باز کردن انتخابگر کالا/تأمین‌کننده
   * پنل میزبان را می‌بندد و کل فاکتور نیمه‌کاره از بین می‌رود.
   */
  insidePanel?: boolean;
}) {
  const { orgId, branchId } = useOrg();
  const lookupBarcode = useBarcodeLookup(orgId);
  const qc = useQueryClient();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [supplier, setSupplier] = useState<SelectableContact | null>(null);
  const [discount, setDiscount] = useState("0");
  const [discountType, setDiscountType] = useState<"fixed" | "percent">("fixed");
  /*
    هزینه‌های جانبی: کرایه‌ی حمل، بسته‌بندی، باربری.

    🔴 پیش از این `p_extra_total: 0` ثابت بود — یعنی اصلاً نمی‌شد
    واردش کرد. و بدتر: حتی در فرم ویرایش که واردش می‌شد، فقط به جمع
    فاکتور اضافه می‌شد و روی قیمت تمام‌شده‌ی کالا نمی‌نشست، پس گزارش
    سود خوش‌بینانه‌تر از واقعیت بود.
  */
  const [extraCost, setExtraCost] = useState("");
  const [allocMode, setAllocMode] = useState<"by_value" | "by_qty">("by_value");
  const [paidCash, setPaidCash] = useState("");
  const [paidCard, setPaidCard] = useState("");
  const [isCreditPurchase, setIsCreditPurchase] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [supplierPickerOpen, setSupplierPickerOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceReady, setVoiceReady] = useState(false);
  const [scanMiss, setScanMiss] = useState<string | null>(null);
  const [step, setStep] = useState<"items" | "payment">("items");
  const [payMethod, setPayMethod] = useState<PayMethod>("cash");

  // پشتیبانی مرورگر بعد از mount سنجیده می‌شود تا hydration mismatch ندهد.
  useEffect(() => {
    setVoiceReady(isVoiceSupported());
  }, []);

  // کلید کش با ProductSelector مشترک است، پس کوئری اضافه‌ای نمی‌زند.
  const { data: allVariants } = useAllVariants(orgId, voiceReady);

  const { data: accounts } = useQuery({
    queryKey: ["purchase-accounts", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("accounts")
        .select("id, name, type")
        .eq("is_active", true)
        .order("name");
      return data ?? [];
    },
  });

  function addToCart(v: SelectableVariant) {
    setCart((prev) => {
      const existing = prev.find((c) => c.variant_id === v.variant_id);
      if (existing) {
        return prev.map((c) => (c.variant_id === v.variant_id ? { ...c, qty: c.qty + 1 } : c));
      }
      return [
        ...prev,
        {
          variant_id: v.variant_id,
          product_id: v.product_id,
          product_name: v.product_name,
          variant_label: [v.color, v.size].filter(Boolean).join(" / "),
          qty: 1,
          // در سند خرید، unit_price یعنی قیمت خرید.
          unit_price: v.purchase_price,
          // مبنای حالت درصدیِ تغییر قیمت — قیمت خریدِ ثبت‌شده در کارت کالا.
          base_price: v.purchase_price,
          discount: 0,
          cost_price: v.purchase_price,
          stock_qty: v.stock_qty,
          // واحد از کالا می‌آید تا سبد بداند مقدار اعشاری مجاز است یا نه.
          unit: v.unit,
          unit_label: v.unit_label,
          // قیمت فروش فعلی کالا پیش‌فرض می‌شود تا کاربر فقط در صورت
          // نیاز تغییرش دهد؛ خالی گذاشتنش یعنی سود منفی ۱۰۰٪ نشان دادن.
          sale_price: v.sale_price,
        },
      ];
    });
  }

  function handleVoiceConfirm(variant: SelectableVariant, count: number) {
    for (let i = 0; i < count; i++) addToCart(variant);
  }

  async function handleScan(code: string) {
    const found = await lookupBarcode(code);
    if (!found) {
      setScanMiss(code);
      return;
    }
    setScanMiss(null);
    addToCart(found);
  }

  function updateQty(id: string, qty: number) {
    if (qty < 1) {
      setCart((p) => p.filter((c) => c.variant_id !== id));
      return;
    }
    setCart((p) =>
      p.map((c) => {
        if (c.variant_id !== id) return c;
        // تخفیف نباید از مبلغ سطر بزرگ‌تر شود — همان قاعده‌ی فرم فروش.
        const discount = Math.min(c.discount, Math.max(0, c.unit_price) * qty);
        return { ...c, qty, discount };
      })
    );
  }

  function updatePrice(id: string, tomanValue: string) {
    const rial = tomanToRial(Number(toEnDigits(tomanValue)) || 0);
    setCart((p) =>
      p.map((c) => {
        if (c.variant_id !== id) return c;
        const discount = Math.min(c.discount, Math.max(0, rial) * c.qty);
        return { ...c, unit_price: rial, discount };
      })
    );
  }

  /** تخفیف یک قلم خرید (ریال). محاسبه در lib/cart-pricing انجام شده. */
  function updateLineDiscount(id: string, discountRial: number) {
    setCart((p) => p.map((c) => (c.variant_id === id ? { ...c, discount: discountRial } : c)));
  }

  function updateSalePrice(id: string, tomanValue: string) {
    const rial = tomanToRial(Number(toEnDigits(tomanValue)) || 0);
    setCart((p) => p.map((c) => (c.variant_id === id ? { ...c, sale_price: rial } : c)));
  }

  /*
    جمع اقلام **پس از** کسر تخفیف سطری — دقیقاً مثل فرم فروش و مثل
    create_purchase در دیتابیس. اگر اینجا خام جمع می‌زدیم، مبلغی که
    کاربر می‌بیند با مبلغی که ثبت می‌شود فرق می‌کرد.
  */
  const subtotal = useMemo(
    () => cart.reduce((s, c) => s + lineNetRial(c.unit_price, c.qty, c.discount), 0),
    [cart]
  );
  const discountInput = Number(toEnDigits(discount)) || 0;
  const discountRial = discountType === "percent" ? Math.round((subtotal * discountInput) / 100) : tomanToRial(discountInput);
  const extraRial = tomanToRial(Number(toEnDigits(extraCost)) || 0);
  // هزینه‌ی جانبی به جمع اضافه می‌شود، تخفیف کم — همان ترتیب create_purchase.
  const total = Math.max(0, subtotal + extraRial - discountRial);
  const paidCashRial = tomanToRial(Number(toEnDigits(paidCash)) || 0);
  const paidCardRial = tomanToRial(Number(toEnDigits(paidCard)) || 0);
  const credit = Math.max(0, total - paidCashRial - paidCardRial);

  /*
    پیش‌فرض: خرید نقدی و تسویه‌شده.

    همان رفتار فرم فروش. اگر کاربر «نسیه» را بزند، دست خودش باز
    می‌شود که مبلغ جزئی بگذارد.
  */
  useEffect(() => {
    if (!isCreditPurchase) {
      setPaidCash(String(rialToToman(total)));
      setPaidCard("");
    }
  }, [isCreditPurchase, total]);

  function selectPayMethod(method: PayMethod) {
    setPayMethod(method);
    if (method === "cash") {
      setIsCreditPurchase(false);
      setPaidCard("");
    } else if (method === "card") {
      setIsCreditPurchase(true);
      setPaidCash("");
      setPaidCard(String(rialToToman(total)));
    } else {
      // نسیه: هیچ پرداختی ثبت نمی‌شود و کل مبلغ بدهی می‌ماند.
      setIsCreditPurchase(true);
      setPaidCash("");
      setPaidCard("");
    }
  }

  function resetForNextPurchase() {
    setCart([]);
    setSupplier(null);
    setDiscount("0");
    setDiscountType("fixed");
    setExtraCost("");
    setAllocMode("by_value");
    setPaidCash("");
    setPaidCard("");
    setIsCreditPurchase(false);
    setAccountId("");
    setPurchaseDate(new Date().toISOString().slice(0, 10));
    setStep("items");
    setPayMethod("cash");
    setError(null);
    setDone(null);
  }

  async function handleSubmit() {
    setError(null);
    if (cart.length === 0) {
      setError("حداقل یک کالا اضافه کنید.");
      return;
    }
    if (!orgId) return;
    setSaving(true);
    const supabase = createClient();
    try {
      const { data: purchaseId, error: e } = await supabase.rpc("create_purchase", {
        p_org: orgId,
        p_branch: branchId,
        p_supplier: supplier?.id || null,
        /*
          sale_price داخل همین payload می‌رود.

          🔴 نسخه‌ی قبلی بعد از RPC یک update جداگانه روی
          product_variants می‌زد. آن کار هم تکراری بود (RPC خودش این
          کار را می‌کند) و هم بیرون از تراکنش: اگر شکست می‌خورد، خرید
          ثبت شده بود ولی قیمت فروش به‌روز نشده بود.
        */
        p_items: cart.map((c) => ({
          variant_id: c.variant_id,
          qty: c.qty,
          unit_price: c.unit_price,
          discount: c.discount,
          sale_price: c.sale_price ?? undefined,
          // روش سرشکن روی هر قلم می‌رود تا تابع بتواند سهمش را حساب کند.
          alloc: allocMode,
        })),
        p_extra_total: extraRial,
        p_discount: discountType === "percent" ? 0 : discountRial,
        p_tax: 0,
        // p_paid برای سازگاری پر می‌شود؛ تفکیک واقعی با دو پارامتر زیر است.
        p_paid: paidCashRial + paidCardRial,
        p_account: accountId || null,
        p_note: null,
        p_date: purchaseDate,
        p_discount_type: discountType,
        p_discount_value: discountType === "percent" ? discountInput : discountRial,
        p_paid_cash: paidCashRial,
        p_paid_card: paidCardRial,
      });
      if (e) throw e;

      await logActivity({
        orgId,
        action: "create",
        entityType: "purchase",
        entityId: purchaseId as string,
        newData: { total, supplier_id: supplier?.id ?? null, items_count: cart.length },
      });

      /*
        ابطال کش اینجا انجام می‌شود نه در صفحه‌ی میزبان، چون این فرم از
        چند مسیر باز می‌شود و هر میزبان نباید یادش بماند این کار را بکند.
      */
      qc.invalidateQueries({ queryKey: ["purchases-list"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["all-variants"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      qc.invalidateQueries({ queryKey: ["inventory-operation-movements"] });
      setDone(purchaseId as string);
      onCreated?.(purchaseId as string);
    } catch (e) {
      setError("خطا در ثبت خرید: " + (e as Error).message);
      setSaving(false);
    }
  }

  /* ─── صفحه‌ی موفقیت ─── */
  if (done) {
    return (
      <div className="py-6 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success">
          <ShoppingCart size={30} />
        </div>
        <h3 className="text-lg font-bold text-foreground">فاکتور خرید ثبت شد ✅</h3>
        <p className="mt-2 text-sm text-muted-foreground">مبلغ کل: {formatToman(total)}</p>
        <p className="mt-1 text-xs text-muted-foreground">موجودی کالاها افزایش یافت.</p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <Link href={`/purchases/${done}`} className="btn-primary" onClick={onClose}>
            مشاهده فاکتور خرید
          </Link>
          <button
            type="button"
            disabled
            title="به‌زودی - نیاز به اتصال سرویس پیامک"
            className="btn-secondary cursor-not-allowed opacity-60"
          >
            <Send size={16} /> ارسال برای تأمین‌کننده
          </button>
          <button onClick={resetForNextPurchase} className="btn-primary sm:col-span-2">
            خرید جدید
          </button>
          <button onClick={onClose} className="btn-secondary sm:col-span-2">
            بستن
          </button>
        </div>
      </div>
    );
  }

  /* ─── فرم اصلی ─── */
  return (
    <>
      <div className="invoice-form-scope flex min-h-0 flex-1 flex-col">
        {/* نوار مرحله‌ها — با container query، چون این فرم هم در پنل ۵۶۰px می‌نشیند هم تمام‌عرض */}
        <div className="invoice-steps-tabs mb-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStep("items")}
            aria-current={step === "items"}
            className={`min-h-11 flex-1 rounded-xl px-3 text-2xs font-bold transition ${
              step === "items" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            ۱. اقلام خرید
          </button>
          <button
            type="button"
            onClick={() => setStep("payment")}
            aria-current={step === "payment"}
            className={`min-h-11 flex-1 rounded-xl px-3 text-2xs font-bold transition ${
              step === "payment" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            ۲. پرداخت
          </button>
        </div>

        <div className="invoice-form-grid">
          {/* ستون اصلی: جستجو/بارکد/صدا + اقلام */}
          <div className={`space-y-4 ${step === "payment" ? "hidden invoice-step-hidden" : ""}`}>
            <PosSearchBar
              onOpenPicker={() => setProductPickerOpen(true)}
              onOpenScanner={() => setScannerOpen(true)}
              onOpenVoice={voiceReady ? () => setVoiceOpen(true) : undefined}
              scanMiss={scanMiss}
              onDismissMiss={() => setScanMiss(null)}
            />
            <PosCartList
              cart={cart}
              variant="purchase"
              onQtyChange={updateQty}
              onPriceChange={updatePrice}
              onSalePriceChange={updateSalePrice}
              onDiscountChange={updateLineDiscount}
              onRemove={(id) => updateQty(id, 0)}
            />
          </div>

          {/* ستون کناری: تأمین‌کننده، روش پرداخت، فیلدها و جمع */}
          <div className={`space-y-4 ${step === "items" ? "hidden invoice-step-hidden" : ""}`}>
            <PosCustomerCard
              variant="purchase"
              customer={supplier}
              onPick={() => setSupplierPickerOpen(true)}
              onClear={() => setSupplier(null)}
            />

            <PosPaymentMethods active={payMethod} onSelect={selectPayMethod} />

            <PosInvoiceFields
              variant="purchase"
              priceListId=""
              onPriceListChange={() => {}}
              priceLists={undefined}
              saleDate={purchaseDate}
              onSaleDateChange={setPurchaseDate}
              accountId={accountId}
              onAccountChange={setAccountId}
              accounts={accounts}
              discount={discount}
              onDiscountChange={setDiscount}
              discountType={discountType}
              onDiscountTypeChange={setDiscountType}
              discountRial={discountRial}
            />

            {/*
              هزینه‌های جانبی و روش سرشکن.

              چرا دو گزینه؟ هر دو در بازار رایج‌اند و انتخاب اشتباه،
              قیمت تمام‌شده را غلط می‌کند:
                • ارزش  → بیمه و کارمزد بانکی
                • تعداد → کرایه‌ی حمل (کامیون به تعداد کارتن کار دارد
                          نه به قیمتشان)
            */}
            <Card className="space-y-3 p-3 sm:p-4">
              <Field
                label="هزینه‌های جانبی (تومان)"
                hint="کرایه حمل، باربری، بسته‌بندی. روی قیمت تمام‌شده‌ی کالاها سرشکن می‌شود."
              >
                <input
                  aria-label="هزینه‌های جانبی به تومان"
                  className="input tabular-nums"
                  inputMode="numeric"
                  value={extraCost}
                  onChange={(e) => setExtraCost(e.target.value)}
                  placeholder="۰"
                />
              </Field>

              {extraRial > 0 && (
                <div>
                  <span className="mb-1.5 block text-2xs text-muted-foreground">روش سرشکن</span>
                  <div className="flex gap-2">
                    {([
                      { id: "by_value", label: "به نسبت ارزش" },
                      { id: "by_qty", label: "به نسبت تعداد" },
                    ] as const).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setAllocMode(m.id)}
                        aria-pressed={allocMode === m.id}
                        className={`min-h-11 flex-1 rounded-xl border px-3 text-2xs font-bold transition ${
                          allocMode === m.id
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-card text-muted-foreground hover:border-primary/40"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            <Card className="space-y-3 p-3 sm:p-4">
              <Field label="پرداخت نقدی (تومان)">
                <input
                  aria-label="پرداخت نقدی به تومان"
                  className="input tabular-nums"
                  inputMode="numeric"
                  value={paidCash}
                  onChange={(e) => setPaidCash(e.target.value)}
                />
              </Field>
              <Field label="پرداخت کارتی (تومان)">
                <input
                  aria-label="پرداخت کارتی به تومان"
                  className="input tabular-nums"
                  inputMode="numeric"
                  value={paidCard}
                  onChange={(e) => setPaidCard(e.target.value)}
                />
              </Field>
              <label className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-muted/60 px-3 text-sm text-foreground/80">
                <input
                  type="checkbox"
                  checked={isCreditPurchase}
                  onChange={(e) => setIsCreditPurchase(e.target.checked)}
                />
                این خرید نسیه است / پرداخت خودکار نقدی را غیرفعال کن
              </label>
            </Card>

            {error && <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive-text">{error}</div>}

            <PosSummaryCard
              variant="purchase"
              subtotal={subtotal}
              discountRial={discountRial}
              total={total}
              paidWalletRial={0}
              credit={credit}
            >
              <div className="flex gap-2">
                <Button
                  onClick={handleSubmit}
                  loading={saving}
                  icon={<ShoppingCart size={17} />}
                  className="flex-1 bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                >
                  ثبت خرید
                </Button>
                <Button variant="ghost" onClick={onClose} className="text-primary-foreground hover:bg-primary-foreground/10">
                  انصراف
                </Button>
              </div>
            </PosSummaryCard>
          </div>
        </div>

        {/*
          نوار چسبان پایین — راه اصلی رفتن به مرحله‌ی پرداخت.

          🔴 قبلاً `lg:hidden` بود و به عرض *پنجره* نگاه می‌کرد. روی
          لپ‌تاپ، پنجره پهن است ولی این فرم داخل پنل ۵۶۰px می‌نشیند و
          هرگز دوستونی نمی‌شود؛ پس هم این دکمه پنهان می‌شد و هم ستون
          پرداخت نبود. کاربر عملاً در بن‌بست می‌ماند.

          حالا `invoice-sticky-bar` است که با container query فقط
          وقتی پنهان می‌شود که فرم واقعاً دوستونی شده باشد.

          ⚠️ شرط مرحله با `&&` است نه کلاس `hidden`. اولین تلاشم
          `hidden` بود و کار نکرد: `.invoice-sticky-bar{display:block}`
          یک کلاس تکی است و بر `.hidden` تیلویند (که آن هم تکی است ولی
          زودتر در فایل می‌آید) غالب می‌شود. نتیجه اینکه نوار در مرحله‌ی
          پرداخت هم می‌ماند و روی دکمه‌ی ثبت می‌افتاد — در اسکرین‌شات
          دیده شد.
        */}
        {step !== "payment" && (
        <div className="invoice-sticky-bar sticky bottom-0 -mx-4 mt-3 border-t border-border bg-card px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-2xs text-muted-foreground">جمع کل خرید</div>
              <div className="truncate text-lg font-black tabular-nums text-foreground">
                {formatToman(total, false)} <span className="text-2xs font-normal text-muted-foreground">تومان</span>
              </div>
            </div>
            <Button onClick={() => setStep("payment")} disabled={cart.length === 0} className="shrink-0">
              ادامه به پرداخت
            </Button>
          </div>
        </div>
        )}
      </div>

      <VoiceOrder
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        variants={allVariants ?? []}
        onConfirm={handleVoiceConfirm}
      />

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => { setScannerOpen(false); setScanMiss(null); }}
        onDetected={handleScan}
      />

      <ProductSelector
        open={productPickerOpen}
        onClose={() => setProductPickerOpen(false)}
        onSelect={(v) => addToCart(v)}
        priceMode="purchase"
        ownedByPanel={insidePanel}
      />
      <ContactSelector
        open={supplierPickerOpen}
        onClose={() => setSupplierPickerOpen(false)}
        onSelect={(c) => {
          setSupplier(c);
          setSupplierPickerOpen(false);
        }}
        filterType="supplier"
        title="انتخاب تأمین‌کننده"
        ownedByPanel={insidePanel}
      />
    </>
  );
}
