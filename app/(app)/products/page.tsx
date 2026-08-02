"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useOrg } from "@/lib/hooks/useOrg";
import { usePanelManager } from "@/src/core/panel-manager/panel-manager.store";
import { useProducts } from "@/lib/hooks/useProducts";
import { PageHeader, Spinner, EmptyState } from "@/components/shared/ui";
import { Button, Card, Select } from "@/src/shared/ui";
import { ProductKpiCard, StockStatusBadge, stockQtyClass, stockStateOf } from "./components/ProductsPieces";
import { EntityActionMenu } from "@/components/shared/entity-action-menu";
import { formatToman, toFaDigits } from "@/lib/utils/format";
import { Plus, Search, Package, Pencil } from "lucide-react";
import { Pagination, usePagination } from "@/src/shared/ui";


export default function ProductsPage() {
  const { orgId } = useOrg();
  const { openEntity } = usePanelManager();
  const searchParams = useSearchParams();
  const autoOpenCreateRef = useRef(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "name_asc" | "name_desc" | "code_asc" | "code_desc" | "stock_high" | "stock_low" | "price_high" | "price_low">("code_desc");
  const { data: products, isLoading } = useProducts(orgId, search);
  const sortedProducts = [...(products ?? [])].sort((a, b) => {
    const stockA = a.product_variants.reduce((sum, variant) => sum + variant.stock_qty, 0);
    const stockB = b.product_variants.reduce((sum, variant) => sum + variant.stock_qty, 0);
    const priceA = a.base_sale_price ?? 0;
    const priceB = b.base_sale_price ?? 0;
    if (sortBy === "name_asc") return a.name.localeCompare(b.name, "fa");
    if (sortBy === "name_desc") return b.name.localeCompare(a.name, "fa");
    if (sortBy === "code_asc") return String(a.code ?? "").localeCompare(String(b.code ?? ""), "fa", { numeric: true });

    if (sortBy === "code_desc") return String(b.code ?? "").localeCompare(String(a.code ?? ""), "fa", { numeric: true });
    if (sortBy === "stock_high") return stockB - stockA;
    if (sortBy === "stock_low") return stockA - stockB;
    if (sortBy === "price_high") return priceB - priceA;
    if (sortBy === "price_low") return priceA - priceB;
    return 0;
  });

  // صفحه‌بندی سمت کلاینت — ۳۷۵ محصول همزمان رندر می‌شد (۱۷٬۹۶۳ گره DOM).
  const { paged, page, setPage, pageSize, setPageSize, totalPages } = usePagination(sortedProducts);

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

  // شمارنده‌های نمایشی — از همان دادهٔ useProducts مشتق می‌شوند، بدون کوئری جدید.
  const kpi = (() => {
    const list = products ?? [];
    let totalStock = 0;
    let inventoryValue = 0;
    let lowCount = 0;
    for (const p of list) {
      const stock = p.product_variants.reduce((s, v) => s + v.stock_qty, 0);
      totalStock += stock;
      inventoryValue += p.product_variants.reduce(
        (s, v) => s + v.stock_qty * (v.purchase_price ?? p.base_purchase_price ?? 0),
        0
      );
      if (stock <= p.low_stock_threshold) lowCount += 1;
    }
    return { totalStock, inventoryValue, lowCount, productCount: list.length };
  })();

  return (
    <div className="space-y-4">
      <PageHeader
        title="لیست محصولات"
        subtitle="مدیریت محصولات، تنوع‌ها (رنگ/سایز) و موجودی"
        action={
          <Button onClick={openNew} icon={<Plus size={17} />}>
            <span className="hidden sm:inline">افزودن محصول جدید</span>
            <span className="sm:hidden">افزودن</span>
          </Button>
        }
      />

      {/* KPI — مطابق مرجع */}
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        <ProductKpiCard
          label="کل موجودی کالا"
          value={toFaDigits(kpi.totalStock)}
          unit="عدد"
          accent="primary"
        />
        <ProductKpiCard
          label="کالاهای رو به اتمام"
          value={toFaDigits(kpi.lowCount)}
          chip={kpi.lowCount > 0 ? "بحرانی" : undefined}
          chipTone="danger"
          accent="destructive"
        />
        <ProductKpiCard
          label="ارزش کل انبار"
          value={formatToman(kpi.inventoryValue, false)}
          unit="تومان"
          accent="info"
        />
        <ProductKpiCard
          label="تعداد اقلام"
          value={toFaDigits(kpi.productCount)}
          unit="عدد کالا"
          accent="success"
        />
      </div>

      {/* جدول محصولات */}
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              className="input pr-9"
              placeholder="جستجو در انبار..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            className="sm:w-52"
            aria-label="مرتب‌سازی"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          >
            <option value="code_desc">جدیدترین بر اساس کد کالا</option>
            <option value="code_asc">قدیمی‌ترین بر اساس کد کالا</option>
            <option value="newest">جدیدترین بر اساس تاریخ ثبت</option>
            <option value="name_asc">نام A-Z</option>
            <option value="name_desc">نام Z-A</option>
            <option value="stock_high">موجودی بیشتر</option>
            <option value="stock_low">موجودی کمتر</option>
            <option value="price_high">قیمت بیشتر</option>
            <option value="price_low">قیمت کمتر</option>
          </Select>
        </div>

        {isLoading ? (
          <div className="p-6"><Spinner label="در حال بارگذاری کالاها..." /></div>
        ) : !products || products.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Package}
              title="هنوز کالایی ثبت نشده"
              description="اولین کالای خود را اضافه کنید یا از فایل اکسل وارد کنید."
              action={<Button onClick={openNew} icon={<Plus size={17} />}>کالای جدید</Button>}
            />
          </div>
        ) : sortedProducts.length === 0 ? (
          <div className="p-4">
            <EmptyState icon={Search} title="کالایی یافت نشد" description="عبارت جستجو را تغییر دهید." />
          </div>
        ) : (
          <>
            {/* دسکتاپ — جدول، مطابق مرجع */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[900px] text-right text-sm">
                <thead className="bg-primary text-xs text-primary-foreground">
                  <tr>
                    <th className="px-4 py-3.5 font-extrabold">نام و شناسه</th>
                    <th className="px-4 py-3.5 font-extrabold">دسته‌بندی</th>
                    <th className="px-4 py-3.5 text-center font-extrabold">موجودی</th>
                    <th className="px-4 py-3.5 font-extrabold">قیمت واحد</th>
                    <th className="px-4 py-3.5 text-center font-extrabold">وضعیت</th>
                    <th className="px-4 py-3.5 text-center font-extrabold">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((p) => {
                    const totalStock = p.product_variants.reduce((s, v) => s + v.stock_qty, 0);
                    const state = stockStateOf(totalStock, p.low_stock_threshold);
                    const displaySalePrice = p.base_sale_price || p.product_variants.find((variant) => variant.sale_price)?.sale_price || 0;
                    return (
                      <tr
                        key={p.id}
                        role="link"
                        tabIndex={0}
                        onClick={(event) => handleProductRowClick(event, p.id, p.name)}
                        onAuxClick={(event) => handleProductRowAuxClick(event, p.id)}
                        onKeyDown={(event) => { if (event.key === "Enter") openProduct(p.id, p.name); }}
                        className="cursor-pointer border-b border-border transition last:border-0 hover:bg-primary/[0.03]"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                              <Package size={19} />
                            </div>
                            <div className="min-w-0">
                              <Link
                                href={`/products/${p.id}`}
                                className="block truncate font-bold text-foreground hover:text-primary hover:underline"
                                onClick={(event) => {
                                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) return;
                                  event.preventDefault();
                                  event.stopPropagation();
                                  openProduct(p.id, p.name);
                                }}
                              >
                                {p.name}
                              </Link>
                              {p.code && (
                                <span className="mt-0.5 block truncate font-mono text-xs text-muted-foreground">
                                  ID: {p.code}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {p.category?.name ? (
                            <span className="inline-flex rounded-lg bg-muted px-2.5 py-1 text-xs text-foreground/80">
                              {p.category.name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className={`px-4 py-3 text-center font-extrabold tabular-nums ${stockQtyClass(state)}`}>
                          {toFaDigits(totalStock)}
                        </td>
                        <td className="px-4 py-3">
                          {displaySalePrice ? (
                            <div className="leading-tight">
                              <span className="font-bold tabular-nums text-foreground">
                                {formatToman(displaySalePrice, false)}
                              </span>
                              <span className="mr-1 text-2xs text-muted-foreground">تومان</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StockStatusBadge state={state} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1" onClick={(event) => event.stopPropagation()}>
                            <EntityActionMenu type="product" id={p.id} label={p.name} />
                            <button
                              onClick={() => openEdit(p.id, p.name)}
                              aria-label={`ویرایش ${p.name}`}
                              className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                            >
                              <Pencil size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* موبایل و تبلت — کارت */}
            <ul className="divide-y divide-border lg:hidden">
              {paged.map((p) => {
                const totalStock = p.product_variants.reduce((s, v) => s + v.stock_qty, 0);
                const state = stockStateOf(totalStock, p.low_stock_threshold);
                const displaySalePrice = p.base_sale_price || p.product_variants.find((variant) => variant.sale_price)?.sale_price || 0;
                return (
                  <li
                    key={p.id}
                    /*
                      role="link" اینجا نبود چون li داخل ul باید نقش
                      ضمنی listitem را حفظ کند؛ بازنویسی آن باعث می‌شد
                      ul هیچ فرزند معتبری نداشته باشد (ایراد serious
                      «list» در axe-core). دسترسی با کیبورد از طریق
                      tabIndex و onKeyDown حفظ شده است.
                    */
                    tabIndex={0}
                    onClick={(event) => handleProductRowClick(event, p.id, p.name)}
                    onAuxClick={(event) => handleProductRowAuxClick(event, p.id)}
                    onKeyDown={(event) => { if (event.key === "Enter") openProduct(p.id, p.name); }}
                    className="cursor-pointer p-3.5 transition hover:bg-primary/[0.03]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                          <Package size={19} />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-foreground">{p.name}</div>
                          {p.code && (
                            <div className="mt-0.5 truncate font-mono text-xs text-muted-foreground">ID: {p.code}</div>
                          )}
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <StockStatusBadge state={state} />
                            <span className={`text-xs font-extrabold tabular-nums ${stockQtyClass(state)}`}>
                              {toFaDigits(totalStock)} عدد
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        {displaySalePrice > 0 && (
                          <span className="text-sm font-extrabold tabular-nums text-foreground">
                            {formatToman(displaySalePrice, false)}
                          </span>
                        )}
                        <div onClick={(event) => event.stopPropagation()}>
                          <EntityActionMenu type="product" id={p.id} label={p.name} />
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <div className="px-4 pb-3">
          <Pagination
            page={page}
            totalPages={totalPages}
            total={sortedProducts.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </Card>
    </div>
  );
}

