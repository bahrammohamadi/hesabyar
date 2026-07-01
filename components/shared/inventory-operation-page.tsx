"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { PageHeader, Spinner, EmptyState } from "@/components/shared/ui";
import { ProductSelector, type SelectableVariant } from "@/components/shared/product-selector";
import { EntityActionMenu } from "@/components/shared/entity-action-menu";
import { EntityLink } from "@/components/shared/entity-link";
import { toEnDigits, toFaDigits, toJalali } from "@/lib/utils/format";
import { Loader2, Package, Plus } from "lucide-react";
import { logActivity } from "@/lib/utils/activity-log";

type InventoryMode = "movements" | "in" | "out" | "adjust" | "waste";

const MODE_LABEL: Record<InventoryMode, string> = {
  movements: "گردش انبار",
  in: "ورود کالا",
  out: "خروج کالا",
  adjust: "تعدیل موجودی",
  waste: "ضایعات / خروج غیرعادی",
};

export function InventoryOperationPage({ mode }: { mode: InventoryMode }) {
  const { orgId, branchId } = useOrg();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<SelectableVariant | null>(null);
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "movements" && !selected && !searchParams.get("product")) setPickerOpen(true);
  }, [mode, selected, searchParams]);

  useEffect(() => {
    const productId = searchParams.get("product");
    if (!productId || mode !== "adjust") return;
    let active = true;
    const supabase = createClient();
    (async () => {
      const { data } = await supabase
        .from("product_variants")
        .select("id,color,size,sku,barcode,purchase_price,sale_price,stock_qty,product:products!inner(id,name,code,category_id,brand_id,base_sale_price,base_purchase_price)")
        .eq("product_id", productId)
        .eq("is_active", true)
        .limit(1);
      if (!active) return;
      const v = (data as any[])?.[0];
      if (!v) { setPickerOpen(true); return; }
      setSelected({
        variant_id: v.id,
        product_id: v.product?.id ?? null,
        product_name: v.product?.name ?? "کالا",
        product_code: v.product?.code ?? null,
        color: v.color,
        size: v.size,
        sku: v.sku,
        barcode: v.barcode,
        sale_price: v.sale_price ?? v.product?.base_sale_price ?? 0,
        purchase_price: v.purchase_price ?? v.product?.base_purchase_price ?? 0,
        stock_qty: v.stock_qty ?? 0,
        category_id: v.product?.category_id ?? null,
        brand_id: v.product?.brand_id ?? null,
      });
      setQty(String(v.stock_qty ?? 0));
      setPickerOpen(false);
    })();
    return () => { active = false; };
  }, [mode, searchParams]);

  const { data: movements, isLoading } = useQuery({
    queryKey: ["inventory-operation-movements", orgId, mode],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      let q = supabase
        .from("stock_movements")
        .select("id, variant_id, type, reason, qty, note, created_at, variant:product_variants(color, size, product:products(id, name))")
        .order("created_at", { ascending: false })
        .limit(100);
      if (mode === "in") q = q.eq("type", "in");
      if (mode === "out") q = q.eq("type", "out");
      if (mode === "waste") q = q.eq("type", "out").ilike("note", "%ضایعات%");
      if (mode === "adjust") q = q.eq("reason", "count");
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  async function save() {
    if (!selected || !orgId) return;
    setError(null);
    const inputQty = Number(toEnDigits(qty));
    if (Number.isNaN(inputQty) || inputQty < 0) { setError("تعداد را درست وارد کنید."); return; }
    const movementQty = mode === "adjust" ? inputQty - selected.stock_qty : (mode === "out" || mode === "waste") ? -inputQty : inputQty;
    if (movementQty === 0) { setError("تغییری برای ثبت وجود ندارد."); return; }
    setSaving(true);
    const supabase = createClient();
    try {
      const { data: inserted, error } = await supabase.from("stock_movements").insert({
        org_id: orgId,
        branch_id: branchId,
        variant_id: selected.variant_id,
        type: mode === "adjust" ? "adjust" : mode === "waste" ? "out" : mode,
        reason: mode === "adjust" ? "count" : "manual",
        qty: movementQty,
        note: mode === "waste" ? `ضایعات - ${note.trim() || "خروج غیرعادی"}` : (note.trim() || MODE_LABEL[mode]),
      }).select("id").single();
      if (error) throw error;
      await logActivity({ orgId, action: mode === "adjust" ? "stock_adjust" : mode === "in" ? "stock_in" : mode === "waste" ? "stock_waste" : "stock_out", entityType: "stock_movement", entityId: inserted?.id ?? null, newData: { product_id: selected.product_id, variant_id: selected.variant_id, qty: movementQty, note: mode === "waste" ? `ضایعات - ${note.trim() || "خروج غیرعادی"}` : note } });
      setSelected(null); setQty(""); setNote("");
      qc.invalidateQueries({ queryKey: ["inventory-operation-movements"] });
      qc.invalidateQueries({ queryKey: ["all-variants"] });
    } catch (e) {
      setError("خطا: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title={MODE_LABEL[mode]} subtitle={mode === "movements" ? "تاریخچه ورود، خروج و تعدیل کالاها" : "ثبت عملیات انبار در صفحه اختصاصی"} />

      {mode !== "movements" && (
        <div className="card p-4 mb-5">
          {!selected ? (
            <button onClick={() => setPickerOpen(true)} className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/20 bg-primary/[0.04] px-4 py-4 text-sm font-medium text-primary">
              <Package size={18}/> انتخاب کالا
            </button>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl bg-slate-50 p-3 flex items-center justify-between gap-3">
                <div>
                  <EntityLink type="product" id={selected.product_id}>{selected.product_name}</EntityLink>
                  <div className="text-xs text-slate-400 mt-1">{[selected.color, selected.size].filter(Boolean).join(" / ") || "ساده"} • موجودی فعلی: {toFaDigits(selected.stock_qty)}</div>
                </div>
                <EntityActionMenu type="product" id={selected.product_id} label={selected.product_name} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><label className="label">{mode === "adjust" ? "موجودی واقعی" : "تعداد"}</label><input className="input" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
                <div><label className="label">توضیح</label><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
              </div>
              {error && <div className="rounded-xl bg-rose-50 text-rose-700 text-sm p-3">{error}</div>}
              <div className="flex gap-2"><button onClick={save} disabled={saving} className="btn-primary"><Plus size={16}/>{saving && <Loader2 className="animate-spin" size={16}/>} ثبت</button><button onClick={() => setSelected(null)} className="btn-secondary">تغییر کالا</button></div>
            </div>
          )}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="p-4 border-b border-slate-100 font-semibold text-slate-700">آخرین گردش‌ها</div>
        {isLoading ? <Spinner /> : !movements?.length ? <EmptyState title="گردشی ثبت نشده" /> : (
          <div className="divide-y divide-slate-100">
            {movements.map((m: any) => (
              <div key={m.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <EntityLink type="product" id={m.variant?.product?.id}>{m.variant?.product?.name ?? "کالا"}</EntityLink>
                  <div className="text-xs text-slate-400 mt-1">{[m.variant?.color, m.variant?.size].filter(Boolean).join(" / ") || m.reason} • {m.note ?? ""}</div>
                </div>
                <div className={m.qty >= 0 ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>{m.qty >= 0 ? "+" : ""}{toFaDigits(m.qty)} <span className="block text-xs text-slate-400 font-normal">{toJalali(m.created_at)}</span></div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ProductSelector open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={(v) => { setSelected(v); setQty(mode === "adjust" ? String(v.stock_qty) : "1"); setPickerOpen(false); }} />
    </div>
  );
}
