"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { PageHeader, Spinner, EmptyState, Modal } from "@/components/shared/ui";
import { ProductSelector, type SelectableVariant } from "@/components/shared/product-selector";
import { toFaDigits, toEnDigits, toJalali } from "@/lib/utils/format";
import { Loader2, ArrowUpDown, AlertTriangle } from "lucide-react";

const TYPE_LABEL: Record<string, string> = {
  in: "ورود",
  out: "خروج",
  adjust: "تعدیل",
  transfer_in: "انتقال ورودی",
  transfer_out: "انتقال خروجی",
};

const REASON_LABEL: Record<string, string> = {
  purchase: "خرید",
  sale: "فروش",
  manual: "دستی",
  count: "شمارش",
  transfer: "انتقال",
  return: "مرجوعی",
  opening: "اول دوره",
};

export default function InventoryPage() {
  const { orgId, branchId } = useOrg();
  const qc = useQueryClient();
  const [adjustOpen, setAdjustOpen] = useState(false);

  // کالاهای کم‌موجود
  const { data: lowStock } = useQuery({
    queryKey: ["low-stock", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("low_stock_variants")
        .select("variant_id, product_name, color, size, stock_qty, low_stock_threshold")
        .limit(50);
      if (error) throw error;
      return data as {
        variant_id: string;
        product_name: string;
        color: string | null;
        size: string | null;
        stock_qty: number;
        low_stock_threshold: number;
      }[];
    },
  });

  // تاریخچه حرکات
  const { data: movements, isLoading } = useQuery({
    queryKey: ["stock-movements", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("stock_movements")
        .select("id, type, reason, qty, note, created_at, variant:product_variants(color, size, product:products(name))")
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data as any[];
    },
  });

  return (
    <div>
      <PageHeader
        title="عملیات انبار"
        subtitle="تعدیل موجودی، تاریخچه حرکات و کالاهای کم‌موجود"
        action={
          <button onClick={() => setAdjustOpen(true)} className="btn-primary">
            <ArrowUpDown size={18} />
            <span className="hidden sm:inline">تعدیل موجودی</span>
          </button>
        }
      />

      {/* کم‌موجودها */}
      {lowStock && lowStock.length > 0 && (
        <div className="card p-4 mb-6 border-amber-200 bg-amber-50/50">
          <div className="flex items-center gap-2 mb-3 text-amber-700 font-medium">
            <AlertTriangle size={18} /> کالاهای کم‌موجود
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStock.map((v) => (
              <span key={v.variant_id} className="text-xs bg-white border border-amber-200 rounded-lg px-2.5 py-1 text-slate-600">
                {v.product_name} {[v.color, v.size].filter(Boolean).join(" / ")} — {toFaDigits(v.stock_qty)} عدد
              </span>
            ))}
          </div>
        </div>
      )}

      <h2 className="font-semibold text-slate-800 mb-3">تاریخچه حرکات انبار</h2>
      {isLoading ? (
        <Spinner />
      ) : !movements || movements.length === 0 ? (
        <EmptyState title="حرکتی ثبت نشده" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>کالا</th>
                <th>نوع</th>
                <th>دلیل</th>
                <th>تعداد</th>
                <th>تاریخ</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td>
                    {m.variant?.product?.name}{" "}
                    <span className="text-slate-400 text-xs">
                      {[m.variant?.color, m.variant?.size].filter(Boolean).join(" / ")}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${m.qty >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                      {TYPE_LABEL[m.type] ?? m.type}
                    </span>
                  </td>
                  <td className="text-slate-500">{REASON_LABEL[m.reason] ?? m.reason}</td>
                  <td className={`font-medium ${m.qty >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {toFaDigits(m.qty)}
                  </td>
                  <td className="text-slate-500">{toJalali(m.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adjustOpen && (
        <AdjustModal
          orgId={orgId}
          branchId={branchId}
          onClose={() => {
            setAdjustOpen(false);
            qc.invalidateQueries({ queryKey: ["stock-movements"] });
            qc.invalidateQueries({ queryKey: ["low-stock"] });
            qc.invalidateQueries({ queryKey: ["products"] });
          }}
        />
      )}
    </div>
  );
}

function AdjustModal({
  orgId,
  branchId,
  onClose,
}: {
  orgId: string | null;
  branchId: string | null;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<{ id: string; label: string; stock: number } | null>(null);
  const [newQty, setNewQty] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(true);

  async function handleSave() {
    setError(null);
    if (!selected) {
      setError("یک کالا انتخاب کنید.");
      return;
    }
    const target = Number(toEnDigits(newQty));
    if (Number.isNaN(target)) {
      setError("موجودی جدید را وارد کنید.");
      return;
    }
    const diff = target - selected.stock;
    if (diff === 0) {
      onClose();
      return;
    }
    if (!orgId) return;
    setSaving(true);
    const supabase = createClient();
    try {
      const { error: e } = await supabase.from("stock_movements").insert({
        org_id: orgId,
        branch_id: branchId,
        variant_id: selected.id,
        type: "adjust",
        reason: "count",
        qty: diff,
        note: note.trim() || "تعدیل موجودی (شمارش)",
      });
      if (e) throw e;
      onClose();
    } catch (e) {
      setError("خطا: " + (e as Error).message);
      setSaving(false);
    }
  }

  return (
    <>
      <Modal open onClose={onClose} title="تعدیل موجودی (شمارش انبار)">
        <div className="space-y-4">
          {!selected ? (
            <button
              onClick={() => setPickerOpen(true)}
              className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-200 bg-brand-50/40 px-4 py-3 text-sm font-medium text-brand-700 hover:bg-brand-50"
            >
              <ArrowUpDown size={18} /> انتخاب کالا برای تعدیل
            </button>
          ) : (
            <>
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="font-medium text-slate-800">{selected.label}</div>
                <div className="text-sm text-slate-500 mt-1">موجودی فعلی: {toFaDigits(selected.stock)}</div>
                <button
                  onClick={() => {
                    setSelected(null);
                    setPickerOpen(true);
                  }}
                  className="text-brand-600 text-xs mt-1"
                >
                  تغییر کالا
                </button>
              </div>
              <div>
                <label className="label">موجودی شمارش‌شده (واقعی)</label>
                <input autoFocus className="input" inputMode="numeric" value={newQty} onChange={(e) => setNewQty(e.target.value)} />
              </div>
              <div>
                <label className="label">توضیح</label>
                <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
            </>
          )}

          {error && <div className="rounded-xl bg-rose-50 text-rose-700 text-sm px-4 py-3">{error}</div>}

          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving || !selected} className="btn-primary flex-1">
              {saving && <Loader2 className="animate-spin" size={18} />}
              ثبت تعدیل
            </button>
            <button onClick={onClose} className="btn-secondary">انصراف</button>
          </div>
        </div>
      </Modal>

      <ProductSelector
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(v: SelectableVariant) => {
          setSelected({
            id: v.variant_id,
            label: `${v.product_name} ${[v.color, v.size].filter(Boolean).join(" / ")}`.trim(),
            stock: v.stock_qty,
          });
          setNewQty(String(v.stock_qty));
          setPickerOpen(false);
        }}
        priceMode="sale"
      />
    </>
  );
}
