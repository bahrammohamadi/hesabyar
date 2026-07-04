"use client";

import { useState, useMemo, type MouseEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { usePanelManager } from "@/src/core/panel-manager/panel-manager.store";
import { PageHeader, Spinner, EmptyState, Modal } from "@/components/shared/ui";
import { ProductSelector, type SelectableVariant } from "@/components/shared/product-selector";
import { ContactSelector, type SelectableContact } from "@/components/shared/contact-selector";
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
}

export default function PurchasesPage() {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const { openDocument } = usePanelManager();
  const [open, setOpen] = useState(false);

  const { data: purchases, isLoading } = useQuery({
    queryKey: ["purchases-list", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("purchases")
        .select("id, invoice_no, date, total, paid, supplier_id, supplier:contacts(name)")
        .order("date", { ascending: false })
        .limit(50);
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
          <button onClick={() => setOpen(true)} className="btn-primary">
            <Plus size={18} />
            <span className="hidden sm:inline">خرید جدید</span>
          </button>
        }
      />

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
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>شماره</th>
                <th>تاریخ</th>
                <th>تامین‌کننده</th>
                <th>مبلغ</th>
                <th>پرداخت‌شده</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr
                  key={p.id}
                  role="link"
                  tabIndex={0}
                  onClick={(event) => handlePurchaseRowClick(event, p.id)}
                  onAuxClick={(event) => handlePurchaseRowAuxClick(event, p.id)}
                  onKeyDown={(event) => { if (event.key === "Enter") openPurchase(p.id); }}
                  className="cursor-pointer odd:bg-white even:bg-slate-50/60 transition hover:bg-primary/[0.06] hover:shadow-sm"
                >
                  <td>
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
                  </td>
                  <td className="text-slate-500">{toJalali(p.date)}</td>
                  <td>
                    {p.supplier_id ? (
                      <div className="flex items-center gap-2">
                        <EntityLink type="contact" id={p.supplier_id}>{p.supplier?.name ?? "تامین‌کننده"}</EntityLink>
                        <span onClick={(event) => event.stopPropagation()}><EntityActionMenu type="contact" id={p.supplier_id} label={p.supplier?.name ?? "تامین‌کننده"} /></span>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="text-left font-semibold tabular-nums">{formatToman(p.total)}</td>
                  <td className="text-left tabular-nums">{formatToman(p.paid)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
      await logActivity({ orgId, action: "create", entityType: "purchase", entityId: purchaseId as string, newData: { total, supplier_id: supplier?.id ?? null, items_count: items.length } });
      onClose();
    } catch (e) {
      setError("خطا: " + (e as Error).message);
      setSaving(false);
    }
  }

  return (
    <>
      <Modal open onClose={onClose} title="خرید جدید" size="lg">
        <div className="space-y-4">
          {/* تامین‌کننده */}
          <div>
            <label className="label">تامین‌کننده</label>
            {supplier ? (
              <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3.5 py-2.5">
                <span className="font-medium text-sm text-slate-800">{supplier.name}</span>
                <button onClick={() => setSupplier(null)} className="text-slate-400 hover:text-rose-500">
                  <X size={18} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setSupplierPickerOpen(true)}
                className="w-full flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3.5 py-2.5 text-sm text-slate-500 hover:border-primary/30 hover:text-primary"
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
            <div className="text-center text-sm text-slate-400 py-6 border border-dashed border-slate-200 rounded-xl">
              کالایی انتخاب نشده.
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={it.variant_id} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex min-w-0 items-center gap-2 text-sm font-medium">
                      <EntityLink type="product" id={it.product_id} className="truncate">{it.label}</EntityLink>
                      <EntityActionMenu type="product" id={it.product_id} label={it.label} />
                    </span>
                    <button onClick={() => setItems((p) => p.filter((_, i) => i !== idx))} className="text-rose-400 p-1">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      className="input w-20 text-sm"
                      inputMode="numeric"
                      value={String(it.qty)}
                      onChange={(e) =>
                        setItems((p) => p.map((x, i) => (i === idx ? { ...x, qty: Number(toEnDigits(e.target.value)) || 0 } : x)))
                      }
                      placeholder="تعداد"
                    />
                    <input
                      className="input flex-1 text-sm"
                      inputMode="numeric"
                      value={String(rialToToman(it.unit_price))}
                      onChange={(e) =>
                        setItems((p) =>
                          p.map((x, i) => (i === idx ? { ...x, unit_price: tomanToRial(Number(toEnDigits(e.target.value)) || 0) } : x))
                        )
                      }
                      placeholder="قیمت خرید"
                    />
                    <span className="text-sm w-28 text-left">{formatToman(it.unit_price * it.qty, false)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-100 pt-4">
            <div>
              <label className="label">مبلغ پرداختی (تومان)</label>
              <input className="input" inputMode="numeric" value={paid} onChange={(e) => setPaid(e.target.value)} />
            </div>
            <div>
              <label className="label">از حساب</label>
              <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="">—</option>
                {accounts?.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-4 flex justify-between font-bold text-slate-800">
            <span>جمع کل خرید</span>
            <span>{formatToman(total)}</span>
          </div>

          {error && <div className="rounded-xl bg-rose-50 text-rose-700 text-sm px-4 py-3">{error}</div>}

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
