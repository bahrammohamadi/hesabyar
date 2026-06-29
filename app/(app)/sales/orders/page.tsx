"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatToman, toFaDigits, toJalali } from "@/lib/utils/format";
import { PageHeader, Spinner, EmptyState, Modal } from "@/components/shared/ui";
import { EntityLink } from "@/components/shared/entity-link";
import { EntityActionMenu } from "@/components/shared/entity-action-menu";
import { Plus, Search, Edit, Trash2, FileText, ClipboardList } from "lucide-react";

const sb = createClient();

type Order = {
  id: string;
  order_no: string;
  date: string;
  expiry_date: string;
  status: string;
  total: number;
  subtotal: number;
  discount: number;
  note: string;
  customer_id: string;
  customer?: { name: string };
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "در انتظار", color: "bg-yellow-100 text-yellow-800" },
  confirmed: { label: "تأیید شده", color: "bg-blue-100 text-blue-800" },
  converted: { label: "تبدیل به فاکتور", color: "bg-emerald-100 text-emerald-800" },
  cancelled: { label: "لغو شده", color: "bg-rose-100 text-rose-800" },
  expired: { label: "منقضی", color: "bg-slate-100 text-slate-600" },
};

export default function SalesOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [discount, setDiscount] = useState("");
  const [note, setNote] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const { data: user } = await sb.auth.getUser();
    if (!user.user) { setLoading(false); return; }
    const { data: mems } = await sb.from("memberships").select("org_id").eq("user_id", user.user.id).eq("is_active", true).limit(1);
    if (!mems?.length) { setLoading(false); return; }

    let query = sb.from("sales_orders").select("*, customer:contacts(name)").eq("org_id", mems[0].org_id).order("created_at", { ascending: false });
    if (statusFilter !== "all") query = query.eq("status", statusFilter);

    const { data } = await query;
    setOrders(data || []);
    setLoading(false);
  }, [statusFilter]);

  const fetchCustomers = async () => {
    const { data: user } = await sb.auth.getUser();
    if (!user.user) return;
    const { data: mems } = await sb.from("memberships").select("org_id").eq("user_id", user.user.id).eq("is_active", true).limit(1);
    if (!mems?.length) return;
    const { data } = await sb.from("contacts").select("id, name").eq("org_id", mems[0].org_id).eq("is_active", true).order("name");
    setCustomers(data || []);
  };

  const fetchProducts = async (searchTerm: string) => {
    if (!searchTerm.trim()) { setItems([]); return; }
    const { data: user } = await sb.auth.getUser();
    if (!user.user) return;
    const { data: mems } = await sb.from("memberships").select("org_id").eq("user_id", user.user.id).eq("is_active", true).limit(1);
    if (!mems?.length) return;
    const { data } = await sb.from("products").select("id, name, code").eq("org_id", mems[0].org_id).ilike("name", `%${searchTerm}%`).limit(15);
    if (data) {
      const withVariants = await Promise.all(data.map(async (p: any) => {
        const { data: variants } = await sb.from("product_variants").select("id, color, size, sale_price, stock_qty").eq("product_id", p.id).eq("is_active", true);
        return { ...p, variants: variants || [] };
      }));
      setItems(withVariants);
    }
  };

  const createOrder = async () => {
    const orderItems = items.filter(i => i.qty > 0);
    if (orderItems.length === 0) { alert("حداقل یک آیتم اضافه کنید"); return; }

    setSaving(true);
    const { data: user } = await sb.auth.getUser();
    if (!user.user) { setSaving(false); return; }
    const { data: mems } = await sb.from("memberships").select("org_id, branch_id").eq("user_id", user.user.id).eq("is_active", true).limit(1);
    if (!mems?.length) { setSaving(false); return; }

    const subtotal = orderItems.reduce((sum, item) => sum + (item.qty * item.price), 0);
    const total = subtotal - (parseInt(discount) || 0);

    try {
      if (selectedOrder) {
        await sb.from("sales_orders").update({
          customer_id: customerId || null,
          discount: parseInt(discount) || 0,
          note: note || null,
          expiry_date: expiryDate || null,
          subtotal,
          total,
        }).eq("id", selectedOrder.id);

        // Update items
        await sb.from("sales_order_items").delete().eq("order_id", selectedOrder.id);
        for (const item of orderItems) {
          await sb.from("sales_order_items").insert({
            org_id: mems[0].org_id, branch_id: mems[0].branch_id,
            order_id: selectedOrder.id, variant_id: item.variant_id,
            qty: item.qty, unit_price: item.price, line_total: item.qty * item.price,
            created_by: user.user.id,
          });
        }
      } else {
        const { data: nextNo } = await sb.rpc("next_order_no", { p_org: mems[0].org_id, p_prefix: "SO" });
        const { data: inserted } = await sb.from("sales_orders").insert({
          org_id: mems[0].org_id, branch_id: mems[0].branch_id,
          customer_id: customerId || null,
          order_no: nextNo || `SO-${Date.now()}`,
          expiry_date: expiryDate || null,
          subtotal, discount: parseInt(discount) || 0, total, note: note || null,
          status: "pending", created_by: user.user.id,
        }).select().single();

        if (inserted) {
          for (const item of orderItems) {
            await sb.from("sales_order_items").insert({
              org_id: mems[0].org_id, branch_id: mems[0].branch_id,
              order_id: inserted.id, variant_id: item.variant_id,
              qty: item.qty, unit_price: item.price, line_total: item.qty * item.price,
              created_by: user.user.id,
            });
          }
        }
      }
      setShowForm(false);
      resetForm();
      fetchOrders();
    } catch (err) {
      alert("خطا: " + (err as Error).message);
    } finally {
      setSaving(false);
    }
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
    setCustomerId(""); setDiscount(""); setNote(""); setExpiryDate("");
    setItems([]); setProductSearch(""); setSelectedOrder(null);
  };

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => { if (showForm) fetchCustomers(); }, [showForm]);
  useEffect(() => {
    const timeout = setTimeout(() => { if (productSearch) fetchProducts(productSearch); }, 300);
    return () => clearTimeout(timeout);
  }, [productSearch]);

  const filteredOrders = orders.filter(o => !search || o.order_no?.includes(search) || o.customer?.name?.includes(search));

  const openEdit = (order: Order) => {
    setSelectedOrder(order); setCustomerId(order.customer_id || "");
    setDiscount(String(order.discount || 0)); setNote(order.note || "");
    setExpiryDate(order.expiry_date ? order.expiry_date.split("T")[0] : "");
    setShowForm(true);
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader
        title="سفارش‌های فروش"
        subtitle="مدیریت پیش‌فاکتورها و سفارش‌ها"
        action={<button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary"><Plus size={16} /> سفارش جدید</button>}
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input className="input pr-9" placeholder="جستجو شماره سفارش یا مشتری..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-auto" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">همه وضعیت‌ها</option>
          <option value="pending">در انتظار</option>
          <option value="confirmed">تأیید شده</option>
          <option value="converted">تبدیل به فاکتور</option>
          <option value="cancelled">لغو شده</option>
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-4 text-center"><div className="text-2xl font-bold text-slate-800">{toFaDigits(orders.length)}</div><div className="text-xs text-slate-500">کل سفارش‌ها</div></div>
        <div className="card p-4 text-center"><div className="text-2xl font-bold text-yellow-600">{toFaDigits(orders.filter(o => o.status === "pending").length)}</div><div className="text-xs text-slate-500">در انتظار</div></div>
        <div className="card p-4 text-center"><div className="text-2xl font-bold text-blue-600">{toFaDigits(orders.filter(o => o.status === "confirmed").length)}</div><div className="text-xs text-slate-500">تأیید شده</div></div>
        <div className="card p-4 text-center"><div className="text-2xl font-bold text-emerald-600">{formatToman(orders.filter(o => o.status !== "cancelled").reduce((sum, o) => sum + (o.total || 0), 0))}</div><div className="text-xs text-slate-500">مجموع</div></div>
      </div>

      {loading ? <Spinner label="در حال بارگذاری..." /> :
       filteredOrders.length === 0 ? (
        <EmptyState icon={ClipboardList} title="سفارشی یافت نشد" description="اولین سفارش فروش خود را ثبت کنید" action={<button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary"><Plus size={16} /> سفارش جدید</button>} />
      ) : (
        <div className="space-y-3">
          {filteredOrders.map(order => {
            const statusInfo = STATUS_LABELS[order.status] || STATUS_LABELS.pending;
            return (
              <div key={order.id} className="card p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-bold text-slate-800">{order.order_no || "بدون شماره"}</span>
                      <span className={`badge ${statusInfo.color}`}>{statusInfo.label}</span>
                    </div>
                    <div className="text-sm text-slate-600 mb-1">
                      {order.customer_id ? (
                        <span className="inline-flex items-center gap-2">
                          <EntityLink type="contact" id={order.customer_id}>{order.customer?.name ?? "مشتری"}</EntityLink>
                          <EntityActionMenu type="contact" id={order.customer_id} label={order.customer?.name ?? "مشتری"} />
                        </span>
                      ) : (
                        <span className="text-slate-400">بدون مشتری</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span>{toJalali(order.date)}</span>
                      {order.expiry_date && <span>انقضا: {toJalali(order.expiry_date)}</span>}
                    </div>
                  </div>
                  <div className="text-left">
                    <div className="text-lg font-bold text-slate-800">{formatToman(order.total)}</div>
                    <div className="text-xs text-slate-400">تومان</div>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-slate-100">
                  {order.status === "pending" && (
                    <button onClick={() => updateOrderStatus(order.id, "confirmed")} className="btn-secondary text-sm">تأیید</button>
                  )}
                  {order.status !== "converted" && order.status !== "cancelled" && (
                    <button onClick={() => openEdit(order)} className="btn-secondary text-sm"><Edit size={14} /></button>
                  )}
                  <button onClick={() => deleteOrder(order.id)} className="btn-danger text-sm"><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <Modal open onClose={() => setShowForm(false)} title={selectedOrder ? "ویرایش سفارش" : "سفارش فروش جدید"} size="lg">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">مشتری</label>
                <select className="input" value={customerId} onChange={e => setCustomerId(e.target.value)}>
                  <option value="">انتخاب مشتری...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">تاریخ انقضا</label>
                <input type="date" className="input" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">آیتم‌های سفارش</label>
                <button type="button" onClick={() => setShowProductSearch(!showProductSearch)} className="text-brand-600 text-sm font-medium">+ افزودن کالا</button>
              </div>
              {showProductSearch && (
                <div className="mb-3 p-3 bg-slate-50 rounded-xl">
                  <input className="input mb-2" placeholder="جستجوی کالا..." value={productSearch} onChange={e => setProductSearch(e.target.value)} />
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {items.map(item => (
                      item.variants?.map((v: any) => (
                        <div key={v.id} className="flex items-center justify-between p-2 bg-white rounded-lg">
                          <div className="text-sm"><div className="font-medium">{item.name}</div><div className="text-xs text-slate-400">{v.color && `رنگ: ${v.color}`} {v.size && `سایز: ${v.size}`}</div></div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{formatToman(v.sale_price)}</span>
                            <button type="button" onClick={() => { setItems([...items.filter(i => i.variant_id !== v.id), { ...v, product_id: item.id, product_name: item.name, qty: 1, price: v.sale_price }]); setShowProductSearch(false); setProductSearch(""); }} className="btn-primary py-1 px-2 text-xs"><Plus size={12} /></button>
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
                      <div className="inline-flex items-center gap-2 text-sm font-medium">
                        <EntityLink type="product" id={item.product_id}>{item.product_name}</EntityLink>
                        <EntityActionMenu type="product" id={item.product_id} label={item.product_name} />
                      </div>
                      <div className="text-xs text-slate-400">{item.color && `رنگ: ${item.color}`} {item.size && `سایز: ${item.size}`}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="number" min="1" value={item.qty} onChange={e => { const newItems = [...items]; newItems[idx].qty = parseInt(e.target.value) || 1; setItems(newItems); }} className="input w-16 text-center" />
                      <span className="text-sm">{formatToman(item.price * item.qty)}</span>
                      <button type="button" onClick={() => setItems(items.map((i, j) => j === idx ? { ...i, qty: 0 } : i))} className="text-rose-500 hover:text-rose-700"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="label">تخفیف (تومان)</label>
              <input type="number" className="input" value={discount} onChange={e => setDiscount(e.target.value)} />
            </div>

            <div>
              <label className="label">توضیحات</label>
              <textarea className="input" rows={2} value={note} onChange={e => setNote(e.target.value)} />
            </div>

            <div className="flex items-center justify-between p-4 bg-brand-50 rounded-xl">
              <span className="font-medium">جمع کل:</span>
              <span className="text-xl font-bold text-brand-700">{formatToman(items.filter(i => i.qty > 0).reduce((sum, i) => sum + (i.qty * i.price), 0) - (parseInt(discount) || 0))}</span>
            </div>

            <div className="flex gap-2">
              <button onClick={createOrder} disabled={saving} className="btn-primary flex-1">{saving ? "در حال ذخیره..." : "ثبت سفارش"}</button>
              <button onClick={() => setShowForm(false)} className="btn-secondary">انصراف</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}