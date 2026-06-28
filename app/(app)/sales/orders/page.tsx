"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatPrice, formatDate, formatDateTime } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Search, Plus, Eye, Edit, Trash2, MoreHorizontal, ArrowUpRight, FileText } from "lucide-react";

const sb = createClient();

type Order = {
  id: string;
  order_no: string;
  date: string;
  expiry_date: string;
  status: string;
  total: number;
  customer_id: string;
  customer?: { name: string };
  subtotal: number;
  discount: number;
  note: string;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "در انتظار", color: "bg-yellow-100 text-yellow-800" },
  confirmed: { label: "تأیید شده", color: "bg-blue-100 text-blue-800" },
  converted: { label: "تبدیل به فاکتور", color: "bg-green-100 text-green-800" },
  cancelled: { label: "لغو شده", color: "bg-red-100 text-red-800" },
  expired: { label: "منقضی", color: "bg-gray-100 text-gray-800" },
};

export default function SalesOrdersPage() {
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [discount, setDiscount] = useState(0);
  const [note, setNote] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [showProductSearch, setShowProductSearch] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const { data: user } = await sb.auth.getUser();
    if (!user.user) return;

    const { data: mems } = await sb.from("memberships").select("org_id").eq("user_id", user.user.id).eq("is_active", true).limit(1);
    if (!mems?.length) { setLoading(false); return; }
    const orgId = mems[0].org_id;

    let query = sb.from("sales_orders")
      .select("*, customer:contacts(name)")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data } = await query;
    setOrders(data || []);
    setLoading(false);
  }, [statusFilter]);

  const fetchCustomers = async () => {
    const { data: user } = await sb.auth.getUser();
    if (!user.user) return;
    const { data: mems } = await sb.from("memberships").select("org_id").eq("user_id", user.user.id).eq("is_active", true).limit(1);
    if (!mems?.length) return;
    const { data } = await sb.from("contacts").select("id, name").eq("org_id", mems[0].org_id).eq("type", "customer").eq("is_active", true).order("name");
    setCustomers(data || []);
  };

  const fetchProducts = async (searchTerm: string) => {
    if (!searchTerm.trim()) { setItems([]); return; }
    const { data: user } = await sb.auth.getUser();
    if (!user.user) return;
    const { data: mems } = await sb.from("memberships").select("org_id").eq("user_id", user.user.id).eq("is_active", true).limit(1);
    if (!mems?.length) return;
    const { data } = await sb.from("products").select("id, name, code").eq("org_id", mems[0].org_id).ilike("name", `%${searchTerm}%`).limit(20);
    if (data) {
      const withVariants = await Promise.all(data.map(async (p: any) => {
        const { data: variants } = await sb.from("product_variants").select("id, color, size, sale_price, stock_qty").eq("product_id", p.id).eq("is_active", true);
        return { ...p, variants: variants || [] };
      }));
      setItems(withVariants);
    }
  };

  const createOrder = async () => {
    if (!selectedOrder && items.filter(i => i.qty > 0).length === 0) {
      alert("حداقل یک آیتم اضافه کنید");
      return;
    }
    const { data: user } = await sb.auth.getUser();
    if (!user.user) return;
    const { data: mems } = await sb.from("memberships").select("org_id, branch_id").eq("user_id", user.user.id).eq("is_active", true).limit(1);
    if (!mems?.length) return;

    const orderItems = items.filter(i => i.qty > 0);
    const subtotal = orderItems.reduce((sum, item) => sum + (item.qty * item.price), 0);
    const total = subtotal - discount;

    if (selectedOrder) {
      await sb.from("sales_orders").update({ customer_id: customerId, discount, note, expiry_date: expiryDate || null, subtotal, total }).eq("id", selectedOrder.id);
    } else {
      const { data: nextNo } = await sb.rpc("next_order_no", { p_org: mems[0].org_id, p_prefix: "SO" });
      await sb.from("sales_orders").insert({
        org_id: mems[0].org_id,
        branch_id: mems[0].branch_id,
        customer_id: customerId || null,
        order_no: nextNo || `SO-${Date.now()}`,
        expiry_date: expiryDate || null,
        subtotal,
        discount,
        total,
        note,
        status: "pending",
        created_by: user.user.id,
      });
    }
    setShowForm(false);
    resetForm();
    fetchOrders();
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    await sb.from("sales_orders").update({ status }).eq("id", orderId);
    fetchOrders();
  };

  const deleteOrder = async (orderId: string) => {
    if (!confirm("آیا از حذف این سفارش مطمئن هستید؟")) return;
    await sb.from("sales_orders").delete().eq("id", orderId);
    fetchOrders();
  };

  const resetForm = () => {
    setCustomerId("");
    setDiscount(0);
    setNote("");
    setExpiryDate("");
    setItems([]);
    setProductSearch("");
    setSelectedOrder(null);
  };

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    if (showForm) fetchCustomers();
  }, [showForm]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (productSearch) fetchProducts(productSearch);
    }, 300);
    return () => clearTimeout(timeout);
  }, [productSearch]);

  const filteredOrders = orders.filter(o => {
    const matchSearch = !search || o.order_no?.includes(search) || o.customer?.name?.includes(search);
    return matchSearch;
  });

  const openEdit = (order: Order) => {
    setSelectedOrder(order);
    setCustomerId(order.customer_id || "");
    setDiscount(order.discount || 0);
    setNote(order.note || "");
    setExpiryDate(order.expiry_date ? order.expiry_date.split("T")[0] : "");
    setShowForm(true);
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">سفارش‌های فروش</h1>
          <p className="text-sm text-slate-500">مدیریت پیش‌فاکتورها و سفارش‌ها</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-2">
          <Plus size={16} /> سفارش جدید
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <Input placeholder="جستجو شماره سفارش یا مشتری..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 text-sm">
          <option value="all">همه وضعیت‌ها</option>
          <option value="pending">در انتظار</option>
          <option value="confirmed">تأیید شده</option>
          <option value="converted">تبدیل به فاکتور</option>
          <option value="cancelled">لغو شده</option>
          <option value="expired">منقضی</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-2xl font-bold text-slate-800">{orders.length}</div>
          <div className="text-xs text-slate-500">کل سفارش‌ها</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-2xl font-bold text-yellow-600">{orders.filter(o => o.status === "pending").length}</div>
          <div className="text-xs text-slate-500">در انتظار</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-2xl font-bold text-blue-600">{orders.filter(o => o.status === "confirmed").length}</div>
          <div className="text-xs text-slate-500">تأیید شده</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-2xl font-bold text-green-600">{formatPrice(orders.filter(o => o.status !== "cancelled").reduce((sum, o) => sum + (o.total || 0), 0))}</div>
          <div className="text-xs text-slate-500">مجموع (تومان)</div>
        </CardContent></Card>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <EmptyState icon={FileText} title="سفارشی یافت نشد" description="اولین سفارش فروش خود را ثبت کنید" action={
          <Button onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus size={16} /> سفارش جدید
          </Button>
        } />
      ) : (
        <div className="space-y-3">
          {filteredOrders.map(order => {
            const statusInfo = STATUS_LABELS[order.status] || STATUS_LABELS.pending;
            return (
              <Card key={order.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-bold text-slate-800">{order.order_no || "بدون شماره"}</span>
                        <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                      </div>
                      <div className="text-sm text-slate-600 mb-1">
                        {order.customer?.name || <span className="text-slate-400">بدون مشتری</span>}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <span>تاریخ: {formatDateTime(order.date)}</span>
                        {order.expiry_date && <span>انقضا: {formatDateTime(order.expiry_date)}</span>}
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="text-lg font-bold text-slate-800">{formatPrice(order.total)}</div>
                      <div className="text-xs text-slate-400">تومان</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-slate-100">
                    {order.status === "pending" && (
                      <Button size="sm" variant="outline" onClick={() => updateOrderStatus(order.id, "confirmed")} className="text-blue-600 border-blue-200 hover:bg-blue-50">
                        تأیید
                      </Button>
                    )}
                    {order.status !== "converted" && order.status !== "cancelled" && (
                      <Button size="sm" variant="outline" onClick={() => openEdit(order)} className="text-emerald-600 border-emerald-200 hover:bg-emerald-50">
                        <Edit size={14} />
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => deleteOrder(order.id)} className="text-red-600 border-red-200 hover:bg-red-50">
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold">{selectedOrder ? "ویرایش سفارش" : "سفارش فروش جدید"}</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">مشتری</label>
                  <select value={customerId} onChange={e => setCustomerId(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200">
                    <option value="">انتخاب مشتری...</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">تاریخ انقضا</label>
                  <Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-700">آیتم‌های سفارش</label>
                  <Button size="sm" variant="outline" onClick={() => setShowProductSearch(!showProductSearch)}>
                    <Plus size={14} /> افزودن کالا
                  </Button>
                </div>
                {showProductSearch && (
                  <div className="mb-3 p-3 bg-slate-50 rounded-xl">
                    <Input placeholder="جستجوی کالا..." value={productSearch} onChange={e => setProductSearch(e.target.value)} className="mb-2" />
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {items.map(item => (
                        item.variants?.map((v: any) => (
                          <div key={v.id} className="flex items-center justify-between p-2 bg-white rounded-lg">
                            <div className="text-sm">
                              <div className="font-medium">{item.name}</div>
                              <div className="text-xs text-slate-400">{v.color && `رنگ: ${v.color}`} {v.size && `سایز: ${v.size}`}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{formatPrice(v.sale_price)}</span>
                              <Button size="sm" onClick={() => {
                                setItems([...items.filter(i => i.variant_id !== v.id), { ...v, product_name: item.name, qty: 1, price: v.sale_price }]);
                                setShowProductSearch(false);
                                setProductSearch("");
                              }}><Plus size={14} /></Button>
                            </div>
                          </div>
                        ))
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  {items.filter(i => i.qty > 0).map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                      <div className="flex-1">
                        <div className="text-sm font-medium">{item.product_name}</div>
                        <div className="text-xs text-slate-400">{item.color && `رنگ: ${item.color}`} {item.size && `سایز: ${item.size}`}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="number" min="1" value={item.qty} onChange={e => {
                          const newItems = [...items];
                          newItems[idx].qty = parseInt(e.target.value) || 1;
                          setItems(newItems);
                        }} className="w-16 px-2 py-1 text-center rounded-lg border border-slate-200" />
                        <span className="text-sm">{formatPrice(item.price * item.qty)}</span>
                        <button onClick={() => setItems(items.map((i, j) => j === idx ? { ...i, qty: 0 } : i))} className="text-red-500 hover:text-red-700">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">تخفیف (تومان)</label>
                  <Input type="number" min="0" value={discount} onChange={e => setDiscount(parseInt(e.target.value) || 0)} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">توضیحات</label>
                <textarea value={note} onChange={e => setNote(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200" rows={3} />
              </div>

              <div className="flex items-center justify-between p-4 bg-brand-50 rounded-xl">
                <span className="font-medium">جمع کل:</span>
                <span className="text-xl font-bold text-brand-700">
                  {formatPrice(items.filter(i => i.qty > 0).reduce((sum, i) => sum + (i.qty * i.price), 0) - discount)}
                </span>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setShowForm(false)}>انصراف</Button>
              <Button onClick={createOrder}>{selectedOrder ? "ویرایش" : "ثبت سفارش"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}