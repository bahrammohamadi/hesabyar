"use client";

import { useEffect, useState, useMemo, type MouseEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { usePanelManager } from "@/src/core/panel-manager/panel-manager.store";
import { PageHeader, Spinner, Modal } from "@/components/shared/ui";
import { DatePicker } from "@/components/shared/date-picker";
import { DataTable, type Column, Button, Card, Field } from "@/src/shared/ui";
import { PosCartList, PosCustomerCard, PosSearchBar, PosSummaryCard } from "./components/PosPieces";
import { PosInvoiceFields, PosPaymentMethods, type PayMethod } from "./components/PosPayment";
import { ProductSelector, type SelectableVariant } from "@/components/shared/product-selector";
import { ContactSelector, type SelectableContact } from "@/components/shared/contact-selector";
import { EntityLink } from "@/components/shared/entity-link";
import { EntityActionMenu } from "@/components/shared/entity-action-menu";
import { PhoneLink } from "@/components/shared/phone-link";
import { formatToman, toFaDigits, toEnDigits, rialToToman, tomanToRial, toJalali } from "@/lib/utils/format";
import { Plus, Trash2, Receipt, Loader2, ShoppingCart, Package, UserPlus, X, Send } from "lucide-react";
import type { CartItem } from "@/types/db";
import { logActivity } from "@/lib/utils/activity-log";
import Link from "next/link";

export default function SalesPage() {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const { openDocument } = usePanelManager();
  const [posOpen, setPosOpen] = useState(false);

  const { data: sales, isLoading } = useQuery({
    queryKey: ["sales-list", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("sales")
        .select("id, invoice_no, date, total, paid_credit, status, customer_id, customer:contacts(name)")
        .order("date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as unknown as {
        id: string;
        invoice_no: string;
        date: string;
        total: number;
        paid_credit: number;
        status: string;
        customer_id: string | null;
        customer: { name: string } | null;
      }[];
    },
  });

  function openSale(id: string) {
    openDocument("sale", id, { mode: "view", context: "workspace" });
  }

  function handleSaleRowClick(event: MouseEvent<HTMLElement>, id: string) {
    if (event.defaultPrevented) return;
    const href = `/sales/${id}`;
    if (event.metaKey || event.ctrlKey) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    openSale(id);
  }

  function handleSaleRowAuxClick(event: MouseEvent<HTMLElement>, id: string) {
    if (event.button === 1) {
      event.preventDefault();
      window.open(`/sales/${id}`, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div>
      <PageHeader
        title="فروش"
        subtitle="صدور فاکتور و مدیریت فروش"
        action={
          <button onClick={() => setPosOpen(true)} className="btn-primary">
            <Plus size={18} />
            <span className="hidden sm:inline">فروش جدید</span>
          </button>
        }
      />

      {isLoading ? (
        <Spinner />
      ) : !sales || sales.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/[0.06] text-primary flex items-center justify-center mx-auto mb-4">
            <ShoppingCart size={26} />
          </div>
          <p className="font-semibold text-foreground">هنوز فروشی ثبت نشده</p>
          <p className="mt-1 text-sm text-muted-foreground">اولین فاکتور فروش خود را صادر کنید.</p>
          <button onClick={() => setPosOpen(true)} className="btn-primary mt-4 mx-auto">
            <Plus size={18} /> فروش جدید
          </button>
        </div>
      ) : (
        <DataTable
          rows={sales}
          keyExtractor={(s) => s.id}
          className="bg-white/90"
          getRowProps={(s) => ({
            role: "link",
            tabIndex: 0,
            onClick: (event) => handleSaleRowClick(event, s.id),
            onAuxClick: (event) => handleSaleRowAuxClick(event, s.id),
            onKeyDown: (event) => { if (event.key === "Enter") openSale(s.id); },
            className: "cursor-pointer odd:bg-card even:bg-muted/40 hover:bg-primary/[0.06] hover:shadow-sm",
          })}
          columns={[
            {
              key: "invoice_no",
              header: "شماره فاکتور",
              render: (s) => (
                <Link
                  href={`/sales/${s.id}`}
                  className="font-medium text-primary hover:underline"
                  onClick={(event) => {
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) return;
                    event.preventDefault();
                    event.stopPropagation();
                    openSale(s.id);
                  }}
                >
                  {s.invoice_no}
                </Link>
              ),
            },
            { key: "date", header: "تاریخ", render: (s) => <span className="tabular-nums text-muted-foreground">{toJalali(s.date)}</span> },
            {
              key: "customer",
              header: "مشتری",
              render: (s) => s.customer_id ? (
                <div className="flex items-center gap-2">
                  <EntityLink type="contact" id={s.customer_id}>{s.customer?.name ?? "مشتری"}</EntityLink>
                  <span onClick={(event) => event.stopPropagation()}><EntityActionMenu type="contact" id={s.customer_id} label={s.customer?.name ?? "مشتری"} /></span>
                </div>
              ) : <span className="text-muted-foreground">مشتری نقدی</span>,
            },
            { key: "total", header: "مبلغ", align: "left", render: (s) => <span className="font-semibold tabular-nums">{formatToman(s.total)}</span> },
            { key: "credit", header: "نسیه", render: (s) => s.paid_credit > 0 ? <span className="font-bold tabular-nums text-finance-debt">{formatToman(s.paid_credit, false)}</span> : <span className="text-muted-foreground">—</span> },
            { key: "status", header: "وضعیت", render: (s) => <span className="badge bg-info-soft text-info border border-info/20">{s.status === "settled" ? "تسویه‌شده" : s.status === "reversed" ? "برگشت‌خورده" : "ثبت‌شده"}</span> },
          ] satisfies Column<(typeof sales)[number]>[]}
        />
      )}

      {posOpen && (
        <PosModal
          orgId={orgId}
          onClose={() => {
            setPosOpen(false);
            qc.invalidateQueries({ queryKey: ["sales-list"] });
            qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
          }}
        />
      )}
    </div>
  );
}

function PosModal({ orgId, onClose }: { orgId: string | null; onClose: () => void }) {
  const { branchId } = useOrg();
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
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  // فقط برای چیدمان موبایل/تبلت — در دسکتاپ هر دو بخش هم‌زمان دیده می‌شوند.
  const [step, setStep] = useState<"items" | "payment">("items");
  // روش پرداخت یک لایه‌ی بصری روی همان stateهای موجود است؛ منطق پرداخت تغییر نکرده.
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
      const { data } = await supabase.from("price_lists").select("id,name,discount_percent,type").eq("is_active", true).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const selectedPriceList = priceLists?.find((list: any) => list.id === priceListId) ?? null;

  const { data: priceListItems } = useQuery({
    queryKey: ["sale-price-list-items", priceListId],
    enabled: !!priceListId,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase.from("price_list_items").select("variant_id,price").eq("price_list_id", priceListId);
      return data ?? [];
    },
  });

  function priceForVariant(v: SelectableVariant) {
    const explicit = priceListItems?.find((item: any) => item.variant_id === v.variant_id)?.price;
    if (typeof explicit === "number") return explicit;
    const percent = Number(selectedPriceList?.discount_percent ?? 0);
    return Math.max(0, Math.round(v.sale_price * (100 - percent) / 100));
  }

  const { data: walletCredit } = useQuery({
    queryKey: ["customer-wallet", customer?.id],
    enabled: !!customer?.id,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase.from("contacts").select("meta").eq("id", customer!.id).maybeSingle();
      return Number((data?.meta as any)?.wallet_credit ?? 0) || 0;
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
          discount: 0,
          cost_price: v.purchase_price,
          stock_qty: v.stock_qty,
        },
      ];
    });
    // پنجره باز می‌ماند تا کاربر چند کالا پشت‌سرهم اضافه کند
  }

  function updateQty(id: string, qty: number) {
    if (qty < 1) {
      setCart((p) => p.filter((c) => c.variant_id !== id));
      return;
    }
    setCart((p) => p.map((c) => (c.variant_id === id ? { ...c, qty } : c)));
  }

  function updatePrice(id: string, tomanValue: string) {
    const rial = tomanToRial(Number(toEnDigits(tomanValue)) || 0);
    setCart((p) => p.map((c) => (c.variant_id === id ? { ...c, unit_price: rial } : c)));
  }

  const subtotal = useMemo(() => cart.reduce((s, c) => s + c.unit_price * c.qty - c.discount, 0), [cart]);
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
   * هیچ منطق محاسباتی جدیدی اضافه نشده است:
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
      await logActivity({ orgId, action: "create", entityType: "sale", entityId: data as string, newData: { total, customer_id: customer?.id ?? null, items_count: cart.length } });
      setDone(data as string);
    } catch (e) {
      setError("خطا در ثبت فروش: " + (e as Error).message);
      setSaving(false);
    }
  }

  if (done) {
    return (
      <Modal open onClose={onClose} title="فروش ثبت شد">
        <div className="text-center py-6">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success">
            <Receipt size={30} />
          </div>
          <h3 className="text-lg font-bold text-foreground">فاکتور با موفقیت ثبت شد ✅</h3>
          <p className="mt-2 text-sm text-muted-foreground">مبلغ کل: {formatToman(total)}</p>
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <Link href={`/sales/${done}`} className="btn-primary">
              مشاهده و چاپ فاکتور
            </Link>
            <button type="button" disabled title="به‌زودی - نیاز به اتصال سرویس پیامک" className="btn-secondary cursor-not-allowed opacity-60">
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
      </Modal>
    );
  }

  return (
    <>
      <Modal open onClose={onClose} title="ثبت فاکتور فروش جدید" size="xl" mobileFullscreen>
        <div className="flex min-h-0 flex-1 flex-col">
          {/* مرحله‌ها فقط در موبایل/تبلت معنا دارند؛ در دسکتاپ هر دو ستون هم‌زمان دیده می‌شوند */}
          <div className="mb-3 flex items-center gap-2 lg:hidden">
            <button
              type="button"
              onClick={() => setStep("items")}
              aria-current={step === "items"}
              className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold transition ${step === "items" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              ۱. اقلام فاکتور
            </button>
            <button
              type="button"
              onClick={() => setStep("payment")}
              aria-current={step === "payment"}
              className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold transition ${step === "payment" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              ۲. پرداخت
            </button>
          </div>

          <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_340px] lg:overflow-visible">
            {/* ستون اصلی: جستجو/بارکد + اقلام فاکتور */}
            <div className={`space-y-4 ${step === "payment" ? "hidden lg:block" : ""}`}>
              <PosSearchBar onOpenPicker={() => setProductPickerOpen(true)} />
              <PosCartList
                cart={cart}
                onQtyChange={updateQty}
                onPriceChange={updatePrice}
                onRemove={(id) => updateQty(id, 0)}
              />
            </div>

            {/* ستون کناری: مشتری، روش پرداخت، فیلدها و جمع مبالغ */}
            <div className={`space-y-4 ${step === "items" ? "hidden lg:block" : ""}`}>
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
                priceLists={priceLists as any}
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

              {/* مبالغ دریافتی — همان فیلدهای قبلی، بدون تغییر در منطق */}
              <Card className="space-y-3 p-3 sm:p-4">
                <Field label="دریافت نقدی (تومان)">
                  <input className="input tabular-nums" inputMode="numeric" value={paidCash} onChange={(e) => setPaidCash(e.target.value)} />
                </Field>
                <Field label="دریافت کارتی (تومان)">
                  <input className="input tabular-nums" inputMode="numeric" value={paidCard} onChange={(e) => setPaidCard(e.target.value)} />
                </Field>
                {customer && (
                  <Field label="پرداخت از اعتبار مشتری (تومان)" hint={`اعتبار موجود: ${formatToman(walletCredit ?? 0)}`}>
                    <input className="input tabular-nums" inputMode="numeric" value={paidWallet} onChange={(e) => setPaidWallet(e.target.value)} />
                  </Field>
                )}
                <label className="flex items-center gap-2 rounded-xl border border-border bg-muted/60 px-3 py-2 text-sm text-foreground/80">
                  <input type="checkbox" checked={isCreditSale} onChange={(e) => setIsCreditSale(e.target.checked)} />
                  این فروش نسیه است / پرداخت خودکار نقدی را غیرفعال کن
                </label>
              </Card>

              {error && (
                <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
              )}

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

          {/* نوار چسبان موبایل — مطابق مرجع step2 */}
          <div className={`sticky bottom-0 -mx-5 mt-3 border-t border-border bg-card px-5 py-3 lg:hidden ${step === "payment" ? "hidden" : ""}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] text-muted-foreground">مبلغ قابل پرداخت</div>
                <div className="truncate text-lg font-black tabular-nums text-foreground">
                  {formatToman(total, false)} <span className="text-[11px] font-normal text-muted-foreground">تومان</span>
                </div>
              </div>
              <Button onClick={() => setStep("payment")} disabled={cart.length === 0} className="shrink-0">
                ادامه به پرداخت
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <ProductSelector
        open={productPickerOpen}
        onClose={() => setProductPickerOpen(false)}
        onSelect={(v) => addToCart(v)}
        priceMode="sale"
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
      />
    </>
  );
}
