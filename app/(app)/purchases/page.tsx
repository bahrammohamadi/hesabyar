"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { PageHeader, Spinner, EmptyState, Modal } from "@/components/shared/ui";
import { formatToman, toFaDigits, toEnDigits, tomanToRial, rialToToman, toJalali } from "@/lib/utils/format";
import { Plus, Search, Trash2, Loader2, ShoppingCart } from "lucide-react";

interface PItem {
  variant_id: string;
  label: string;
  qty: number;
  unit_price: number; // ریال
}

export default function PurchasesPage() {
  const { orgId, branchId } = useOrg();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: purchases, isLoading } = useQuery({
    queryKey: ["purchases-list", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("purchases")
        .select("id, invoice_no, date, total, paid, supplier:contacts(name)")
        .order("date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as unknown as {
        id: string;
        invoice_no: string;
        date: string;
        total: number;
        paid: number;
        supplier: { name: string } | null;
      }[];
    },
  });

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
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="font-medium text-brand-600">{p.invoice_no}</td>
                  <td className="text-slate-500">{toJalali(p.date)}</td>
                  <td>{p.supplier?.name ?? "—"}</td>
                  <td className="font-medium">{formatToman(p.total)}</td>
                  <td>{formatToman(p.paid)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <PurchaseModal
          orgId={orgId}
          branchId={branchId}
          onClose={() => {
            setOpen(false);
            qc.invalidateQueries({ queryKey: ["purchases-list"] });
            qc.invalidateQueries({ queryKey: ["products"] });
          }}
        />
      )}
    </div>
  );
}

function PurchaseModal({
  orgId,
  branchId,
  onClose,
}: {
  orgId: string | null;
  branchId: string | null;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<PItem[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [paid, setPaid] = useState("");
  const [accountId, setAccountId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: results } = useQuery({
    queryKey: ["purchase-variant-search", orgId, search],
    enabled: !!orgId && search.trim().length > 0,
    queryFn: async () => {
      const supabase = createClient();
      const term = search.trim();
      const { data } = await supabase
        .from("product_variants")
        .select("id, color, size, purchase_price, product:products!inner(name, base_purchase_price)")
        .eq("is_active", true)
        .ilike("products.name", `%${term}%`)
        .limit(10);
      return (data as any[]) ?? [];
    },
  });

  const { data: suppliers } = useQuery({
    queryKey: ["purchase-suppliers", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("contacts")
        .select("id, name")
        .in("type", ["supplier", "both"])
        .eq("is_active", true)
        .order("name");
      return data ?? [];
    },
  });

  const { data: accounts } = useQuery({
    queryKey: ["purchase-accounts", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase.from("accounts").select("id, name").eq("is_active", true);
      return data ?? [];
    },
  });

  function addItem(v: any) {
    const price = v.purchase_price ?? v.product?.base_purchase_price ?? 0;
    setItems((prev) => {
      if (prev.find((i) => i.variant_id === v.id)) return prev;
      return [
        ...prev,
        {
          variant_id: v.id,
          label: `${v.product?.name} ${[v.color, v.size].filter(Boolean).join(" / ")}`,
          qty: 1,
          unit_price: price,
        },
      ];
    });
    setSearch("");
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
      const { error: e } = await supabase.rpc("create_purchase", {
        p_org: orgId,
        p_branch: branchId,
        p_supplier: supplierId || null,
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
      onClose();
    } catch (e) {
      setError("خطا: " + (e as Error).message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="خرید جدید" size="lg">
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            className="input pr-10"
            placeholder="جستجوی کالا..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search.trim() && results && results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
              {results.map((v) => (
                <button
                  key={v.id}
                  onClick={() => addItem(v)}
                  className="w-full text-right px-4 py-2.5 hover:bg-slate-50 text-sm"
                >
                  {v.product?.name}{" "}
                  <span className="text-slate-400">
                    {[v.color, v.size].filter(Boolean).join(" / ")}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {items.length === 0 ? (
          <div className="text-center text-sm text-slate-400 py-8 border border-dashed border-slate-200 rounded-xl">
            کالایی انتخاب نشده.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((it, idx) => (
              <div key={it.variant_id} className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">{it.label}</span>
                  <button
                    onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}
                    className="text-rose-400 p-1"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    className="input w-20 text-sm"
                    inputMode="numeric"
                    value={String(it.qty)}
                    onChange={(e) =>
                      setItems((p) =>
                        p.map((x, i) =>
                          i === idx ? { ...x, qty: Number(toEnDigits(e.target.value)) || 0 } : x
                        )
                      )
                    }
                    placeholder="تعداد"
                  />
                  <input
                    className="input flex-1 text-sm"
                    inputMode="numeric"
                    value={String(rialToToman(it.unit_price))}
                    onChange={(e) =>
                      setItems((p) =>
                        p.map((x, i) =>
                          i === idx
                            ? { ...x, unit_price: tomanToRial(Number(toEnDigits(e.target.value)) || 0) }
                            : x
                        )
                      )
                    }
                    placeholder="قیمت خرید"
                  />
                  <span className="text-sm w-28 text-left">
                    {formatToman(it.unit_price * it.qty, false)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-100 pt-4">
          <div>
            <label className="label">تامین‌کننده</label>
            <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">—</option>
              {suppliers?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">مبلغ پرداختی (تومان)</label>
            <input
              className="input"
              inputMode="numeric"
              value={paid}
              onChange={(e) => setPaid(e.target.value)}
            />
          </div>
          <div>
            <label className="label">از حساب</label>
            <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">—</option>
              {accounts?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
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
          <button onClick={onClose} className="btn-secondary">
            انصراف
          </button>
        </div>
      </div>
    </Modal>
  );
}
