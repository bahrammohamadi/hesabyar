"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { EmptyState, Modal, PageHeader, Spinner } from "@/components/shared/ui";
import { EntityActionMenu } from "@/components/shared/entity-action-menu";
import { EntityLink } from "@/components/shared/entity-link";
import { formatToman, toEnDigits, toFaDigits, toJalali } from "@/lib/utils/format";
import { logActivity } from "@/lib/utils/activity-log";

export default function PurchaseReturnsPage() {
  const { orgId, branchId } = useOrg();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const { data: returns, isLoading } = useQuery({
    queryKey: ["purchase-returns", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("purchase_returns")
        .select("id,return_no,date,total,refund_method,supplier_id,reason,note,supplier:contacts(name)")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return returns ?? [];
    return (returns ?? []).filter((r: any) => `${r.return_no ?? ""} ${r.supplier?.name ?? ""} ${r.reason ?? ""}`.toLowerCase().includes(t));
  }, [returns, search]);

  async function deleteReturn(id: string) {
    if (!confirm("مرجوعی خرید حذف شود؟ موجودی برگشت داده‌شده اصلاح نمی‌شود؛ فقط رکورد مرجوعی حذف می‌شود.")) return;
    const supabase = createClient();
    await supabase.from("purchase_returns").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["purchase-returns"] });
  }

  return (
    <div>
      <PageHeader title="مرجوعی خرید" subtitle="ثبت برگشت کالا به تأمین‌کننده و خروج موجودی" action={<button onClick={() => setOpen(true)} className="btn-primary"><Plus size={16} /> مرجوعی جدید</button>} />
      <div className="relative mb-4">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
        <input className="input pr-10" placeholder="جستجو شماره مرجوعی یا تأمین‌کننده..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {isLoading ? <Spinner /> : !filtered.length ? <EmptyState icon={ArrowLeftRight} title="مرجوعی خرید ثبت نشده" /> : (
        <div className="space-y-2">
          {filtered.map((ret: any) => (
            <div key={ret.id} className="card p-4 flex items-center justify-between gap-3">
              <div>
                <div className="font-bold text-slate-800">{ret.return_no ?? "بدون شماره"}</div>
                <div className="text-xs text-slate-400 mt-1">{ret.supplier_id ? <EntityLink type="contact" id={ret.supplier_id}>{ret.supplier?.name ?? "تأمین‌کننده"}</EntityLink> : "بدون تأمین‌کننده"} • {toJalali(ret.date)}</div>
                {ret.reason && <div className="text-xs text-slate-500 mt-1">دلیل: {ret.reason}</div>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {ret.supplier_id && <EntityActionMenu type="contact" id={ret.supplier_id} label={ret.supplier?.name ?? "تأمین‌کننده"} />}
                <div className="text-left"><div className="font-bold text-rose-600">{formatToman(ret.total)}</div><div className="text-xs text-slate-400">{ret.refund_method}</div></div>
                <button onClick={() => deleteReturn(ret.id)} className="text-slate-400 hover:text-rose-600"><Trash2 size={17} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      {open && <PurchaseReturnModal orgId={orgId} branchId={branchId} onClose={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["purchase-returns"] }); qc.invalidateQueries({ queryKey: ["inventory-operation-movements"] }); }} />}
    </div>
  );
}

function PurchaseReturnModal({ orgId, branchId, onClose }: { orgId: string | null; branchId: string | null; onClose: () => void }) {
  const [purchaseId, setPurchaseId] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [refundMethod, setRefundMethod] = useState("credit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: purchases } = useQuery({
    queryKey: ["returnable-purchases", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("purchases")
        .select("id,invoice_no,date,total,supplier_id,supplier:contacts(name)")
        .eq("org_id", orgId)
        .eq("status", "confirmed")
        .order("date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const selectedPurchase = purchases?.find((p: any) => p.id === purchaseId);

  async function loadItems(id: string) {
    setPurchaseId(id);
    if (!id) { setItems([]); return; }
    const supabase = createClient();
    const { data, error } = await supabase
      .from("purchase_items")
      .select("id,variant_id,qty,unit_price,line_total,variant:product_variants(id,color,size,stock_qty,product:products(id,name,code))")
      .eq("purchase_id", id);
    if (error) { setError(error.message); return; }
    setItems((data ?? []).map((item: any) => ({ ...item, return_qty: Math.min(1, item.qty), return_price: item.unit_price })));
  }

  const total = items.filter((i) => i.return_qty > 0).reduce((sum, item) => sum + item.return_qty * item.return_price, 0);

  async function save() {
    if (!orgId || !purchaseId) { setError("فاکتور خرید را انتخاب کنید."); return; }
    const selected = items.filter((i) => i.return_qty > 0);
    if (!selected.length) { setError("حداقل یک آیتم را برای مرجوعی انتخاب کنید."); return; }
    setSaving(true);
    const supabase = createClient();
    try {
      const { data: inserted, error: retError } = await supabase.from("purchase_returns").insert({
        org_id: orgId,
        branch_id: branchId,
        original_purchase_id: purchaseId,
        supplier_id: selectedPurchase?.supplier_id ?? null,
        return_no: `PR-${Date.now()}`,
        total,
        refund_method: refundMethod,
        reason: reason.trim() || null,
        note: note.trim() || null,
      }).select("id").single();
      if (retError) throw retError;

      for (const item of selected) {
        const qty = Number(toEnDigits(String(item.return_qty))) || 0;
        if (qty <= 0) continue;
        if (qty > item.qty) throw new Error("تعداد مرجوعی نمی‌تواند بیشتر از تعداد خرید باشد.");
        if (item.variant?.stock_qty != null && qty > item.variant.stock_qty) throw new Error("موجودی فعلی برای خروج مرجوعی کافی نیست.");
        const lineTotal = qty * item.return_price;
        const { error: itemError } = await supabase.from("purchase_return_items").insert({
          org_id: orgId,
          branch_id: branchId,
          return_id: inserted.id,
          purchase_item_id: item.id,
          variant_id: item.variant_id,
          qty,
          unit_price: item.return_price,
          line_total: lineTotal,
        });
        if (itemError) throw itemError;
        const { error: movementError } = await supabase.from("stock_movements").insert({
          org_id: orgId,
          branch_id: branchId,
          variant_id: item.variant_id,
          type: "out",
          reason: "return",
          qty: -qty,
          ref_table: "purchase_returns",
          ref_id: inserted.id,
          note: reason.trim() || "مرجوعی خرید",
        });
        if (movementError) throw movementError;
      }

      await logActivity({ orgId, action: "create", entityType: "purchase_return", entityId: inserted.id, newData: { purchase_id: purchaseId, total, items_count: selected.length } });
      onClose();
    } catch (e) {
      setError("خطا: " + (e as Error).message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="ثبت مرجوعی خرید" size="lg" mobileFullscreen>
      <div className="space-y-4">
        <div>
          <label className="label">فاکتور خرید</label>
          <select className="input" value={purchaseId} onChange={(e) => loadItems(e.target.value)}>
            <option value="">انتخاب...</option>
            {purchases?.map((p: any) => <option key={p.id} value={p.id}>{p.invoice_no} - {p.supplier?.name ?? "بدون تأمین‌کننده"} - {formatToman(p.total)}</option>)}
          </select>
        </div>
        {items.length > 0 && (
          <div className="space-y-2 max-h-[42vh] overflow-y-auto">
            {items.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div><EntityLink type="product" id={item.variant?.product?.id}>{item.variant?.product?.name ?? "کالا"}</EntityLink><div className="text-xs text-slate-400 mt-1">خرید: {toFaDigits(item.qty)} • موجودی: {toFaDigits(item.variant?.stock_qty ?? 0)}</div></div>
                  <div className="font-bold text-slate-700">{formatToman(item.unit_price)}</div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div><label className="text-xs text-slate-400">تعداد مرجوعی</label><input className="input" inputMode="numeric" value={String(item.return_qty)} onChange={(e) => setItems((prev) => prev.map((x) => x.id === item.id ? { ...x, return_qty: Number(toEnDigits(e.target.value)) || 0 } : x))} /></div>
                  <div><label className="text-xs text-slate-400">قیمت مرجوعی</label><input className="input" inputMode="numeric" value={String(Math.round(item.return_price / 10))} onChange={(e) => setItems((prev) => prev.map((x) => x.id === item.id ? { ...x, return_price: (Number(toEnDigits(e.target.value)) || 0) * 10 } : x))} /></div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><label className="label">روش برگشت وجه</label><select className="input" value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)}><option value="credit">اعتباری/حسابی</option><option value="cash">نقد</option><option value="transfer">انتقال</option></select></div>
          <div><label className="label">دلیل</label><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        </div>
        <div><label className="label">توضیح</label><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
        <div className="rounded-xl bg-rose-50 text-rose-700 p-3 text-sm flex justify-between"><span>جمع مرجوعی</span><b>{formatToman(total)}</b></div>
        {error && <div className="rounded-xl bg-rose-50 text-rose-700 text-sm p-3">{error}</div>}
        <div className="flex gap-2"><button onClick={save} disabled={saving} className="btn-primary flex-1">{saving && <Loader2 className="animate-spin" size={16}/>} ثبت مرجوعی خرید</button><button onClick={onClose} className="btn-secondary">انصراف</button></div>
      </div>
    </Modal>
  );
}
