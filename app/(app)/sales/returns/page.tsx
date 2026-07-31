"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatToman, toJalali, toFaDigits } from "@/lib/utils/format";
import { PageHeader, Spinner, EmptyState, Modal } from "@/components/shared/ui";
import { Badge } from "@/src/shared/ui";
import { EntityLink } from "@/components/shared/entity-link";
import { EntityActionMenu } from "@/components/shared/entity-action-menu";
import { Plus, Trash2, RotateCcw, Search } from "lucide-react";
import { logActivity } from "@/lib/utils/activity-log";

const sb = createClient();

type Return = any;

type Sale = any;

export default function SalesReturnsPage() {
  const [returns, setReturns] = useState<Return[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [sales, setSales] = useState<Sale[]>([]);
  const [selectedSale, setSelectedSale] = useState("");
  const [returnItems, setReturnItems] = useState<any[]>([]);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [refundMethod, setRefundMethod] = useState("cash");
  const [saving, setSaving] = useState(false);

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    const { data: user } = await sb.auth.getUser();
    if (!user.user) { setLoading(false); return; }
    const { data: mems } = await sb.from("memberships").select("org_id").eq("user_id", user.user.id).eq("is_active", true).limit(1);
    if (!mems?.length) { setLoading(false); return; }
    const { data } = await sb.from("sales_returns").select("*, customer:contacts(name), customer_id").eq("org_id", mems[0].org_id).order("created_at", { ascending: false });
    setReturns(data || []);
    setLoading(false);
  }, []);

  const fetchSales = async () => {
    const { data: user } = await sb.auth.getUser();
    if (!user.user) return;
    const { data: mems } = await sb.from("memberships").select("org_id").eq("user_id", user.user.id).eq("is_active", true).limit(1);
    if (!mems?.length) return;
    const { data } = await sb.from("sales").select("id, invoice_no, date, total, customer:contacts(name), customer_id").eq("org_id", mems[0].org_id).eq("status", "confirmed").order("date", { ascending: false }).limit(50);
    setSales(data || []);
  };

  const fetchSaleItems = async (saleId: string) => {
    const { data } = await sb.from("sale_items").select("*, variant:product_variants(id, color, size)").eq("sale_id", saleId);
    if (data) {
      setReturnItems(data.map((item: any) => ({ ...item, return_qty: Math.min(1, item.qty), return_price: item.unit_price })));
    }
  };

  const createReturn = async () => {
    if (!selectedSale) { alert("فاکتور انتخاب نشده"); return; }
    if (returnItems.filter(i => i.return_qty > 0).length === 0) { alert("حداقل یک آیتم انتخاب کنید"); return; }

    setSaving(true);
    const { data: user } = await sb.auth.getUser();
    if (!user.user) { setSaving(false); return; }
    const { data: mems } = await sb.from("memberships").select("org_id, branch_id").eq("user_id", user.user.id).eq("is_active", true).limit(1);
    if (!mems?.length) { setSaving(false); return; }

    const totalReturn = returnItems.filter(i => i.return_qty > 0).reduce((sum, i) => sum + (i.return_qty * i.return_price), 0);

    try {
      const { data: inserted } = await sb.from("sales_returns").insert({
        org_id: mems[0].org_id, branch_id: mems[0].branch_id,
        original_sale_id: selectedSale,
        customer_id: sales.find(s => s.id === selectedSale)?.customer_id || null,
        return_no: `R-${Date.now()}`,
        total: totalReturn, reason: reason || null, note: note || null,
        refund_method: refundMethod, created_by: user.user.id,
      }).select().single();

      if (inserted) {
        for (const item of returnItems.filter(i => i.return_qty > 0)) {
          await sb.from("sales_return_items").insert({
            org_id: mems[0].org_id, branch_id: mems[0].branch_id,
            return_id: inserted.id, sale_item_id: item.id, variant_id: item.variant_id,
            qty: item.return_qty, unit_price: item.return_price, line_total: item.return_qty * item.return_price,
            created_by: user.user.id,
          });
          await sb.from("stock_movements").insert({
            org_id: mems[0].org_id, branch_id: mems[0].branch_id,
            variant_id: item.variant_id, type: "in", reason: "return",
            qty: item.return_qty, ref_table: "sales_returns", ref_id: inserted.id,
            created_by: user.user.id,
          });
        }
      }
      if (inserted) {
        await logActivity({ orgId: mems[0].org_id, action: "create", entityType: "sales_return", entityId: inserted.id, newData: { original_sale_id: selectedSale, total: totalReturn, items_count: returnItems.filter(i => i.return_qty > 0).length } });
      }
      setShowForm(false);
      resetForm();
      fetchReturns();
    } catch (err) {
      alert("خطا: " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const deleteReturn = async (id: string) => {
    if (!confirm("آیا از حذف این مرجوعی مطمئن هستید؟")) return;
    const ret = returns.find((r) => r.id === id);
    const { data: user } = await sb.auth.getUser();
    const { data: mems } = user.user ? await sb.from("memberships").select("org_id").eq("user_id", user.user.id).eq("is_active", true).limit(1) : { data: null } as any;
    await sb.from("sales_returns").delete().eq("id", id);
    await logActivity({ orgId: mems?.[0]?.org_id ?? null, action: "delete", entityType: "sales_return", entityId: id, oldData: { return_no: ret?.return_no, total: ret?.total } });
    fetchReturns();
  };

  const resetForm = () => { setSelectedSale(""); setReturnItems([]); setReason(""); setNote(""); setRefundMethod("cash"); };

  useEffect(() => { fetchReturns(); }, [fetchReturns]);
  useEffect(() => { if (showForm) fetchSales(); }, [showForm]);
  useEffect(() => { if (selectedSale) fetchSaleItems(selectedSale); }, [selectedSale]);

  const filteredReturns = returns.filter(r => !search || r.return_no?.includes(search) || r.customer?.name?.includes(search));
  const sale = sales.find(s => s.id === selectedSale);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader
        title="مرجوعی فروش"
        subtitle="ثبت برگشت کالا از مشتریان"
        action={<button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary"><Plus size={16} /> مرجوعی جدید</button>}
      />

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
        <input className="input pr-9" placeholder="جستجو..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="card p-4 text-center"><div className="text-2xl font-bold text-foreground">{toFaDigits(returns.length)}</div><div className="text-xs text-muted-foreground">تعداد مرجوعی</div></div>
        <div className="card p-4 text-center"><div className="text-2xl font-bold text-destructive">{formatToman(returns.reduce((sum, r) => sum + (r.total || 0), 0))}</div><div className="text-xs text-muted-foreground">مجموع مرجوعی</div></div>
        <div className="card p-4 text-center"><div className="text-2xl font-bold text-success-onSoft">{formatToman(returns.filter(r => r.refund_method === "cash").reduce((sum, r) => sum + (r.total || 0), 0))}</div><div className="text-xs text-muted-foreground">برگشت نقدی</div></div>
      </div>

      {loading ? <Spinner label="در حال بارگذاری..." /> :
       filteredReturns.length === 0 ? (
        <EmptyState icon={RotateCcw} title="مرجوعی یافت نشد" description="هنوز مرجوعی فروشی ثبت نشده" action={<button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary"><Plus size={16} /> ثبت مرجوعی</button>} />
      ) : (
        <div className="space-y-3">
          {filteredReturns.map(ret => (
            <div key={ret.id} className="card p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-bold text-foreground">{ret.return_no || "بدون شماره"}</span>
                    <Badge tone="primary">مرجوعی</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mb-1">
                    {ret.customer_id ? (
                      <span className="inline-flex items-center gap-2">
                        <EntityLink type="contact" id={ret.customer_id}>{ret.customer?.name ?? "مشتری"}</EntityLink>
                        <EntityActionMenu type="contact" id={ret.customer_id} label={ret.customer?.name ?? "مشتری"} />
                      </span>
                    ) : "بدون مشتری"}
                  </div>
                  <div className="text-xs text-muted-foreground">{toJalali(ret.date)}</div>
                  {ret.reason && <div className="text-xs text-muted-foreground mt-1">دلیل: {ret.reason}</div>}
                </div>
                <div className="text-left">
                  <div className="text-lg font-bold text-destructive">{formatToman(ret.total)}</div>
                  <div className="text-xs text-muted-foreground">{ret.refund_method === "cash" ? "نقدی" : ret.refund_method === "card" ? "کارت" : "اعتبار"}</div>
                </div>
              </div>
              <div className="flex items-center justify-end mt-3 pt-3 border-t border-border">
                <button onClick={() => deleteReturn(ret.id)} className="btn-danger text-sm"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <Modal open onClose={() => setShowForm(false)} title="ثبت مرجوعی فروش" size="lg">
          <div className="space-y-4">
            <div>
              <label className="label">فاکتور اصلی</label><select aria-label="فاکتور اصلی" className="input" value={selectedSale} onChange={e => setSelectedSale(e.target.value)}>
                <option value="">انتخاب فاکتور...</option>
                {sales.map(s => <option key={s.id} value={s.id}>{s.invoice_no} - {s.customer?.name || "بدون مشتری"} - {formatToman(s.total)}</option>)}
              </select>
            </div>

            {sale && (
              <div className="p-3 bg-muted/50 rounded-xl">
                <div className="text-sm font-medium mb-2">اقلام فاکتور:</div>
                <div className="space-y-2">
                  {returnItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-lg">
                      <div className="text-sm"><div>سایز: {item.variant?.size || "-"} رنگ: {item.variant?.color || "-"}</div><div className="text-xs text-muted-foreground">تعداد اصلی: {item.qty} • قیمت: {formatToman(item.unit_price)}</div></div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs">تعداد:</span>
                        <input type="number" min="1" max={item.qty} value={item.return_qty} onChange={e => { const newItems = [...returnItems]; newItems[idx].return_qty = parseInt(e.target.value) || 0; setReturnItems(newItems); }} className="input w-16 text-center" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">روش برگشت</label><select aria-label="روش برگشت" className="input" value={refundMethod} onChange={e => setRefundMethod(e.target.value)}>
                  <option value="cash">نقدی</option>
                  <option value="card">کارت</option>
                  <option value="credit">اعتبار مشتری</option>
                </select>
              </div>
              <div>
                <label className="label">دلیل مرجوعی</label><input aria-label="دلیل مرجوعی" className="input" value={reason} onChange={e => setReason(e.target.value)} placeholder="دلیل مرجوعی..." />
              </div>
            </div>

            <div>
              <label className="label">توضیحات</label>
              <textarea className="input" rows={2} value={note} onChange={e => setNote(e.target.value)} />
            </div>

            <div className="flex items-center justify-between p-4 bg-destructive/10 rounded-xl">
              <span className="font-medium text-destructive">جمع مرجوعی:</span>
              <span className="text-xl font-bold text-destructive">{formatToman(returnItems.filter(i => i.return_qty > 0).reduce((sum, i) => sum + (i.return_qty * i.return_price), 0))}</span>
            </div>

            <div className="flex gap-2">
              <button onClick={createReturn} disabled={saving} className="btn-primary flex-1">{saving ? "در حال ثبت..." : "ثبت مرجوعی"}</button>
              <button onClick={() => setShowForm(false)} className="btn-secondary">انصراف</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}