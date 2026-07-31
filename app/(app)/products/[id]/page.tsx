"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { usePanelManager } from "@/src/core/panel-manager/panel-manager.store";
import { Spinner, EmptyState } from "@/components/shared/ui";
import { EntityLink } from "@/components/shared/entity-link";
import { EntityActionMenu } from "@/components/shared/entity-action-menu";
import { formatToman, toFaDigits, toJalali } from "@/lib/utils/format";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight, Package, Pencil, Tag,
  ArrowDownCircle, ShoppingBag, Truck, ArrowLeftRight,
} from "lucide-react";
import { getActionParam } from "@/lib/entities/action-router";

export default function ProductDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { openEntity } = usePanelManager();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<"info" | "movements" | "sales" | "purchases">("info");

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
    if (action === "edit") openEntity("product", id, { mode: "edit", context: "workspace" });
    if (action === "price") openEntity("product", id, { mode: "view", context: "workspace", props: { initialTab: "price-history" } });
    if (action === "adjust-stock") openEntity("product", id, { mode: "view", context: "workspace", props: { initialTab: "variants" } });
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

  function openProductPanel(mode: "view" | "edit", initialTab?: string) {
    openEntity("product", product.id, { mode, context: "workspace", title: product.name, props: initialTab ? { initialTab } : undefined });
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <Link href="/products" className="flex items-center gap-1 text-muted-foreground text-sm hover:text-primary">
          <ArrowRight size={18} /> بازگشت
        </Link>
        <div className="flex gap-2">
          <EntityActionMenu type="product" id={product.id} label={product.name} />
          <button onClick={() => openProductPanel("edit")} className="btn-secondary flex items-center gap-2 text-sm">
            <Pencil size={16} /> ویرایش
          </button>
          <button onClick={() => openProductPanel("view", "variants")} className="btn-primary flex items-center gap-2 text-sm">
            <ArrowDownCircle size={16} /> تعدیل موجودی
          </button>
        </div>
      </div>

      {/* کارت اصلی */}
      <div className="card p-6 mb-4">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/[0.06] text-primary flex items-center justify-center shrink-0">
            <Package size={28} />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">{product.name}</h1>
            <div className="flex flex-wrap gap-2 mt-1 text-sm text-muted-foreground">
              {product.code && <span className="font-mono bg-muted px-2 py-0.5 rounded">کد: {product.code}</span>}
              {product.category?.name && <span>دسته: {product.category.name}</span>}
              {product.brand?.name && <span>برند: {product.brand.name}</span>}
              {product.season && <span>فصل: {product.season}</span>}
            </div>
          </div>
          <div className={`text-right shrink-0 ${low ? "text-warning-onSoft" : "text-success-onSoft"}`}>
            <div className="text-2xl font-bold">{toFaDigits(totalStock)}</div>
            <div className="text-xs text-muted-foreground">موجودی</div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <div className="bg-muted rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-foreground">{formatToman(totalStock * (product.base_sale_price ?? 0), false)}</div>
            <div className="text-xs text-muted-foreground">ارزش موجودی</div>
          </div>
          <div className="bg-success-soft rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-success-onSoft">{formatToman(totalSales, false)}</div>
            <div className="text-xs text-success-onSoft">مجموع فروش</div>
          </div>
          <div className="bg-info-soft rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-info-onSoft">{formatToman(profit, false)}</div>
            <div className="text-xs text-info-onSoft">سود</div>
          </div>
          <div className="bg-muted rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-foreground">{toFaDigits((saleItems ?? []).length)}</div>
            <div className="text-xs text-muted-foreground">مرتبه فروش</div>
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
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition ${activeTab === tab.id ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted"}`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* محتوای تب‌ها */}
      {activeTab === "info" && (
        <ProductInfo product={product} variants={variants} onEdit={() => openProductPanel("edit")} />
      )}
      {activeTab === "movements" && <MovementsList movements={movements ?? []} />}
      {activeTab === "sales" && <SalesList items={saleItems ?? []} />}
      {activeTab === "purchases" && <PurchasesList items={purchaseItems ?? []} />}
    </div>
  );
}

function ProductInfo({ product, variants, onEdit }: { product: any; variants: any[]; onEdit: () => void }) {
  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">اطلاعات کالا</h3>
          <button onClick={onEdit} className="text-sm text-primary hover:underline">ویرایش</button>
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
            <div key={i} className="p-3 bg-muted rounded-xl">
              <div className="text-xs text-muted-foreground mb-1">{item.label}</div>
              <div className="font-medium text-sm">{item.value}</div>
            </div>
          ))}
        </div>
        {product.description && <div className="mt-3 p-3 bg-muted rounded-xl text-sm"><span className="text-muted-foreground">توضیحات:</span> {product.description}</div>}
      </div>

      <div className="card overflow-x-auto">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-foreground flex items-center gap-2"><Tag size={16} /> تنوع‌ها ({toFaDigits(variants.length)})</h3>
        </div>
        {variants.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">تنوعی ثبت نشده</div>
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
                <tr key={v.id} className="hover:bg-muted">
                  <td className="font-medium">{v.color || "—"}</td>
                  <td>{v.size || "—"}</td>
                  <td className="font-mono text-xs text-muted-foreground">{v.sku || "—"}</td>
                  <td className="font-mono text-xs text-muted-foreground">{v.barcode || "—"}</td>
                  <td className="text-success-onSoft">{formatToman(v.purchase_price, false)}</td>
                  <td className="text-primary font-medium">{formatToman(v.sale_price, false)}</td>
                  <td className={`font-bold ${v.stock_qty <= (product.low_stock_threshold ?? 3) ? "text-warning-onSoft" : "text-success-onSoft"}`}>{toFaDigits(v.stock_qty)}</td>
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
                <tr key={m.id} className="hover:bg-muted">
                  <td><span className={`badge ${isIn ? "bg-success-soft text-success-onSoft" : "bg-destructive/15 text-destructive"}`}>{isIn ? "ورود" : "خروج"}</span></td>
                  <td className="text-muted-foreground text-sm">{REASON_LABELS[m.reason] ?? m.reason}</td>
                  <td className={`font-bold ${isIn ? "text-success-onSoft" : "text-destructive"}`}>{isIn ? "+" : ""}{toFaDigits(m.qty)}</td>
                  <td className="text-muted-foreground text-sm max-w-[150px] truncate">{m.note ?? "—"}</td>
                  <td className="text-muted-foreground text-sm">{toJalali(m.created_at)}</td>
                  <td>{m.ref_table === "sales" && m.ref_id ? <Link href={`/sales/${m.ref_id}`} className="text-primary text-sm hover:underline">فاکتور فروش</Link> : "—"}</td>
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
        <div className="card p-4 text-center"><div className="text-xl font-bold text-success-onSoft">{formatToman(total, false)}</div><div className="text-xs text-muted-foreground">مجموع فروش</div></div>
        <div className="card p-4 text-center"><div className="text-xl font-bold text-primary">{toFaDigits(qty)}</div><div className="text-xs text-muted-foreground">تعداد فروخته</div></div>
        <div className="card p-4 text-center"><div className="text-xl font-bold text-muted-foreground">{toFaDigits(items.length)}</div><div className="text-xs text-muted-foreground">فاکتور</div></div>
      </div>
      <div className="card overflow-x-auto">
        {items.length === 0 ? <EmptyState title="فروشی ثبت نشده" />
         : (
          <table className="table-base">
            <thead><tr><th>فاکتور</th><th>مشتری</th><th>تعداد</th><th>قیمت</th><th>جمع</th><th>تاریخ</th></tr></thead>
            <tbody>
              {items.map((it: any, idx: number) => (
                <tr key={idx} className="hover:bg-muted">
                  <td>{it.sale ? <EntityLink type="sale" id={it.sale.id}>{it.sale.invoice_no}</EntityLink> : "—"}</td>
                  <td>{it.sale?.customer_id ? <EntityLink type="contact" id={it.sale.customer_id}>{it.sale?.customer?.name ?? "مشتری"}</EntityLink> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="font-medium">{toFaDigits(it.qty)}</td>
                  <td className="text-primary">{formatToman(it.unit_price, false)}</td>
                  <td className="font-medium">{formatToman(it.line_total, false)}</td>
                  <td className="text-muted-foreground text-sm">{toJalali(it.created_at)}</td>
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
        <div className="card p-4 text-center"><div className="text-xl font-bold text-success-onSoft">{formatToman(total, false)}</div><div className="text-xs text-muted-foreground">مجموع خرید</div></div>
        <div className="card p-4 text-center"><div className="text-xl font-bold text-primary">{toFaDigits(qty)}</div><div className="text-xs text-muted-foreground">تعداد خریداری</div></div>
        <div className="card p-4 text-center"><div className="text-xl font-bold text-muted-foreground">{toFaDigits(items.length)}</div><div className="text-xs text-muted-foreground">فاکتور</div></div>
      </div>
      <div className="card overflow-x-auto">
        {items.length === 0 ? <EmptyState title="خریدی ثبت نشده" />
         : (
          <table className="table-base">
            <thead><tr><th>فاکتور</th><th>تامین‌کننده</th><th>تعداد</th><th>قیمت</th><th>جمع</th><th>تاریخ</th></tr></thead>
            <tbody>
              {items.map((it: any, idx: number) => (
                <tr key={idx} className="hover:bg-muted">
                  <td>{it.purchase?.id ? <EntityLink type="purchase" id={it.purchase.id}>{it.purchase?.invoice_no ?? "خرید"}</EntityLink> : <span className="text-muted-foreground">—</span>}</td>
                  <td>{it.purchase?.supplier_id ? <EntityLink type="contact" id={it.purchase.supplier_id}>{it.purchase?.supplier?.name ?? "تامین‌کننده"}</EntityLink> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="font-medium">{toFaDigits(it.qty)}</td>
                  <td className="text-muted-foreground">{formatToman(it.unit_price, false)}</td>
                  <td className="font-medium">{formatToman(it.line_total, false)}</td>
                  <td className="text-muted-foreground text-sm">{toJalali(it.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
