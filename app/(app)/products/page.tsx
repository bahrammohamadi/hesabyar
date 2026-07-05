"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useOrg } from "@/lib/hooks/useOrg";
import { usePanelManager } from "@/src/core/panel-manager/panel-manager.store";
import { useProducts } from "@/lib/hooks/useProducts";
import { PageHeader, Spinner, EmptyState } from "@/components/shared/ui";
import { EntityActionMenu } from "@/components/shared/entity-action-menu";
import { formatToman, toFaDigits } from "@/lib/utils/format";
import { Plus, Search, Package, Pencil } from "lucide-react";


export default function ProductsPage() {
  const { orgId } = useOrg();
  const { openEntity } = usePanelManager();
  const searchParams = useSearchParams();
  const autoOpenCreateRef = useRef(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "name_asc" | "name_desc" | "stock_high" | "stock_low" | "price_high" | "price_low">("newest");
  const { data: products, isLoading } = useProducts(orgId, search);
  const sortedProducts = [...(products ?? [])].sort((a, b) => {
    const stockA = a.product_variants.reduce((sum, variant) => sum + variant.stock_qty, 0);
    const stockB = b.product_variants.reduce((sum, variant) => sum + variant.stock_qty, 0);
    const priceA = a.base_sale_price ?? 0;
    const priceB = b.base_sale_price ?? 0;
    if (sortBy === "name_asc") return a.name.localeCompare(b.name, "fa");
    if (sortBy === "name_desc") return b.name.localeCompare(a.name, "fa");
    if (sortBy === "stock_high") return stockB - stockA;
    if (sortBy === "stock_low") return stockA - stockB;
    if (sortBy === "price_high") return priceB - priceA;
    if (sortBy === "price_low") return priceA - priceB;
    return 0;
  });
  function openNew() {
    openEntity("product", undefined, { mode: "create", context: "workspace", title: "کالای جدید" });
  }

  function openEdit(id: string, name?: string | null) {
    openEntity("product", id, { mode: "edit", context: "workspace", title: name ?? undefined });
  }

  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "new" && !autoOpenCreateRef.current) {
      autoOpenCreateRef.current = true;
      openNew();
    }
    if (action !== "new") autoOpenCreateRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function openProduct(id: string, name?: string | null) {
    openEntity("product", id, { mode: "view", context: "workspace", title: name ?? undefined });
  }

  function handleProductRowClick(event: MouseEvent<HTMLElement>, id: string, name?: string | null) {
    if (event.defaultPrevented) return;
    const href = `/products/${id}`;
    if (event.metaKey || event.ctrlKey) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    openProduct(id, name);
  }

  function handleProductRowAuxClick(event: MouseEvent<HTMLElement>, id: string) {
    if (event.button === 1) {
      event.preventDefault();
      window.open(`/products/${id}`, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div>
      <PageHeader
        title="کالا و انبار"
        subtitle="مدیریت محصولات، تنوع‌ها (رنگ/سایز) و موجودی"
        action={
          <button onClick={openNew} className="btn-primary">
            <Plus size={18} />
            <span className="hidden sm:inline">کالای جدید</span>
          </button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            className="input pr-10"
            placeholder="جستجوی نام، کد، بارکد یا SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input sm:w-48" value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
          <option value="newest">جدیدترین</option>
          <option value="name_asc">نام A-Z</option>
          <option value="name_desc">نام Z-A</option>
          <option value="stock_high">موجودی بیشتر</option>
          <option value="stock_low">موجودی کمتر</option>
          <option value="price_high">قیمت بیشتر</option>
          <option value="price_low">قیمت کمتر</option>
        </select>
      </div>

      {isLoading ? (
        <Spinner label="در حال بارگذاری کالاها..." />
      ) : !products || products.length === 0 ? (
        <EmptyState
          title="هنوز کالایی ثبت نشده"
          description="اولین کالای خود را اضافه کنید یا از فایل اکسل وارد کنید."
          action={
            <button onClick={openNew} className="btn-primary">
              <Plus size={18} /> کالای جدید
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {sortedProducts.map((p) => {
            const totalStock = p.product_variants.reduce((s, v) => s + v.stock_qty, 0);
            const low = totalStock <= p.low_stock_threshold;
            return (
              <div
                key={p.id}
                role="link"
                tabIndex={0}
                onClick={(event) => handleProductRowClick(event, p.id, p.name)}
                onAuxClick={(event) => handleProductRowAuxClick(event, p.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") openProduct(p.id, p.name);
                }}
                className="card p-4 cursor-pointer border-white/80 bg-white/90 shadow-sm shadow-slate-900/[0.03] transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-slate-900/[0.06]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-sm">
                      <Package size={21} />
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={`/products/${p.id}`}
                        className="block truncate font-semibold text-primary hover:underline"
                        onClick={(event) => {
                          if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) return;
                          event.preventDefault();
                          event.stopPropagation();
                          openProduct(p.id, p.name);
                        }}
                      >
                        {p.name}
                      </Link>
                      <div className="text-xs text-slate-400 mt-0.5 flex flex-wrap gap-x-2">
                        {p.code && <span className="font-mono text-primary">{p.code}</span>}
                        {p.brand?.name && <span>برند: {p.brand.name}</span>}
                        {p.category?.name && <span>دسته: {p.category.name}</span>}
                        {p.season && <span>فصل: {p.season}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`badge ${
                        low ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      موجودی: {toFaDigits(totalStock)}
                    </span>
                    <div onClick={(event) => event.stopPropagation()}>
                      <EntityActionMenu type="product" id={p.id} label={p.name} />
                    </div>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        openEdit(p.id, p.name);
                      }}
                      className="text-slate-400 hover:text-primary p-1"
                    >
                      <Pencil size={17} />
                    </button>
                  </div>
                </div>

                {p.product_variants.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {p.product_variants.map((v) => (
                      <span
                        key={v.id}
                        className="text-xs bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1 text-slate-600"
                      >
                        {[v.color, v.size].filter(Boolean).join(" / ") || "ساده"}
                        {" — "}
                        {toFaDigits(v.stock_qty)} عدد
                        {v.sale_price ? ` — ${formatToman(v.sale_price)}` : ""}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}

