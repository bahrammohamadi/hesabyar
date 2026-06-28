"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { PageHeader, Spinner, EmptyState, Modal } from "@/components/shared/ui";
import { ProductSelector, type SelectableVariant } from "@/components/shared/product-selector";
import { toFaDigits, toEnDigits, toJalali, formatToman } from "@/lib/utils/format";
import { Loader2, ArrowUpDown, AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Plus, Trash2 } from "lucide-react";
import Link from "next/link";

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
  const [stockInOpen, setStockInOpen] = useState(false);
  const [stockOutOpen, setStockOutOpen] = useState(false);

  // URL params support - auto-open modals based on URL
  const searchParams = useSearchParams();
  useEffect(() => {
    const type = searchParams.get("type");
    if (type === "in") setStockInOpen(true);
    else if (type === "out") setStockOutOpen(true);
    else if (type === "adjust") setAdjustOpen(true);
  }, [searchParams]);

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
        subtitle="تعدیل موجودی، ورود و خروج کالا"
        action={
          <div className="flex gap-2">
            <button onClick={() => setStockInOpen(true)} className="btn btn-secondary flex items-center gap-2 text-sm">
              <ArrowDownToLine size={16} />
              <span className="hidden sm:inline">ورود کالا</span>
            </button>
            <button onClick={() => setStockOutOpen(true)} className="btn btn-secondary flex items-center gap-2 text-sm">
              <ArrowUpFromLine size={16} />
              <span className="hidden sm:inline">خروج کالا</span>
            </button>
            <button onClick={() => setAdjustOpen(true)} className="btn-primary flex items-center gap-2">
              <ArrowUpDown size={18} />
              <span className="hidden sm:inline">تعدیل موجودی</span>
            </button>
          </div>
        }
      />

      {/* کم‌موجودها */}
      {lowStock && lowStock.length > 0 && (
        <div className="card p-4 mb-6 border-amber-200 bg-amber-50/50">
          <div className="flex items-center gap-2 mb-3 text-amber-700 font-medium">
            <AlertTriangle size={18} /> کالاهای کم‌موجود ({toFaDigits(lowStock.length)} مورد)
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStock.map((v) => (
              <span key={v.variant_id} className="text-xs bg-white border border-amber-200 rounded-lg px-2.5 py-1.5 text-slate-600 flex items-center gap-2">
                <Link href={`/products/${v.variant_id}`} className="font-medium text-brand-600 hover:underline">{v.product_name}</Link>
                {v.color || v.size ? (
                  <span className="text-slate-400">({[v.color, v.size].filter(Boolean).join(" / ")})</span>
                ) : null}
                <span className="text-amber-600 font-bold">{toFaDigits(v.stock_qty)} عدد</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <h2 className="font-semibold text-slate-800 mb-3">تاریخچه حرکات انبار</h2>
      {isLoading ? (
        <Spinner />
      ) : !movements || movements.length === 0 ? (
        <EmptyState title="حرکتی ثبت نشده" description="با ثبت ورود یا خروج کالا، تاریخچه اینجا نمایش داده می‌شود." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>کالا</th>
                <th>نوع</th>
                <th>دلیل</th>
                <th>تعداد</th>
                <th>توضیح</th>
                <th>تاریخ</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td>
                    <Link href={`/products/${m.variant_id}`} className="font-medium text-brand-600 hover:underline">{m.variant?.product?.name}</Link>
                    <span className="text-slate-400 text-xs block">
                      {[m.variant?.color, m.variant?.size].filter(Boolean).join(" / ")}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${m.qty >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                      {TYPE_LABEL[m.type] ?? m.type}
                    </span>
                  </td>
                  <td className="text-slate-500 text-sm">{REASON_LABEL[m.reason] ?? m.reason}</td>
                  <td className={`font-bold ${m.qty >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {m.qty >= 0 ? "+" : ""}{toFaDigits(m.qty)}
                  </td>
                  <td className="text-slate-400 text-sm max-w-[200px] truncate">{m.note ?? "—"}</td>
                  <td className="text-slate-500 text-sm">{toJalali(m.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* مودال‌ها */}
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

      {stockInOpen && (
        <StockInOutModal
          orgId={orgId}
          branchId={branchId}
          type="in"
          onClose={() => {
            setStockInOpen(false);
            qc.invalidateQueries({ queryKey: ["stock-movements"] });
            qc.invalidateQueries({ queryKey: ["low-stock"] });
            qc.invalidateQueries({ queryKey: ["products"] });
            qc.invalidateQueries({ queryKey: ["all-variants"] });
          }}
        />
      )}

      {stockOutOpen && (
        <StockInOutModal
          orgId={orgId}
          branchId={branchId}
          type="out"
          onClose={() => {
            setStockOutOpen(false);
            qc.invalidateQueries({ queryKey: ["stock-movements"] });
            qc.invalidateQueries({ queryKey: ["low-stock"] });
            qc.invalidateQueries({ queryKey: ["products"] });
            qc.invalidateQueries({ queryKey: ["all-variants"] });
          }}
        />
      )}
    </div>
  );
}

// ==============================================================
// مودال ورود/خروج موجودی
// ==============================================================
function StockInOutModal({
  orgId,
  branchId,
  type,
  onClose,
}: {
  orgId: string | null;
  branchId: string | null;
  type: "in" | "out";
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<{ id: string; label: string; stock: number } | null>(null);
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState(type === "in" ? "manual" : "sale");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(true);

  async function handleSave() {
    setError(null);
    if (!selected) { setError("یک کالا انتخاب کنید."); return; }
    const qtyNum = Number(toEnDigits(qty));
    if (Number.isNaN(qtyNum) || qtyNum <= 0) { setError("تعداد را وارد کنید."); return; }
    if (type === "out" && qtyNum > selected.stock) {
      setError("تعداد خروج بیشتر از موجودی فعلی است.");
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
        type,
        reason,
        qty: type === "in" ? qtyNum : -qtyNum,
        note: note.trim() || (type === "in" ? "ورود دستی به انبار" : "خروج دستی از انبار"),
      });
      if (e) throw e;
      onClose();
    } catch (e) {
      setError("خطا: " + (e as Error).message);
      setSaving(false);
    }
  }

  const title = type === "in" ? "ورود کالا به انبار" : "خروج کالا از انبار";
  const reasonOptions = type === "in"
    ? [
        { value: "manual", label: "ورود دستی" },
        { value: "return", label: "مرجوعی" },
        { value: "transfer", label: "انتقال ورودی" },
        { value: "opening", label: "موجودی اول دوره" },
      ]
    : [
        { value: "manual", label: "خروج دستی" },
        { value: "count", label: "کسر شمارش" },
        { value: "transfer", label: "انتقال خروجی" },
        { value: "return", label: "مرجوعی به تامین‌کننده" },
      ];

  return (
    <>
      <Modal open onClose={onClose} title={title} size="lg">
        <div className="space-y-4">
          {!selected ? (
            <button
              onClick={() => setPickerOpen(true)}
              className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-200 bg-brand-50/40 px-4 py-3 text-sm font-medium text-brand-700 hover:bg-brand-50"
            >
              <Plus size={18} /> انتخاب کالا
            </button>
          ) : (
            <>
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="font-medium text-slate-800">{selected.label}</div>
                <div className="text-sm text-slate-500 mt-1">موجودی فعلی: {toFaDigits(selected.stock)} عدد</div>
                <button onClick={() => { setSelected(null); setPickerOpen(true); }} className="text-brand-600 text-xs mt-1">
                  تغییر کالا
                </button>
              </div>

              <div>
                <label className="label">تعداد {type === "in" ? "ورودی" : "خروجی"} (عدد)</label>
                <input
                  autoFocus
                  className="input"
                  inputMode="numeric"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  placeholder={type === "in" ? "تعداد ورودی" : "تعداد خروجی"}
                />
              </div>

              <div>
                <label className="label">دلیل</label>
                <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
                  {reasonOptions.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">توضیح</label>
                <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="توضیح اختیاری..." />
              </div>

              {qty && selected && (
                <div className={`rounded-xl p-3 text-sm ${type === "in" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                  موجودی بعد از عملیات: <span className="font-bold">{toFaDigits(selected.stock + (type === "in" ? Number(toEnDigits(qty)) : -Number(toEnDigits(qty))))}</span> عدد
                </div>
              )}
            </>
          )}

          {error && <div className="rounded-xl bg-rose-50 text-rose-700 text-sm px-4 py-3">{error}</div>}

          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving || !selected} className="btn-primary flex-1">
              {saving && <Loader2 className="animate-spin" size={18} />}
              ثبت {type === "in" ? "ورود" : "خروج"}
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
          setPickerOpen(false);
        }}
        priceMode={type === "in" ? "purchase" : "sale"}
      />
    </>
  );
}

// ==============================================================
// مودال تعدیل موجودی (شمارش)
// ==============================================================
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
    if (!selected) { setError("یک کالا انتخاب کنید."); return; }
    const target = Number(toEnDigits(newQty));
    if (Number.isNaN(target)) { setError("موجودی جدید را وارد کنید."); return; }
    const diff = target - selected.stock;
    if (diff === 0) { onClose(); return; }
    if (!orgId) return;
    setSaving(true);
    const supabase = createClient();
    try {
      const { error: e } = await supabase.from("stock_movements").insert({
        org_id: orgId,
        branch_id: branchId,
        variant_id: selected.id,
        type: diff > 0 ? "in" : "out",
        reason: "count",
        qty: diff,
        note: note.trim() || "تعدیل موجودی (شمارش انبار)",
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
                <button onClick={() => { setSelected(null); setPickerOpen(true); }} className="text-brand-600 text-xs mt-1">
                  تغییر کالا
                </button>
              </div>
              <div>
                <label className="label">موجودی شمارش‌شده (واقعی)</label>
                <input autoFocus className="input" inputMode="numeric" value={newQty} onChange={(e) => setNewQty(e.target.value)} />
              </div>
              {newQty && selected && (
                <div className={`rounded-xl p-3 text-sm ${Number(toEnDigits(newQty)) >= selected.stock ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                  تغییر: {Number(toEnDigits(newQty)) >= selected.stock ? "+" : ""}{toFaDigits(Number(toEnDigits(newQty)) - selected.stock)} عدد
                </div>
              )}
              <div>
                <label className="label">توضیح</label>
                <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثلاً: شمارش انبار آذر ۱۴۰۳" />
              </div>
            </>
          )}

          {error && <div className="rounded-xl bg-rose-50 text-rose-700 text-sm px-4 py-3">{error}</div>}

          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving || !selected} className="btn-primary flex-1">
              {saving && <Loader2 className="animate-spin" size={18} />} ثبت تعدیل
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