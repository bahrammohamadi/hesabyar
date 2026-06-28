"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPrice, formatDateTime } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Search, Plus, Trash2, ArrowLeftRight, RotateCcw } from "lucide-react";

const sb = createClient();

type Return = {
  id: string;
  return_no: string;
  date: string;
  status: string;
  total: number;
  reason: string;
  note: string;
  customer_id: string;
  original_sale_id: string;
  customer?: { name: string };
  original_sale?: { invoice_no: string; total: number };
  refund_method: string;
};

type Sale = {
  id: string;
  invoice_no: string;
  date: string;
  total: number;
  customer_id: string;
  customer?: { name: string };
};

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

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    const { data: user } = await sb.auth.getUser();
    if (!user.user) return;
    const { data: mems } = await sb.from("memberships").select("org_id").eq("user_id", user.user.id).eq("is_active", true).limit(1);
    if (!mems?.length) { setLoading(false); return; }
    const { data } = await sb.from("sales_returns")
      .select("*, customer:contacts(name), original_sale:sales(invoice_no, total)")
      .eq("org_id", mems[0].org_id)
      .order("created_at", { ascending: false });
    setReturns(data || []);
    setLoading(false);
  }, []);

  const fetchSales = async () => {
    const { data: user } = await sb.auth.getUser();
    if (!user.user) return;
    const { data: mems } = await sb.from("memberships").select("org_id").eq("user_id", user.user.id).eq("is_active", true).limit(1);
    if (!mems?.length) return;
    const { data } = await sb.from("sales")
      .select("id, invoice_no, date, total, customer:contacts(name)")
      .eq("org_id", mems[0].org_id)
      .eq("status", "confirmed")
      .order("date", { ascending: false })
      .limit(50);
    setSales(data || []);
  };

  const fetchSaleItems = async (saleId: string) => {
    const { data } = await sb.from("sale_items")
      .select("*, variant:product_variants(id, color, size)")
      .eq("sale_id", saleId);
    if (data) {
      setReturnItems(data.map((item: any) => ({
        ...item,
        return_qty: Math.min(1, item.qty),
        return_price: item.unit_price,
      })));
    }
  };

  const createReturn = async () => {
    if (!selectedSale) { alert("فاکتور انتخاب نشده"); return; }
    if (returnItems.filter(i => i.return_qty > 0).length === 0) { alert("حداقل یک آیتم انتخاب کنید"); return; }

    const { data: user } = await sb.auth.getUser();
    if (!user.user) return;
    const { data: mems } = await sb.from("memberships").select("org_id, branch_id").eq("user_id", user.user.id).eq("is_active", true).limit(1);
    if (!mems?.length) return;

    const totalReturn = returnItems.filter(i => i.return_qty > 0).reduce((sum, i) => sum + (i.return_qty * i.return_price), 0);
    const returnNo = `R-${Date.now()}`;

    const { data: inserted } = await sb.from("sales_returns").insert({
      org_id: mems[0].org_id,
      branch_id: mems[0].branch_id,
      original_sale_id: selectedSale,
      customer_id: sales.find(s => s.id === selectedSale)?.customer_id || null,
      return_no: returnNo,
      total: totalReturn,
      reason,
      note,
      refund_method: refundMethod,
      created_by: user.user.id,
    }).select().single();

    if (inserted) {
      for (const item of returnItems.filter(i => i.return_qty > 0)) {
        await sb.from("sales_return_items").insert({
          org_id: mems[0].org_id,
          branch_id: mems[0].branch_id,
          return_id: inserted.id,
          sale_item_id: item.id,
          variant_id: item.variant_id,
          qty: item.return_qty,
          unit_price: item.return_price,
          line_total: item.return_qty * item.return_price,
          created_by: user.user.id,
        });

        // برگشت موجودی
        await sb.from("stock_movements").insert({
          org_id: mems[0].org_id,
          branch_id: mems[0].branch_id,
          variant_id: item.variant_id,
          type: "in",
          reason: "return",
          qty: item.return_qty,
          ref_table: "sales_returns",
          ref_id: inserted.id,
          created_by: user.user.id,
        });
      }
    }

    setShowForm(false);
    resetForm();
    fetchReturns();
  };

  const deleteReturn = async (id: string) => {
    if (!confirm("آیا از حذف این مرجوعی مطمئن هستید؟")) return;
    await sb.from("sales_returns").delete().eq("id", id);
    fetchReturns();
  };

  const resetForm = () => {
    setSelectedSale("");
    setReturnItems([]);
    setReason("");
    setNote("");
    setRefundMethod("cash");
  };

  useEffect(() => { fetchReturns(); }, [fetchReturns]);

  useEffect(() => {
    if (showForm) fetchSales();
  }, [showForm]);

  useEffect(() => {
    if (selectedSale) fetchSaleItems(selectedSale);
  }, [selectedSale]);

  const filteredReturns = returns.filter(r => !search || r.return_no?.includes(search) || r.customer?.name?.includes(search));

  const sale = sales.find(s => s.id === selectedSale);

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">مرجوعی فروش</h1>
          <p className="text-sm text-slate-500">ثبت برگشت کالا از مشتریان</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-2">
          <Plus size={16} /> مرجوعی جدید
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <Input placeholder="جستجو..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-2xl font-bold text-slate-800">{returns.length}</div>
          <div className="text-xs text-slate-500">تعداد مرجوعی</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-2xl font-bold text-red-600">{formatPrice(returns.reduce((sum, r) => sum + (r.total || 0), 0))}</div>
          <div className="text-xs text-slate-500">مجموع مرجوعی</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-2xl font-bold text-emerald-600">{formatPrice(returns.filter(r => r.refund_method === "cash").reduce((sum, r) => sum + (r.total || 0), 0))}</div>
          <div className="text-xs text-slate-500">برگشت نقدی</div>
        </CardContent></Card>
      </div>

      {/* Returns List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
        </div>
      ) : filteredReturns.length === 0 ? (
        <EmptyState icon={RotateCcw} title="مرجوعی یافت نشد" description="هنوز مرجوعی فروشی ثبت نشده" action={
          <Button onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus size={16} /> ثبت مرجوعی
          </Button>
        } />
      ) : (
        <div className="space-y-3">
          {filteredReturns.map(ret => (
            <Card key={ret.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-bold text-slate-800">{ret.return_no || "بدون شماره"}</span>
                      <Badge className="bg-purple-100 text-purple-800">مرجوعی</Badge>
                    </div>
                    <div className="text-sm text-slate-600 mb-1">{ret.customer?.name || "بدون مشتری"}</div>
                    <div className="text-xs text-slate-400">
                      فاکتور اصلی: {ret.original_sale?.invoice_no || "نامشخص"}
                      <span className="mx-2">•</span>
                      {formatDateTime(ret.date)}
                    </div>
                    {ret.reason && <div className="text-xs text-slate-500 mt-1">دلیل: {ret.reason}</div>}
                  </div>
                  <div className="text-left">
                    <div className="text-lg font-bold text-red-600">{formatPrice(ret.total)}</div>
                    <div className="text-xs text-slate-400">
                      {ret.refund_method === "cash" ? "نقدی" : ret.refund_method === "card" ? "کارت" : "اعتبار"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-slate-100">
                  <Button size="sm" variant="outline" onClick={() => deleteReturn(ret.id)} className="text-red-600 border-red-200 hover:bg-red-50">
                    <Trash2 size={14} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold">ثبت مرجوعی فروش</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">فاکتور اصلی</label>
                <select value={selectedSale} onChange={e => setSelectedSale(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200">
                  <option value="">انتخاب فاکتور...</option>
                  {sales.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.invoice_no} - {s.customer?.name || "بدون مشتری"} - {formatPrice(s.total)}
                    </option>
                  ))}
                </select>
              </div>

              {sale && (
                <div className="p-3 bg-slate-50 rounded-xl">
                  <div className="text-sm font-medium mb-2">اقلام فاکتور:</div>
                  <div className="space-y-2">
                    {returnItems.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-lg">
                        <div className="text-sm">
                          <div>سایز: {item.variant?.size || "-"} رنگ: {item.variant?.color || "-"}</div>
                          <div className="text-xs text-slate-400">تعداد اصلی: {item.qty} • قیمت: {formatPrice(item.unit_price)}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs">تعداد:</span>
                          <input type="number" min="1" max={item.qty} value={item.return_qty} onChange={e => {
                            const newItems = [...returnItems];
                            newItems[idx].return_qty = parseInt(e.target.value) || 0;
                            setReturnItems(newItems);
                          }} className="w-16 px-2 py-1 text-center rounded-lg border border-slate-200" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">روش برگشت</label>
                  <select value={refundMethod} onChange={e => setRefundMethod(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200">
                    <option value="cash">نقدی</option>
                    <option value="card">کارت</option>
                    <option value="credit">اعتبار مشتری</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">دلیل مرجوعی</label>
                  <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="دلیل مرجوعی..." />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">توضیحات</label>
                <textarea value={note} onChange={e => setNote(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200" rows={2} />
              </div>

              <div className="flex items-center justify-between p-4 bg-red-50 rounded-xl">
                <span className="font-medium text-red-700">جمع مرجوعی:</span>
                <span className="text-xl font-bold text-red-700">
                  {formatPrice(returnItems.filter(i => i.return_qty > 0).reduce((sum, i) => sum + (i.return_qty * i.return_price), 0))}
                </span>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setShowForm(false)}>انصراف</Button>
              <Button onClick={createReturn}>ثبت مرجوعی</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}