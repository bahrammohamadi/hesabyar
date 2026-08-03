"use client";

import { useState, useMemo, type MouseEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { usePanelManager } from "@/src/core/panel-manager/panel-manager.store";
import { PageHeader, Spinner, EmptyState, Modal } from "@/components/shared/ui";
import { DateRangeFilter, EMPTY_RANGE, type DateRange } from "@/src/shared/ui";
import { DataTable, type Column } from "@/src/shared/ui";
import { ProductSelector, type SelectableVariant } from "@/components/shared/product-selector";
import { ContactSelector, type SelectableContact } from "@/components/shared/contact-selector";
import { QuantityStepper } from "@/components/shared/quantity-stepper";
import { EntityLink } from "@/components/shared/entity-link";
import { EntityActionMenu } from "@/components/shared/entity-action-menu";
import { formatToman, toFaDigits, toEnDigits, tomanToRial, rialToToman, toJalali } from "@/lib/utils/format";
import { Plus, Trash2, Loader2, Package, UserPlus, X } from "lucide-react";
import { logActivity } from "@/lib/utils/activity-log";
import Link from "next/link";

interface PItem {
  variant_id: string;
  product_id?: string | null;
  label: string;
  qty: number;
  unit_price: number; // ریال
  sale_price: number; // ریال
}

export default function PurchasesPage() {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const { openDocument } = usePanelManager();
  const [open, setOpen] = useState(false);

  const [range, setRange] = useState<DateRange>(EMPTY_RANGE);

  const { data: purchases, isLoading } = useQuery({
    // بازه در کلید کش تا تغییرش داده را دوباره از سرور بیاورد.
    queryKey: ["purchases-list", orgId, range.from, range.to],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      /*
        فیلتر سمت سرور، نه روی آرایه: کوئری limit دارد و فیلتر محلی
        فقط همان ردیف‌های آخر را می‌دید.
      */
      let query = supabase
        .from("purchases")
        .select("id, invoice_no, date, total, paid, supplier_id, supplier:contacts(name)")
        .order("date", { ascending: false })
        .limit(range.from || range.to ? 500 : 50);

      if (range.from) query = query.gte("date", range.from);
      if (range.to) query = query.lte("date", range.to);

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as {
        id: string;
        invoice_no: string;
        date: string;
        total: number;
        paid: number;
        supplier_id: string | null;
        supplier: { name: string } | null;
      }[];
    },
  });

  function openPurchase(id: string) {
    openDocument("purchase", id, { mode: "view", context: "workspace" });
  }

  function handlePurchaseRowClick(event: MouseEvent<HTMLElement>, id: string) {
    if (event.defaultPrevented) return;
    const href = `/purchases/${id}`;
    if (event.metaKey || event.ctrlKey) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    openPurchase(id);
  }

  function handlePurchaseRowAuxClick(event: MouseEvent<HTMLElement>, id: string) {
    if (event.button === 1) {
      event.preventDefault();
      window.open(`/purchases/${id}`, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div>
      <PageHeader
        title="خرید"
        subtitle="ثبت فاکتور خرید از تامین‌کننده‌ها"
        action={
          // برچسب زیر sm پنهان می‌شود، پس نام دسترس‌پذیر صریح لازم است.
          <button onClick={() => setOpen(true)} aria-label="خرید جدید" className="btn-primary">
            <Plus size={18} />
            <span className="hidden sm:inline">خرید جدید</span>
          </button>
        }
      />

      <div className="mb-4 rounded-2xl border border-border bg-card p-3.5 sm:p-4">
        <DateRangeFilter value={range} onChange={setRange} />
      </div>

      {isLoading ? (
        <Spinner />
      ) : !purchases || purchases.length === 0 ? (
        <EmptyState
          title="هنوز خریدی ثبت نشده"
          description="با ثبت فاکتور خرید، موجودی کالاها خودکار افزایش می‌یابد."
          action={
            <button onClick={() => setOpen(true)} className="btn-primary">
              <Plus size={18} /> خرید جدید
            </button>
          }
        />
      ) : (
        <DataTable
          rows={purchases}
          keyExtractor={(p) => p.id}
          className="bg-white/90"
          getRowProps={(p) => ({
            role: "link",
            tabIndex: 0,
            onClick: (event) => handlePurchaseRowClick(event, p.id),
            onAuxClick: (event) => handlePurchaseRowAuxClick(event, p.id),
            onKeyDown: (event) => { if (event.key === "Enter") openPurchase(p.id); },
            className: "cursor-pointer odd:bg-white even:bg-muted/60 hover:bg-primary/[0.06] hover:shadow-sm",
          })}
          columns={[
            {
              key: "invoice_no",
              header: "شماره",
              render: (p) => (
                <Link
                  href={`/purchases/${p.id}`}
                  className="font-medium text-primary hover:underline"
                  onClick={(event) => {
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) return;
                    event.preventDefault();
                    event.stopPropagation();
                    openPurchase(p.id);
                  }}
                >
                  {p.invoice_no}
                </Link>
              ),
            },
            { key: "date", header: "تاریخ", render: (p) => <span className="text-muted-foreground">{toJalali(p.date)}</span> },
            {
              key: "supplier",
              header: "تامین‌کننده",
              render: (p) => p.supplier_id ? (
                <div className="flex items-center gap-2">
                  <EntityLink type="contact" id={p.supplier_id}>{p.supplier?.name ?? "تامین‌کننده"}</EntityLink>
                  <span onClick={(event) => event.stopPropagation()}><EntityActionMenu type="contact" id={p.supplier_id} label={p.supplier?.name ?? "تامین‌کننده"} /></span>
                </div>
              ) : <span className="text-muted-foreground">—</span>,
            },
            { key: "total", header: "مبلغ", align: "left", render: (p) => <span className="font-semibold tabular-nums">{formatToman(p.total)}</span> },
            { key: "paid", header: "پرداخت‌شده", align: "left", render: (p) => <span className="tabular-nums">{formatToman(p.paid)}</span> },
          ] satisfies Column<(typeof purchases)[number]>[]}
        />
      )}

      {open && (
        <PurchaseModal
          orgId={orgId}
          onClose={() => {
            setOpen(false);
            qc.invalidateQueries({ queryKey: ["purchases-list"] });
            qc.invalidateQueries({ queryKey: ["products"] });
            qc.invalidateQueries({ queryKey: ["all-variants"] });
          }}
        />
      )}
    </div>
  );
}

function PurchaseModal({ orgId, onClose }: { orgId: string | null; onClose: () => void }) {
  const { branchId } = useOrg();
  const [items, setItems] = useState<PItem[]>([]);
  const [supplier, setSupplier] = useState<SelectableContact | null>(null);
  const [paid, setPaid] = useState("");
  const [accountId, setAccountId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [supplierPickerOpen, setSupplierPickerOpen] = useState(false);

  const { data: accounts } = useQuery({
    queryKey: ["purchase-accounts", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase.from("accounts").select("id, name").eq("is_active", true);
      return data ?? [];
    },
  });

  function addItem(v: SelectableVariant) {
    setItems((prev) => {
      if (prev.find((i) => i.variant_id === v.variant_id)) return prev;
      return [
        ...prev,
        {
          variant_id: v.variant_id,
          product_id: v.product_id,
          label: `${v.product_name} ${[v.color, v.size].filter(Boolean).join(" / ")}`.trim(),
          qty: 1,
          unit_price: v.purchase_price,
          sale_price: v.sale_price,
        },
      ];
    });
  }

  const total = useMemo(() => items.reduce((s, i) => s + i.unit_price * i.qty, 0), [items]);

  async function handleSave() {
    setError(null);
    if (items.length === 0) {
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
        p_items: items.map((i) => ({
          variant_id: i.variant_id,
          qty: i.qty,
          unit_price: i.unit_price,
        })),
        p_extra_total: 0,
        p_discount: 0,
        p_tax: 0,
        p_paid: tomanToRial(Number(toEnDigits(paid)) || 0),
        p_account: accountId || null,
        p_note: null,
      });
      if (e) throw e;
      await Promise.all(items.map((item) => supabase
        .from("product_variants")
        .update({ purchase_price: item.unit_price, sale_price: item.sale_price })
        .eq("id", item.variant_id)
      ));
      await logActivity({ orgId, action: "create", entityType: "purchase", entityId: purchaseId as string, newData: { total, supplier_id: supplier?.id ?? null, items_count: items.length } });
      onClose();
    } catch (e) {
      setError("خطا: " + (e as Error).message);
      setSaving(false);
    }
  }

  return (
    <>
      <Modal open onClose={onClose} title="خرید جدید" size="xl">
        <div className="space-y-4">
          {/* تامین‌کننده */}
          <div>
            <label className="label">تامین‌کننده</label>
            {supplier ? (
              <div className="flex items-center justify-between rounded-xl border border-border px-3.5 py-2.5">
                <span className="font-medium text-sm text-foreground">{supplier.name}</span>
                <button onClick={() => setSupplier(null)} className="text-muted-foreground hover:text-destructive">
                  <X size={18} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setSupplierPickerOpen(true)}
                className="w-full flex items-center gap-2 rounded-xl border border-dashed border-border px-3.5 py-2.5 text-sm text-muted-foreground hover:border-primary/30 hover:text-primary"
              >
                <UserPlus size={18} /> انتخاب تامین‌کننده
              </button>
            )}
          </div>

          <button
            onClick={() => setProductPickerOpen(true)}
            className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/20 bg-primary/[0.04] px-4 py-3 text-sm font-medium text-primary hover:bg-primary/[0.06]"
          >
            <Package size={18} /> افزودن کالا
          </button>

          {items.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-6 border border-dashed border-border rounded-xl">
              کالایی انتخاب نشده.
            </div>
          ) : (
            <div className="max-h-[42vh] overflow-y-auto rounded-2xl border border-border bg-white">
              <div className="hidden grid-cols-[minmax(220px,1.6fr)_120px_120px_88px_120px_120px_44px] gap-2 bg-muted px-3 py-2 text-xs font-bold text-muted-foreground md:grid">
                <span>کالا</span><span>قیمت خرید</span><span>قیمت فروش</span><span className="text-center">سود٪</span><span className="text-center">تعداد</span><span className="text-left">جمع خرید</span><span />
              </div>
              <div className="divide-y divide-border">
                {items.map((it, idx) => (
                  <div key={it.variant_id} className="p-3">
                    <div className="hidden grid-cols-[minmax(220px,1.6fr)_120px_120px_88px_120px_120px_44px] items-center gap-2 md:grid">
                      <div className="min-w-0"><span className="inline-flex min-w-0 items-center gap-2 text-sm font-semibold"><EntityLink type="product" id={it.product_id} className="truncate">{it.label}</EntityLink><EntityActionMenu type="product" id={it.product_id} label={it.label} /></span></div>
                      <input className="input h-10 min-h-10 text-left text-sm" inputMode="numeric" value={String(rialToToman(it.unit_price))} onChange={(e) => setItems((p) => p.map((x, i) => (i === idx ? { ...x, unit_price: tomanToRial(Number(toEnDigits(e.target.value)) || 0) } : x)))} />
                      <input className="input h-10 min-h-10 text-left text-sm" inputMode="numeric" value={String(rialToToman(it.sale_price))} onChange={(e) => setItems((p) => p.map((x, i) => (i === idx ? { ...x, sale_price: tomanToRial(Number(toEnDigits(e.target.value)) || 0) } : x)))} />
                      <input className={(it.sale_price - it.unit_price) >= 0 ? "input h-10 min-h-10 text-center text-xs font-bold text-success-onSoft" : "input h-10 min-h-10 text-center text-xs font-bold text-destructive-text"} inputMode="numeric" value={String(it.unit_price > 0 ? Math.round(((it.sale_price - it.unit_price) / it.unit_price) * 100) : 0)} onChange={(e) => setItems((p) => p.map((x, i) => (i === idx ? { ...x, sale_price: Math.round(x.unit_price * (1 + (Number(toEnDigits(e.target.value)) || 0) / 100)) } : x)))} />
                      <QuantityStepper value={it.qty} onChange={(qty) => setItems((p) => p.map((x, i) => (i === idx ? { ...x, qty } : x)))} />
                      <span className="text-left text-sm font-black text-foreground tabular-nums">{formatToman(it.unit_price * it.qty, false)}</span>
                      <button onClick={() => setItems((p) => p.filter((_, i) => i !== idx))} className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"><Trash2 size={16} /></button>
                    </div>
                    <div className="md:hidden"><div className="flex items-center justify-between gap-2"><EntityLink type="product" id={it.product_id} className="truncate text-sm font-semibold">{it.label}</EntityLink><button onClick={() => setItems((p) => p.filter((_, i) => i !== idx))} className="text-destructive"><Trash2 size={16} /></button></div><div className="mt-2 grid grid-cols-2 gap-2 text-sm"><div><span className="text-xs text-muted-foreground">خرید</span><input className="input h-10 min-h-10 text-left text-sm" inputMode="numeric" value={String(rialToToman(it.unit_price))} onChange={(e) => setItems((p) => p.map((x, i) => (i === idx ? { ...x, unit_price: tomanToRial(Number(toEnDigits(e.target.value)) || 0) } : x)))} /></div><div><span className="text-xs text-muted-foreground">فروش</span><input className="input h-10 min-h-10 text-left text-sm" inputMode="numeric" value={String(rialToToman(it.sale_price))} onChange={(e) => setItems((p) => p.map((x, i) => (i === idx ? { ...x, sale_price: tomanToRial(Number(toEnDigits(e.target.value)) || 0) } : x)))} /></div></div><div className="mt-2 flex items-center justify-between gap-2 text-sm"><label className="flex items-center gap-2"><span>سود٪</span><input className="input h-9 min-h-9 w-20 text-center text-xs" inputMode="numeric" value={String(it.unit_price > 0 ? Math.round(((it.sale_price - it.unit_price) / it.unit_price) * 100) : 0)} onChange={(e) => setItems((p) => p.map((x, i) => (i === idx ? { ...x, sale_price: Math.round(x.unit_price * (1 + (Number(toEnDigits(e.target.value)) || 0) / 100)) } : x)))} /></label><strong>{formatToman(it.unit_price * it.qty, false)}</strong></div></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-border pt-4">
            <div>
              <label className="label">مبلغ پرداختی (تومان)</label><input aria-label="مبلغ پرداختی (تومان)" className="input" inputMode="numeric" value={paid} onChange={(e) => setPaid(e.target.value)} />
            </div>
            <div>
              <label className="label">از حساب</label><select aria-label="از حساب" className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="">—</option>
                {accounts?.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-xl bg-muted p-4 flex justify-between font-bold text-foreground">
            <span>جمع کل خرید</span>
            <span>{formatToman(total)}</span>
          </div>

          {error && <div className="rounded-xl bg-destructive/10 text-destructive-text text-sm px-4 py-3">{error}</div>}

          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
              {saving && <Loader2 className="animate-spin" size={18} />}
              ثبت خرید
            </button>
            <button onClick={onClose} className="btn-secondary">انصراف</button>
          </div>
        </div>
      </Modal>

      <ProductSelector
        open={productPickerOpen}
        onClose={() => setProductPickerOpen(false)}
        onSelect={(v) => addItem(v)}
        priceMode="purchase"
      />
      <ContactSelector
        open={supplierPickerOpen}
        onClose={() => setSupplierPickerOpen(false)}
        onSelect={(c) => {
          setSupplier(c);
          setSupplierPickerOpen(false);
        }}
        filterType="supplier"
        title="انتخاب تامین‌کننده"
      />
    </>
  );
}
