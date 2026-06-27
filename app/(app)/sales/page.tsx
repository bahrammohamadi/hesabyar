"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { PageHeader, Spinner, Modal } from "@/components/shared/ui";
import { formatToman, toFaDigits, toEnDigits, rialToToman, tomanToRial } from "@/lib/utils/format";
import { Plus, Search, Trash2, Receipt, Loader2, ShoppingCart } from "lucide-react";
import type { CartItem } from "@/types/db";
import Link from "next/link";

interface VariantSearchRow {
  id: string;
  color: string | null;
  size: string | null;
  sku: string | null;
  barcode: string | null;
  sale_price: number | null;
  purchase_price: number | null;
  stock_qty: number;
  product: { name: string; base_sale_price: number; base_purchase_price: number } | null;
}

export default function SalesPage() {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const [posOpen, setPosOpen] = useState(false);

  const { data: sales, isLoading } = useQuery({
    queryKey: ["sales-list", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("sales")
        .select("id, invoice_no, date, total, paid_credit, status, customer:contacts(name)")
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
        customer: { name: string } | null;
      }[];
    },
  });

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
          <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-4">
            <ShoppingCart size={26} />
          </div>
          <h3 className="font-semibold text-slate-700">هنوز فروشی ثبت نشده</h3>
          <p className="text-sm text-slate-400 mt-1">اولین فاکتور فروش خود را صادر کنید.</p>
          <button onClick={() => setPosOpen(true)} className="btn-primary mt-4 mx-auto">
            <Plus size={18} /> فروش جدید
          </button>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>شماره فاکتور</th>
                <th>تاریخ</th>
                <th>مشتری</th>
                <th>مبلغ</th>
                <th>نسیه</th>
                <th>وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td>
                    <Link href={`/sales/${s.id}`} className="text-brand-600 font-medium">
                      {s.invoice_no}
                    </Link>
                  </td>
                  <td className="text-slate-500">
                    {toFaDigits(new Date(s.date).toLocaleDateString("fa-IR"))}
                  </td>
                  <td>{s.customer?.name ?? "مشتری نقدی"}</td>
                  <td className="font-medium">{formatToman(s.total)}</td>
                  <td>
                    {s.paid_credit > 0 ? (
                      <span className="text-rose-600">{formatToman(s.paid_credit, false)}</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td>
                    <span className="badge bg-emerald-100 text-emerald-700">ثبت‌شده</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [discount, setDiscount] = useState("0"); // تومان
  const [paidCash, setPaidCash] = useState("");
  const [paidCard, setPaidCard] = useState("");
  const [accountId, setAccountId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // جستجوی کالا
  const { data: results } = useQuery({
    queryKey: ["variant-search", orgId, search],
    enabled: !!orgId && search.trim().length > 0,
    queryFn: async (): Promise<VariantSearchRow[]> => {
      const supabase = createClient();
      const term = search.trim();
      const { data, error } = await supabase
        .from("product_variants")
        .select(
          `id, color, size, sku, barcode, sale_price, purchase_price, stock_qty,
           product:products!inner(name, base_sale_price, base_purchase_price)`
        )
        .eq("is_active", true)
        .or(`sku.ilike.%${term}%,barcode.ilike.%${term}%`)
        .limit(10);
      // جستجو در نام محصول جداگانه (چون فیلتر روی جدول مرتبط نیاز به سینتکس خاص دارد)
      const { data: byName } = await supabase
        .from("product_variants")
        .select(
          `id, color, size, sku, barcode, sale_price, purchase_price, stock_qty,
           product:products!inner(name, base_sale_price, base_purchase_price)`
        )
        .eq("is_active", true)
        .ilike("products.name", `%${term}%`)
        .limit(10);
      if (error) throw error;
      const all = [...((data as unknown as VariantSearchRow[]) ?? []), ...((byName as unknown as VariantSearchRow[]) ?? [])];
      const unique = Array.from(new Map(all.map((r) => [r.id, r])).values());
      return unique;
    },
  });

  const { data: customers } = useQuery({
    queryKey: ["sale-customers", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("contacts")
        .select("id, name")
        .in("type", ["customer", "both"])
        .eq("is_active", true)
        .order("name")
        .limit(500);
      return data ?? [];
    },
  });

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

  function addToCart(v: VariantSearchRow) {
    const price = v.sale_price ?? v.product?.base_sale_price ?? 0;
    const cost = v.purchase_price ?? v.product?.base_purchase_price ?? 0;
    setCart((prev) => {
      const existing = prev.find((c) => c.variant_id === v.id);
      if (existing) {
        return prev.map((c) =>
          c.variant_id === v.id ? { ...c, qty: c.qty + 1 } : c
        );
      }
      return [
        ...prev,
        {
          variant_id: v.id,
          product_name: v.product?.name ?? "",
          variant_label: [v.color, v.size].filter(Boolean).join(" / "),
          qty: 1,
          unit_price: price,
          discount: 0,
          cost_price: cost,
          stock_qty: v.stock_qty,
        },
      ];
    });
    setSearch("");
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

  const subtotal = useMemo(
    () => cart.reduce((s, c) => s + c.unit_price * c.qty - c.discount, 0),
    [cart]
  );
  const discountRial = tomanToRial(Number(toEnDigits(discount)) || 0);
  const total = Math.max(0, subtotal - discountRial);
  const paidCashRial = tomanToRial(Number(toEnDigits(paidCash)) || 0);
  const paidCardRial = tomanToRial(Number(toEnDigits(paidCard)) || 0);
  const credit = Math.max(0, total - paidCashRial - paidCardRial);

  async function handleSubmit() {
    setError(null);
    if (cart.length === 0) {
      setError("سبد فروش خالی است.");
      return;
    }
    if (credit > 0 && !customerId) {
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
        p_customer: customerId || null,
        p_items: cart.map((c) => ({
          variant_id: c.variant_id,
          qty: c.qty,
          unit_price: c.unit_price,
          discount: c.discount,
          cost_price: c.cost_price,
        })),
        p_discount: discountRial,
        p_tax: 0,
        p_paid_cash: paidCashRial,
        p_paid_card: paidCardRial,
        p_paid_credit: credit,
        p_account: accountId || null,
        p_note: null,
      });
      if (e) throw e;
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
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <Receipt size={30} />
          </div>
          <h3 className="font-bold text-slate-800 text-lg">فاکتور با موفقیت ثبت شد ✅</h3>
          <p className="text-sm text-slate-500 mt-2">
            مبلغ کل: {formatToman(total)}
          </p>
          <div className="flex gap-2 mt-6">
            <Link href={`/sales/${done}`} className="btn-primary flex-1">
              مشاهده و چاپ فاکتور
            </Link>
            <button onClick={onClose} className="btn-secondary">
              بستن
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="فروش جدید" size="lg">
      <div className="space-y-4">
        {/* جستجوی کالا */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            autoFocus
            className="input pr-10"
            placeholder="جستجو/اسکن: نام کالا، کد یا بارکد..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search.trim() && results && results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
              {results.map((v) => (
                <button
                  key={v.id}
                  onClick={() => addToCart(v)}
                  className="w-full text-right px-4 py-2.5 hover:bg-slate-50 border-b border-slate-50 last:border-0"
                >
                  <div className="font-medium text-sm text-slate-800">{v.product?.name}</div>
                  <div className="text-xs text-slate-400 flex justify-between mt-0.5">
                    <span>{[v.color, v.size].filter(Boolean).join(" / ") || "ساده"}</span>
                    <span>
                      موجودی {toFaDigits(v.stock_qty)} —{" "}
                      {formatToman(v.sale_price ?? v.product?.base_sale_price ?? 0)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* سبد */}
        {cart.length === 0 ? (
          <div className="text-center text-sm text-slate-400 py-8 border border-dashed border-slate-200 rounded-xl">
            کالایی انتخاب نشده است.
          </div>
        ) : (
          <div className="space-y-2">
            {cart.map((c) => (
              <div key={c.variant_id} className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-slate-800 truncate">
                      {c.product_name}
                    </div>
                    <div className="text-xs text-slate-400">{c.variant_label || "ساده"}</div>
                  </div>
                  <button
                    onClick={() => updateQty(c.variant_id, 0)}
                    className="text-rose-400 hover:text-rose-600 p-1 shrink-0"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center border border-slate-200 rounded-lg">
                    <button
                      onClick={() => updateQty(c.variant_id, c.qty - 1)}
                      className="px-2.5 py-1 text-slate-500"
                    >
                      −
                    </button>
                    <span className="px-3 text-sm font-medium">{toFaDigits(c.qty)}</span>
                    <button
                      onClick={() => updateQty(c.variant_id, c.qty + 1)}
                      className="px-2.5 py-1 text-slate-500"
                    >
                      +
                    </button>
                  </div>
                  <input
                    className="input flex-1 text-sm"
                    inputMode="numeric"
                    value={String(rialToToman(c.unit_price))}
                    onChange={(e) => updatePrice(c.variant_id, e.target.value)}
                  />
                  <div className="text-sm font-medium text-slate-700 w-28 text-left shrink-0">
                    {formatToman(c.unit_price * c.qty - c.discount, false)}
                  </div>
                </div>
                {c.qty > c.stock_qty && (
                  <div className="text-xs text-amber-600 mt-1">
                    ⚠ موجودی کافی نیست (موجودی: {toFaDigits(c.stock_qty)})
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* مشتری و پرداخت */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-100 pt-4">
          <div>
            <label className="label">مشتری</label>
            <select
              className="input"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">مشتری نقدی</option>
              {customers?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">حساب دریافت وجه</label>
            <select
              className="input"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">انتخاب...</option>
              {accounts?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">تخفیف (تومان)</label>
            <input
              className="input"
              inputMode="numeric"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
            />
          </div>
          <div>
            <label className="label">دریافت نقدی (تومان)</label>
            <input
              className="input"
              inputMode="numeric"
              value={paidCash}
              onChange={(e) => setPaidCash(e.target.value)}
            />
          </div>
          <div>
            <label className="label">دریافت کارتی (تومان)</label>
            <input
              className="input"
              inputMode="numeric"
              value={paidCard}
              onChange={(e) => setPaidCard(e.target.value)}
            />
          </div>
        </div>

        {/* جمع */}
        <div className="rounded-xl bg-slate-50 p-4 space-y-1.5 text-sm">
          <div className="flex justify-between text-slate-500">
            <span>جمع کل</span>
            <span>{formatToman(subtotal)}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>تخفیف</span>
            <span>{formatToman(discountRial)}</span>
          </div>
          <div className="flex justify-between font-bold text-slate-800 text-base border-t border-slate-200 pt-1.5">
            <span>مبلغ قابل پرداخت</span>
            <span>{formatToman(total)}</span>
          </div>
          {credit > 0 && (
            <div className="flex justify-between text-rose-600 font-medium">
              <span>باقیمانده (نسیه)</span>
              <span>{formatToman(credit)}</span>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-xl bg-rose-50 text-rose-700 text-sm px-4 py-3">{error}</div>
        )}

        <div className="flex gap-2">
          <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1">
            {saving && <Loader2 className="animate-spin" size={18} />}
            ثبت فروش
          </button>
          <button onClick={onClose} className="btn-secondary">
            انصراف
          </button>
        </div>
      </div>
    </Modal>
  );
}
