"use client";

import { use, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { Spinner, Modal, EmptyState } from "@/components/shared/ui";
import { EntityLink } from "@/components/shared/entity-link";
import { EntityActionMenu } from "@/components/shared/entity-action-menu";
import { formatToman, toFaDigits, toJalali, toEnDigits, rialToToman, tomanToRial } from "@/lib/utils/format";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight, Package, Pencil, Loader2, Tag,
  ArrowDownCircle, ArrowUpCircle, ShoppingBag, Truck, ArrowLeftRight,
  X, Plus
} from "lucide-react";
import { getActionParam } from "@/lib/entities/action-router";
import { logActivity } from "@/lib/utils/activity-log";

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<"info" | "movements" | "sales" | "purchases">("info");
  const [editOpen, setEditOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);

  // اطلاعات محصول
  const { data: product, isLoading } = useQuery({
    queryKey: ["product-detail", id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("products")
        .select(`*, category:categories(name), brand:brands(name), product_variants(id, color, size, sku, barcode, purchase_price, sale_price, stock_qty, is_active)`)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  // گردش انبار این محصول (از طریق نام محصول)
  const { data: movements } = useQuery({
    queryKey: ["product-movements-by-name", id],
    enabled: !!product?.name,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("stock_movements")
        .select("id, type, reason, qty, note, created_at, ref_table, ref_id, variant_id")
        .order("created_at", { ascending: false })
        .limit(50);
      // فیلتر در سمت کلاینت - فقط تنوع‌های این محصول
      const variantIds = product?.product_variants?.map((v: any) => v.id) ?? [];
      return (data ?? []).filter((m: any) => variantIds.includes(m.variant_id));
    },
  });

  // فروش‌های این محصول
  const { data: saleItems } = useQuery({
    queryKey: ["product-sales", id],
    enabled: !!id,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("sale_items")
        .select("qty, unit_price, line_total, cost_price, created_at, variant_id, sale: sales(id, invoice_no, date, customer_id, customer:contacts(id, name))")
        .limit(100);
      if (!data) return [];
      // فقط اقلامی که متعلق به این محصول هستند
      const variantIds = product?.product_variants?.map((v: any) => v.id) ?? [];
      return data.filter((it: any) => variantIds.includes(it.variant_id));
    },
  });

  // خریدهای این محصول
  const { data: purchaseItems } = useQuery({
    queryKey: ["product-purchases", id],
    enabled: !!id,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("purchase_items")
        .select("qty, unit_price, line_total, created_at, variant_id, purchase: purchases(id, invoice_no, date, supplier_id, supplier:contacts(id, name))")
        .limit(100);
      if (!data) return [];
      const variantIds = product?.product_variants?.map((v: any) => v.id) ?? [];
      return data.filter((it: any) => variantIds.includes(it.variant_id));
    },
  });


  useEffect(() => {
    const action = getActionParam(searchParams);
    const tab = searchParams.get("tab");
    if (tab === "movements") setActiveTab("movements");
    if (action === "edit") setEditOpen(true);
    if (action === "price") setPriceOpen(true);
    if (action === "adjust-stock") setAdjustOpen(true);
    if (action === "movements" || action === "stock-history") setActiveTab("movements");
  }, [searchParams]);

  if (isLoading) return <Spinner label="در حال بارگذاری..." />;
  if (!product) return <EmptyState title="کالا یافت نشد" />;

  const variants = product.product_variants ?? [];
  const totalStock = variants.reduce((s: number, v: any) => s + (v.stock_qty ?? 0), 0);
  const totalSales = (saleItems ?? []).reduce((s: number, it: any) => s + (it.line_total ?? 0), 0);
  const totalCost = (saleItems ?? []).reduce((s: number, it: any) => s + ((it.cost_price ?? 0) * (it.qty ?? 0)), 0);
  const profit = totalSales - totalCost;
  const low = totalStock <= (product.low_stock_threshold ?? 3);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <Link href="/products" className="flex items-center gap-1 text-slate-500 text-sm hover:text-brand-600">
          <ArrowRight size={18} /> بازگشت
        </Link>
        <div className="flex gap-2">
          <EntityActionMenu type="product" id={product.id} label={product.name} />
          <button onClick={() => setEditOpen(true)} className="btn-secondary flex items-center gap-2 text-sm">
            <Pencil size={16} /> ویرایش
          </button>
          <button onClick={() => setAdjustOpen(true)} className="btn-primary flex items-center gap-2 text-sm">
            <ArrowDownCircle size={16} /> تعدیل موجودی
          </button>
        </div>
      </div>

      {/* کارت اصلی */}
      <div className="card p-6 mb-4">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
            <Package size={28} />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-800">{product.name}</h1>
            <div className="flex flex-wrap gap-2 mt-1 text-sm text-slate-500">
              {product.code && <span className="font-mono bg-slate-100 px-2 py-0.5 rounded">کد: {product.code}</span>}
              {product.category?.name && <span>دسته: {product.category.name}</span>}
              {product.brand?.name && <span>برند: {product.brand.name}</span>}
              {product.season && <span>فصل: {product.season}</span>}
            </div>
          </div>
          <div className={`text-right shrink-0 ${low ? "text-amber-600" : "text-emerald-600"}`}>
            <div className="text-2xl font-bold">{toFaDigits(totalStock)}</div>
            <div className="text-xs text-slate-400">موجودی</div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-slate-700">{formatToman(totalStock * (product.base_sale_price ?? 0), false)}</div>
            <div className="text-xs text-slate-400">ارزش موجودی</div>
          </div>
          <div className="bg-emerald-50 rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-emerald-600">{formatToman(totalSales, false)}</div>
            <div className="text-xs text-emerald-600">مجموع فروش</div>
          </div>
          <div className="bg-blue-50 rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-blue-600">{formatToman(profit, false)}</div>
            <div className="text-xs text-blue-600">سود</div>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-slate-700">{toFaDigits((saleItems ?? []).length)}</div>
            <div className="text-xs text-slate-400">مرتبه فروش</div>
          </div>
        </div>
      </div>

      {/* تب‌ها */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {[
          { id: "info", label: "اطلاعات", icon: <Package size={15} /> },
          { id: "movements", label: `گردش انبار (${toFaDigits(movements?.length ?? 0)})`, icon: <ArrowLeftRight size={15} /> },
          { id: "sales", label: `فروش‌ها (${toFaDigits(saleItems?.length ?? 0)})`, icon: <ShoppingBag size={15} /> },
          { id: "purchases", label: `خریدها (${toFaDigits(purchaseItems?.length ?? 0)})`, icon: <Truck size={15} /> },
        ].map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition ${activeTab === tab.id ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* محتوای تب‌ها */}
      {activeTab === "info" && (
        <ProductInfo product={product} variants={variants} onEdit={() => setEditOpen(true)} />
      )}
      {activeTab === "movements" && <MovementsList movements={movements ?? []} />}
      {activeTab === "sales" && <SalesList items={saleItems ?? []} />}
      {activeTab === "purchases" && <PurchasesList items={purchaseItems ?? []} />}

      {editOpen && <ProductEditModal product={product} onClose={() => setEditOpen(false)} onSaved={() => { setEditOpen(false); qc.invalidateQueries({ queryKey: ["product-detail", id] }); qc.invalidateQueries({ queryKey: ["products"] }); qc.invalidateQueries({ queryKey: ["entity", "product"] }); }} />}
      {priceOpen && <PriceChangeModal product={product} variants={variants} onClose={() => setPriceOpen(false)} onSaved={() => { setPriceOpen(false); qc.invalidateQueries({ queryKey: ["product-detail", id] }); qc.invalidateQueries({ queryKey: ["products"] }); qc.invalidateQueries({ queryKey: ["entity", "product"] }); }} />}
      {adjustOpen && <AdjustModal product={product} variants={variants} onClose={() => setAdjustOpen(false)} onSaved={() => { setAdjustOpen(false); qc.invalidateQueries({ queryKey: ["product-detail", id] }); qc.invalidateQueries({ queryKey: ["products"] }); qc.invalidateQueries({ queryKey: ["entity", "product"] }); }} />}
    </div>
  );
}

function ProductInfo({ product, variants, onEdit }: { product: any; variants: any[]; onEdit: () => void }) {
  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-700">اطلاعات کالا</h3>
          <button onClick={onEdit} className="text-sm text-brand-600 hover:underline">ویرایش</button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "نام", value: product.name },
            { label: "کد", value: product.code || "—" },
            { label: "دسته", value: product.category?.name || "—" },
            { label: "برند", value: product.brand?.name || "—" },
            { label: "فصل", value: product.season || "—" },
            { label: "جنس", value: product.material || "—" },
            { label: "حد کم‌موجودی", value: toFaDigits(product.low_stock_threshold ?? 3) },
            { label: "قیمت پایه فروش", value: formatToman(product.base_sale_price ?? 0, false) },
          ].map((item, i) => (
            <div key={i} className="p-3 bg-slate-50 rounded-xl">
              <div className="text-xs text-slate-400 mb-1">{item.label}</div>
              <div className="font-medium text-sm">{item.value}</div>
            </div>
          ))}
        </div>
        {product.description && <div className="mt-3 p-3 bg-slate-50 rounded-xl text-sm"><span className="text-slate-400">توضیحات:</span> {product.description}</div>}
      </div>

      <div className="card overflow-x-auto">
        <div className="p-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-700 flex items-center gap-2"><Tag size={16} /> تنوع‌ها ({toFaDigits(variants.length)})</h3>
        </div>
        {variants.length === 0 ? (
          <div className="p-8 text-center text-slate-400">تنوعی ثبت نشده</div>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>رنگ</th><th>سایز</th><th>SKU</th><th>بارکد</th>
                <th>قیمت خرید</th><th>قیمت فروش</th><th>موجودی</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v: any) => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <td className="font-medium">{v.color || "—"}</td>
                  <td>{v.size || "—"}</td>
                  <td className="font-mono text-xs text-slate-400">{v.sku || "—"}</td>
                  <td className="font-mono text-xs text-slate-400">{v.barcode || "—"}</td>
                  <td className="text-emerald-600">{formatToman(v.purchase_price, false)}</td>
                  <td className="text-brand-600 font-medium">{formatToman(v.sale_price, false)}</td>
                  <td className={`font-bold ${v.stock_qty <= (product.low_stock_threshold ?? 3) ? "text-amber-600" : "text-emerald-600"}`}>{toFaDigits(v.stock_qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const REASON_LABELS: Record<string, string> = { purchase: "خرید", sale: "فروش", manual: "دستی", count: "شمارش", transfer: "انتقال", return: "مرجوعی", opening: "اول دوره" };

function MovementsList({ movements }: { movements: any[] }) {
  return (
    <div className="card overflow-x-auto">
      {movements.length === 0 ? <EmptyState title="گردشی ثبت نشده" message="هنوز حرکتی برای این محصول ثبت نشده است." />
       : (
        <table className="table-base">
          <thead><tr><th>نوع</th><th>دلیل</th><th>تعداد</th><th>توضیح</th><th>تاریخ</th><th>فاکتور</th></tr></thead>
          <tbody>
            {movements.map((m: any) => {
              const isIn = m.qty >= 0;
              return (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td><span className={`badge ${isIn ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{isIn ? "ورود" : "خروج"}</span></td>
                  <td className="text-slate-500 text-sm">{REASON_LABELS[m.reason] ?? m.reason}</td>
                  <td className={`font-bold ${isIn ? "text-emerald-600" : "text-rose-600"}`}>{isIn ? "+" : ""}{toFaDigits(m.qty)}</td>
                  <td className="text-slate-400 text-sm max-w-[150px] truncate">{m.note ?? "—"}</td>
                  <td className="text-slate-500 text-sm">{toJalali(m.created_at)}</td>
                  <td>{m.ref_table === "sales" && m.ref_id ? <Link href={`/sales/${m.ref_id}`} className="text-brand-600 text-sm hover:underline">فاکتور فروش</Link> : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function SalesList({ items }: { items: any[] }) {
  const total = items.reduce((s: number, it: any) => s + (it.line_total ?? 0), 0);
  const qty = items.reduce((s: number, it: any) => s + (it.qty ?? 0), 0);
  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="card p-4 text-center"><div className="text-xl font-bold text-emerald-600">{formatToman(total, false)}</div><div className="text-xs text-slate-500">مجموع فروش</div></div>
        <div className="card p-4 text-center"><div className="text-xl font-bold text-brand-600">{toFaDigits(qty)}</div><div className="text-xs text-slate-500">تعداد فروخته</div></div>
        <div className="card p-4 text-center"><div className="text-xl font-bold text-slate-600">{toFaDigits(items.length)}</div><div className="text-xs text-slate-500">فاکتور</div></div>
      </div>
      <div className="card overflow-x-auto">
        {items.length === 0 ? <EmptyState title="فروشی ثبت نشده" />
         : (
          <table className="table-base">
            <thead><tr><th>فاکتور</th><th>مشتری</th><th>تعداد</th><th>قیمت</th><th>جمع</th><th>تاریخ</th></tr></thead>
            <tbody>
              {items.map((it: any, idx: number) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td>{it.sale ? <EntityLink type="sale" id={it.sale.id}>{it.sale.invoice_no}</EntityLink> : "—"}</td>
                  <td>{it.sale?.customer_id ? <EntityLink type="contact" id={it.sale.customer_id}>{it.sale?.customer?.name ?? "مشتری"}</EntityLink> : <span className="text-slate-400">—</span>}</td>
                  <td className="font-medium">{toFaDigits(it.qty)}</td>
                  <td className="text-brand-600">{formatToman(it.unit_price, false)}</td>
                  <td className="font-medium">{formatToman(it.line_total, false)}</td>
                  <td className="text-slate-500 text-sm">{toJalali(it.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function PurchasesList({ items }: { items: any[] }) {
  const total = items.reduce((s: number, it: any) => s + (it.line_total ?? 0), 0);
  const qty = items.reduce((s: number, it: any) => s + (it.qty ?? 0), 0);
  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="card p-4 text-center"><div className="text-xl font-bold text-emerald-600">{formatToman(total, false)}</div><div className="text-xs text-slate-500">مجموع خرید</div></div>
        <div className="card p-4 text-center"><div className="text-xl font-bold text-brand-600">{toFaDigits(qty)}</div><div className="text-xs text-slate-500">تعداد خریداری</div></div>
        <div className="card p-4 text-center"><div className="text-xl font-bold text-slate-600">{toFaDigits(items.length)}</div><div className="text-xs text-slate-500">فاکتور</div></div>
      </div>
      <div className="card overflow-x-auto">
        {items.length === 0 ? <EmptyState title="خریدی ثبت نشده" />
         : (
          <table className="table-base">
            <thead><tr><th>فاکتور</th><th>تامین‌کننده</th><th>تعداد</th><th>قیمت</th><th>جمع</th><th>تاریخ</th></tr></thead>
            <tbody>
              {items.map((it: any, idx: number) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td>{it.purchase?.id ? <EntityLink type="purchase" id={it.purchase.id}>{it.purchase?.invoice_no ?? "خرید"}</EntityLink> : <span className="text-slate-400">—</span>}</td>
                  <td>{it.purchase?.supplier_id ? <EntityLink type="contact" id={it.purchase.supplier_id}>{it.purchase?.supplier?.name ?? "تامین‌کننده"}</EntityLink> : <span className="text-slate-400">—</span>}</td>
                  <td className="font-medium">{toFaDigits(it.qty)}</td>
                  <td className="text-slate-600">{formatToman(it.unit_price, false)}</td>
                  <td className="font-medium">{formatToman(it.line_total, false)}</td>
                  <td className="text-slate-500 text-sm">{toJalali(it.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// مودال تغییر قیمت
function PriceChangeModal({ product, variants, onClose, onSaved }: { product: any; variants: any[]; onClose: () => void; onSaved: () => void }) {
  const [purchasePrice, setPurchasePrice] = useState(String(rialToToman(product.base_purchase_price ?? variants[0]?.purchase_price ?? 0)));
  const [salePrice, setSalePrice] = useState(String(rialToToman(product.base_sale_price ?? variants[0]?.sale_price ?? 0)));
  const [applyToVariants, setApplyToVariants] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const purchaseRial = tomanToRial(Number(toEnDigits(purchasePrice)) || 0);
    const saleRial = tomanToRial(Number(toEnDigits(salePrice)) || 0);
    setSaving(true);
    const supabase = createClient();
    try {
      const { error: priceError } = await supabase.rpc("change_product_price", {
        p_product: product.id,
        p_purchase_price: purchaseRial,
        p_sale_price: saleRial,
        p_apply_variants: applyToVariants,
        p_reason: "تغییر قیمت از جزئیات کالا",
      });
      if (priceError) throw priceError;
      await logActivity({ orgId: product.org_id, action: "price_change", entityType: "product", entityId: product.id, newData: { purchase_price: purchaseRial, sale_price: saleRial, apply_variants: applyToVariants } });
      onSaved();
    } catch (err) {
      setError("خطا: " + (err as Error).message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="تغییر قیمت کالا" size="md">
      <div className="space-y-4">
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="font-medium text-slate-800">{product.name}</div>
          <div className="text-xs text-slate-400 mt-1">{toFaDigits(variants.length)} تنوع فعال/ثبت‌شده</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><label className="label">قیمت خرید (تومان)</label><input className="input" inputMode="numeric" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} /></div>
          <div><label className="label">قیمت فروش (تومان)</label><input className="input" inputMode="numeric" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} /></div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={applyToVariants} onChange={(e) => setApplyToVariants(e.target.checked)} />
          اعمال قیمت روی همه تنوع‌های فعال کالا
        </label>
        {error && <div className="rounded-xl bg-rose-50 text-rose-700 text-sm px-4 py-3">{error}</div>}
        <div className="flex gap-2"><button onClick={save} disabled={saving} className="btn-primary flex-1">{saving&&<Loader2 className="animate-spin" size={18}/>} ذخیره قیمت</button><button onClick={onClose} className="btn-secondary">انصراف</button></div>
      </div>
    </Modal>
  );
}

// مودال ویرایش
function ProductEditModal({ product, onClose, onSaved }: { product: any; onClose: () => void; onSaved: () => void }) {
  const { data: categories } = useQuery({ queryKey: ["m-cats"], queryFn: async () => { const s = createClient(); const { data } = await s.from("categories").select("id,name").eq("is_active",true).order("name"); return data ?? []; } });
  const { data: brands } = useQuery({ queryKey: ["m-brands"], queryFn: async () => { const s = createClient(); const { data } = await s.from("brands").select("id,name").eq("is_active",true).order("name"); return data ?? []; } });
  const [name, setName] = useState(product.name); const [code, setCode] = useState(product.code ?? "");
  const [season, setSeason] = useState(product.season ?? ""); const [material, setMaterial] = useState(product.material ?? "");
  const [desc, setDesc] = useState(product.description ?? ""); const [catId, setCatId] = useState(product.category_id ?? "");
  const [brId, setBrId] = useState(product.brand_id ?? ""); const [low, setLow] = useState(String(product.low_stock_threshold ?? 3));
  const [saving, setSaving] = useState(false); const [error, setError] = useState<string|null>(null);

  async function save() {
    if (!name.trim()) { setError("نام الزامی است."); return; }
    setSaving(true); const supabase = createClient();
    try { await supabase.from("products").update({ name: name.trim(), code: code.trim()||null, season: season.trim()||null, material: material.trim()||null, description: desc.trim()||null, category_id: catId||null, brand_id: brId||null, low_stock_threshold: Number(toEnDigits(low))||0 }).eq("id", product.id); onSaved(); }
    catch (err) { setError("خطا: " + (err as Error).message); setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title="ویرایش کالا" size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">نام *</label><input className="input" value={name} onChange={e=>setName(e.target.value)} /></div>
          <div><label className="label">کد</label><input className="input text-left" dir="ltr" value={code} onChange={e=>setCode(e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">دسته</label><select className="input" value={catId} onChange={e=>setCatId(e.target.value)}><option value="">—</option>{categories?.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><label className="label">برند</label><select className="input" value={brId} onChange={e=>setBrId(e.target.value)}><option value="">—</option>{brands?.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">فصل</label><select className="input" value={season} onChange={e=>setSeason(e.target.value)}><option value="">—</option><option value="بهار">بهار</option><option value="تابستان">تابستان</option><option value="پاییز">پاییز</option><option value="زمستان">زمستان</option><option value="چهارفصل">چهارفصل</option></select></div>
          <div><label className="label">جنس</label><input className="input" value={material} onChange={e=>setMaterial(e.target.value)} /></div>
        </div>
        <div><label className="label">حد کم‌موجودی</label><input className="input" inputMode="numeric" value={low} onChange={e=>setLow(e.target.value)} /></div>
        <div><label className="label">توضیحات</label><textarea className="input" rows={2} value={desc} onChange={e=>setDesc(e.target.value)} /></div>
        {error && <div className="rounded-xl bg-rose-50 text-rose-700 text-sm px-4 py-3">{error}</div>}
        <div className="flex gap-2"><button onClick={save} disabled={saving} className="btn-primary flex-1">{saving&&<Loader2 className="animate-spin" size={18}/>} ذخیره</button><button onClick={onClose} className="btn-secondary">انصراف</button></div>
      </div>
    </Modal>
  );
}

// مودال تعدیل موجودی
function AdjustModal({ product, variants, onClose, onSaved }: { product: any; variants: any[]; onClose: () => void; onSaved: () => void }) {
  const { orgId, branchId } = useOrg();
  const [vals, setVals] = useState<Record<string,string>>(Object.fromEntries(variants.map((v:any) => [v.id, String(v.stock_qty)])));
  const [note, setNote] = useState(""); const [saving, setSaving] = useState(false); const [error, setError] = useState<string|null>(null);

  async function save() {
    if (!orgId) return;
    setSaving(true); const supabase = createClient();
    try {
      for (const v of variants) {
        const diff = (Number(toEnDigits(vals[v.id])) || 0) - (v.stock_qty ?? 0);
        if (diff !== 0) {
          const { error: movementError } = await supabase.from("stock_movements").insert({ org_id: orgId, branch_id: branchId, variant_id: v.id, type: "adjust", reason: "count", qty: diff, note: note.trim() || "تعدیل" });
          if (movementError) throw movementError;
          await logActivity({ orgId, action: "stock_adjust", entityType: "product", entityId: product.id, newData: { variant_id: v.id, qty: diff, note: note.trim() || "تعدیل" } });
        }
      }
      onSaved();
    } catch (err) { setError("خطا: " + (err as Error).message); setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title="تعدیل موجودی" size="lg">
      <div className="space-y-4">
        <div className="text-sm text-slate-500">مقدار فعلی را تغییر دهید:</div>
        {variants.map((v: any) => (
          <div key={v.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
            <div className="flex-1"><div className="font-medium text-sm">{[v.color, v.size].filter(Boolean).join(" / ") || "ساده"}</div><div className="text-xs text-slate-400">فعلی: {toFaDigits(v.stock_qty)}</div></div>
            <input className="input w-24 text-center" inputMode="numeric" value={vals[v.id] ?? "0"} onChange={e=>setVals(p=>({...p,[v.id]:e.target.value}))} />
          </div>
        ))}
        <div><label className="label">توضیح</label><input className="input" value={note} onChange={e=>setNote(e.target.value)} placeholder="مثلاً: انبارگردانی" /></div>
        {error && <div className="rounded-xl bg-rose-50 text-rose-700 text-sm px-4 py-3">{error}</div>}
        <div className="flex gap-2"><button onClick={save} disabled={saving} className="btn-primary flex-1">{saving&&<Loader2 className="animate-spin" size={18}/>} ثبت تعدیل</button><button onClick={onClose} className="btn-secondary">انصراف</button></div>
      </div>
    </Modal>
  );
}
