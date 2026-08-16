"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Receipt, Send } from "lucide-react";
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
 * فرم ساخت فاکتور فروش — منبع واحد حقیقت.
 *
 * پیش از این دو پیاده‌سازی جدا وجود داشت که مستقل نوشته شده بودند و
 * ظاهر و رفتار متفاوتی داشتند:
 *   • QuickSaleModal در app/(app)/dashboard/page.tsx  (۲۷۲ خط)
 *   • PosModal      در app/(app)/sales/page.tsx       (۳۹۹ خط)
 *
 * این کامپوننت از نسخه‌ی کامل‌تر (PosModal) گرفته شده — که ابرمجموعه‌ی
 * دیگری بود: علاوه بر همه‌ی امکانات داشبورد، لیست قیمت، مراحل موبایل و
 * انتخاب روش پرداخت هم داشت.
 *
 * عمداً «بدون پوسته» نوشته شده: خودش Modal یا PanelShell نمی‌سازد، فقط
 * محتوا را برمی‌گرداند. این‌طور می‌تواند داخل PanelShell بنشیند و
 * سربرگ/بستن را میزبان مدیریت کند.
 *
 * منطق داده هیچ تغییری نکرده: همان فراخوانی `create_sale` با همان
 * پارامترها، و همان `spend_customer_wallet` برای کیف پول.
 */
export function InvoiceCreateForm({
  onClose,
  onCreated,
  insidePanel = true,
}: {
  /** بستن پنل/پنجره‌ی میزبان. */
  onClose: () => void;
  /** پس از ثبت موفق صدا زده می‌شود تا میزبان کش را باطل کند. */
  onCreated?: (saleId: string) => void;
  /**
   * این فرم داخل یک پنل کشویی رندر می‌شود.
   *
   * 🔴 اگر true نباشد، باز کردن انتخابگر کالا/مشتری پنل میزبان را
   * می‌بندد و کل فاکتور نیمه‌کاره از بین می‌رود. پیش‌فرض true است
   * چون تنها مصرف‌کننده‌ی فعلی InvoicePanel است؛ اگر روزی این فرم
   * در صفحه‌ی مستقل استفاده شد، false پاس بدهید.
   */
  insidePanel?: boolean;
}) {
  const { orgId, branchId } = useOrg();
  const lookupBarcode = useBarcodeLookup(orgId);
  const qc = useQueryClient();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState<SelectableContact | null>(null);
  const [discount, setDiscount] = useState("0");
  const [discountType, setDiscountType] = useState<"fixed" | "percent">("fixed");
  const [paidCash, setPaidCash] = useState("");
  const [paidCard, setPaidCard] = useState("");
  const [paidWallet, setPaidWallet] = useState("");
  const [isCreditSale, setIsCreditSale] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [priceListId, setPriceListId] = useState("");
  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  /*
    پشتیبانی مرورگر بعد از mount سنجیده می‌شود تا رندر سرور و کلاینت
    یکی بماند؛ وگرنه hydration mismatch می‌دهد.
  */
  const [voiceReady, setVoiceReady] = useState(false);

  // کلید کش مشترک با ProductSelector است، پس کوئری اضافه‌ای نمی‌زند.
  /*
    کاتالوگ به‌محض آماده‌بودن قابلیت صدا پیش‌بارگذاری می‌شود، نه در
    لحظه‌ی باز شدن پنجره.

    🔴 اگر منتظر voiceOpen بمانیم، کاربر پنجره را باز می‌کند، حرف
    می‌زند، و چون فهرست هنوز خالی است «پیدا نشد» می‌گیرد — با اینکه
    کالا وجود دارد. (بازتولیدشده: «یک شلوارک لینن» → پیدا نشد.)

    کلید کش با ProductSelector مشترک است، پس این پیش‌بارگذاری هزینه‌ی
    اضافه ندارد؛ همان داده‌ای است که انتخابگر کالا هم لازم دارد.
  */
  const { data: allVariants } = useAllVariants(orgId, voiceReady);
  const [scanMiss, setScanMiss] = useState<string | null>(null);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  // فقط برای چیدمان موبایل/تبلت — در دسکتاپ هر دو بخش هم‌زمان دیده می‌شوند.
  const [step, setStep] = useState<"items" | "payment">("items");
  // روش پرداخت یک لایه‌ی بصری روی همان stateهای موجود است.
  const [payMethod, setPayMethod] = useState<PayMethod>("cash");

  const { data: accounts } = useQuery({
    queryKey: ["sale-accounts", orgId],
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

  const { data: priceLists } = useQuery({
    queryKey: ["sale-price-lists", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("price_lists")
        .select("id,name,discount_percent,type")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const selectedPriceList = priceLists?.find((list: { id: string }) => list.id === priceListId) ?? null;

  const { data: priceListItems } = useQuery({
    queryKey: ["sale-price-list-items", priceListId],
    enabled: !!priceListId,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("price_list_items")
        .select("variant_id,price")
        .eq("price_list_id", priceListId);
      return data ?? [];
    },
  });

  function priceForVariant(v: SelectableVariant) {
    const explicit = priceListItems?.find((item: { variant_id: string }) => item.variant_id === v.variant_id)?.price;
    if (typeof explicit === "number") return explicit;
    const percent = Number((selectedPriceList as { discount_percent?: number } | null)?.discount_percent ?? 0);
    return Math.max(0, Math.round((v.sale_price * (100 - percent)) / 100));
  }

  /*
    🔴 سطح قیمت پیش‌فرض مشتری.

    پیش از این کاربر باید **هر بار** لیست قیمت را دستی انتخاب می‌کرد.
    برای فروشنده‌ای که نیمی از مشتریانش عمده‌فروش‌اند، این یعنی خطای
    انسانی روزانه: یک بار یادش می‌رود و کالا را به قیمت خرده‌فروشی
    به عمده‌فروش می‌فروشد.

    ⚠️ فقط وقتی اعمال می‌شود که کاربر خودش لیستی انتخاب نکرده باشد.
    اگر دستی چیزی گذاشته، انتخاب او برنده است — وگرنه سیستم روی دست
    کاربر می‌زند و آن بدترین نوع «هوشمندی» است.
  */
  const { data: customerPriceList } = useQuery({
    queryKey: ["customer-default-price-list", customer?.id],
    enabled: !!customer?.id,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("contacts")
        .select("meta")
        .eq("id", customer!.id)
        .maybeSingle();
      const id = (data?.meta as { price_list_id?: string } | null)?.price_list_id;
      return typeof id === "string" && id.length > 0 ? id : null;
    },
  });

  useEffect(() => {
    if (!customerPriceList) return;
    // سبد از قبل پر است؟ قیمت‌های واردشده را دست نمی‌زنیم.
    setPriceListId((current) => (current === "" ? customerPriceList : current));
  }, [customerPriceList]);

  const { data: walletCredit } = useQuery({
    queryKey: ["customer-wallet", customer?.id],
    enabled: !!customer?.id,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase.from("contacts").select("meta").eq("id", customer!.id).maybeSingle();
      return Number((data?.meta as { wallet_credit?: number } | null)?.wallet_credit ?? 0) || 0;
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
          unit_price: priceForVariant(v),
          /*
            مبنای حالت درصدیِ تغییر قیمت.
            عمداً priceForVariant است نه v.sale_price: اگر مشتری روی
            «لیست قیمت عمده» باشد، «۱۰٪ بیشتر» باید نسبت به قیمت عمده
            حساب شود نه قیمت خرده‌فروشی.
          */
          base_price: priceForVariant(v),
          discount: 0,
          cost_price: v.purchase_price,
          stock_qty: v.stock_qty,
        },
      ];
    });
    // پنجره باز می‌ماند تا کاربر چند کالا پشت‌سرهم اضافه کند
  }

  /**
   * بارکد خوانده‌شده را به کالا تبدیل و به فاکتور اضافه می‌کند.
   *
   * اگر پیدا نشد، اسکنر بسته نمی‌شود؛ فقط پیام می‌دهد تا فروشنده
   * بتواند کالای بعدی را اسکن کند یا خودش دستی جستجو کند.
   */
  useEffect(() => {
    setVoiceReady(isVoiceSupported());
  }, []);

  /** کالای انتخاب‌شده از فهرست صوتی را با تعداد گفته‌شده اضافه می‌کند. */
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
        // همان قاعده‌ی بالا: کم‌کردن تعداد نباید تخفیف را از مبلغ سطر بزرگ‌تر کند.
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
        /*
          🔴 تخفیف پس از تغییر قیمت دوباره محدود می‌شود.
          بدون این، اگر کاربر اول ۵۰٬۰۰۰ تومان تخفیف می‌داد و بعد
          قیمت را به ۳۰٬۰۰۰ کم می‌کرد، مبلغ سطر منفی می‌شد.
        */
        const discount = Math.min(c.discount, Math.max(0, rial) * c.qty);
        return { ...c, unit_price: rial, discount };
      })
    );
  }

  /** تخفیف یک قلم (ریال). محاسبه و محدودسازی در lib/cart-pricing انجام شده. */
  function updateLineDiscount(id: string, discountRial: number) {
    setCart((p) => p.map((c) => (c.variant_id === id ? { ...c, discount: discountRial } : c)));
  }

  const subtotal = useMemo(
    () => cart.reduce((s, c) => s + lineNetRial(c.unit_price, c.qty, c.discount), 0),
    [cart]
  );
  const discountInput = Number(toEnDigits(discount)) || 0;
  const discountRial = discountType === "percent" ? Math.round((subtotal * discountInput) / 100) : tomanToRial(discountInput);
  const total = Math.max(0, subtotal - discountRial);
  const paidCashRial = tomanToRial(Number(toEnDigits(paidCash)) || 0);
  const paidCardRial = tomanToRial(Number(toEnDigits(paidCard)) || 0);
  const requestedWalletRial = tomanToRial(Number(toEnDigits(paidWallet)) || 0);
  const paidWalletRial = Math.min(requestedWalletRial, walletCredit ?? 0, Math.max(0, total - paidCashRial - paidCardRial));
  const credit = Math.max(0, total - paidCashRial - paidCardRial - paidWalletRial);

  useEffect(() => {
    if (!isCreditSale) {
      setPaidCash(String(rialToToman(total)));
      setPaidCard("");
      setPaidWallet("");
    }
  }, [isCreditSale, total]);

  /**
   * انتخاب روش پرداخت — فقط همان stateهای موجود را ست می‌کند.
   *   نقدی     → isCreditSale=false ⇒ effect موجود مبلغ را در paidCash می‌گذارد
   *   کارتخوان → کل مبلغ در paidCard، نقدی صفر
   *   چک/امانی → همان حالت نسیه‌ی قبلی
   */
  function selectPayMethod(m: PayMethod) {
    setPayMethod(m);
    if (m === "cash") {
      setIsCreditSale(false);
      setPaidCard("");
    } else if (m === "card") {
      setIsCreditSale(true);
      setPaidCash("");
      setPaidCard(String(rialToToman(total)));
    } else {
      setIsCreditSale(true);
      setPaidCash("");
      setPaidCard("");
    }
  }

  function resetForNextSale() {
    setCart([]);
    setCustomer(null);
    setDiscount("0");
    setDiscountType("fixed");
    setPaidCash("");
    setPaidCard("");
    setPaidWallet("");
    setIsCreditSale(false);
    setAccountId("");
    setPriceListId("");
    setStep("items");
    setPayMethod("cash");
    setSaving(false);
    setError(null);
    setDone(null);
  }

  async function handleSubmit() {
    setError(null);
    if (cart.length === 0) {
      setError("سبد فروش خالی است.");
      return;
    }
    if (credit > 0 && !customer) {
      setError("برای فروش نسیه باید مشتری انتخاب کنید.");
      return;
    }
    if (!orgId) return;
    setSaving(true);
    const supabase = createClient();
    try {
      const { data, error: e } = await supabase.rpc("create_sale", {
        p_org: orgId,
        p_branch: branchId,
        p_customer: customer?.id || null,
        p_date: saleDate ? new Date(`${saleDate}T12:00:00`).toISOString() : new Date().toISOString(),
        p_items: cart.map((c) => ({
          variant_id: c.variant_id,
          qty: c.qty,
          unit_price: c.unit_price,
          discount: c.discount,
          cost_price: c.cost_price,
        })),
        p_discount: discountRial,
        p_discount_type: discountType,
        p_discount_value: discountType === "percent" ? discountInput : discountRial,
        p_tax: 0,
        p_paid_cash: paidCashRial,
        p_paid_card: paidCardRial,
        p_paid_credit: credit,
        p_account: accountId || null,
        p_note: null,
      });
      if (e) throw e;
      if (paidWalletRial > 0 && customer?.id) {
        const { error: walletError } = await supabase.rpc("spend_customer_wallet", {
          p_contact: customer.id,
          p_sale: data as string,
          p_amount: paidWalletRial,
          p_note: "پرداخت از اعتبار کیف پول در فاکتور فروش",
        });
        if (walletError) throw walletError;
      }
      await logActivity({
        orgId,
        action: "create",
        entityType: "sale",
        entityId: data as string,
        newData: { total, customer_id: customer?.id ?? null, items_count: cart.length },
      });
      /*
        ابطال کش اینجا انجام می‌شود نه در صفحه‌ی میزبان، چون این فرم از
        چند مسیر باز می‌شود و هر میزبان نباید یادش بماند این کار را بکند.
      */
      qc.invalidateQueries({ queryKey: ["sales-list"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      qc.invalidateQueries({ queryKey: ["sales-chart-30d"] });
      setDone(data as string);
      onCreated?.(data as string);
    } catch (e) {
      setError("خطا در ثبت فروش: " + (e as Error).message);
      setSaving(false);
    }
  }

  /* ─── صفحه‌ی موفقیت ─── */
  if (done) {
    return (
      <div className="py-6 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success">
          <Receipt size={30} />
        </div>
        <h3 className="text-lg font-bold text-foreground">فاکتور با موفقیت ثبت شد ✅</h3>
        <p className="mt-2 text-sm text-muted-foreground">مبلغ کل: {formatToman(total)}</p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <Link href={`/sales/${done}`} className="btn-primary" onClick={onClose}>
            مشاهده و چاپ فاکتور
          </Link>
          <button
            type="button"
            disabled
            title="به‌زودی - نیاز به اتصال سرویس پیامک"
            className="btn-secondary cursor-not-allowed opacity-60"
          >
            <Send size={16} /> ارسال برای مشتری
          </button>
          <button onClick={resetForNextSale} className="btn-primary sm:col-span-2">
            فاکتور جدید
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
        {/*
          نوار مرحله‌ها وقتی ظرف باریک است دیده می‌شود.
          شرط با container query کنترل می‌شود نه بریک‌پوینت پنجره، چون
          این فرم هم در پنل ۵۶۰px رندر می‌شود هم می‌تواند تمام‌عرض باشد.
        */}
        <div className="invoice-steps-tabs mb-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStep("items")}
            aria-current={step === "items"}
            className={`min-h-11 flex-1 rounded-xl px-3 text-2xs font-bold transition ${
              step === "items" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            ۱. اقلام فاکتور
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
          {/* ستون اصلی: جستجو/بارکد + اقلام فاکتور */}
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
              onQtyChange={updateQty}
              onPriceChange={updatePrice}
              onDiscountChange={updateLineDiscount}
              onRemove={(id) => updateQty(id, 0)}
            />
          </div>

          {/* ستون کناری: مشتری، روش پرداخت، فیلدها و جمع مبالغ */}
          <div className={`space-y-4 ${step === "items" ? "hidden invoice-step-hidden" : ""}`}>
            <PosCustomerCard
              customer={customer}
              walletCredit={walletCredit}
              onPick={() => setCustomerPickerOpen(true)}
              onClear={() => setCustomer(null)}
            />

            <PosPaymentMethods active={payMethod} onSelect={selectPayMethod} />

            <PosInvoiceFields
              priceListId={priceListId}
              onPriceListChange={setPriceListId}
              priceLists={priceLists as never}
              saleDate={saleDate}
              onSaleDateChange={setSaleDate}
              accountId={accountId}
              onAccountChange={setAccountId}
              accounts={accounts}
              discount={discount}
              onDiscountChange={setDiscount}
              discountType={discountType}
              onDiscountTypeChange={setDiscountType}
              discountRial={discountRial}
            />

            {/* مبالغ دریافتی */}
            <Card className="space-y-3 p-3 sm:p-4">
              <Field label="دریافت نقدی (تومان)">
                <input
                  aria-label="دریافت نقدی به تومان"
                  className="input tabular-nums"
                  inputMode="numeric"
                  value={paidCash}
                  onChange={(e) => setPaidCash(e.target.value)}
                />
              </Field>
              <Field label="دریافت کارتی (تومان)">
                <input
                  aria-label="دریافت کارتی به تومان"
                  className="input tabular-nums"
                  inputMode="numeric"
                  value={paidCard}
                  onChange={(e) => setPaidCard(e.target.value)}
                />
              </Field>
              {customer && (
                <Field label="پرداخت از اعتبار مشتری (تومان)" hint={`اعتبار موجود: ${formatToman(walletCredit ?? 0)}`}>
                  <input
                    aria-label="پرداخت از اعتبار مشتری به تومان"
                    className="input tabular-nums"
                    inputMode="numeric"
                    value={paidWallet}
                    onChange={(e) => setPaidWallet(e.target.value)}
                  />
                </Field>
              )}
              <label className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-muted/60 px-3 text-sm text-foreground/80">
                <input type="checkbox" checked={isCreditSale} onChange={(e) => setIsCreditSale(e.target.checked)} />
                این فروش نسیه است / پرداخت خودکار نقدی را غیرفعال کن
              </label>
            </Card>

            {error && <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive-text">{error}</div>}

            <PosSummaryCard
              subtotal={subtotal}
              discountRial={discountRial}
              total={total}
              paidWalletRial={paidWalletRial}
              credit={credit}
            >
              <div className="flex gap-2">
                <Button
                  onClick={handleSubmit}
                  loading={saving}
                  icon={<Receipt size={17} />}
                  className="flex-1 bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                >
                  تایید و پرداخت
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
              <div className="text-2xs text-muted-foreground">مبلغ قابل پرداخت</div>
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
        priceMode="sale"
        ownedByPanel={insidePanel}
      />
      <ContactSelector
        open={customerPickerOpen}
        onClose={() => setCustomerPickerOpen(false)}
        onSelect={(c) => {
          setCustomer(c);
          setCustomerPickerOpen(false);
        }}
        filterType="customer"
        title="انتخاب مشتری"
        ownedByPanel={insidePanel}
      />
    </>
  );
}
