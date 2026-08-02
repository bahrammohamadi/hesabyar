"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { Modal } from "@/components/shared/ui";
import { usePanelManager } from "@/src/core/panel-manager/panel-manager.store";
import { formatToman, normalizeSearchText, toFaDigits } from "@/lib/utils/format";
import { Search, Package, Barcode, X, Filter, PackagePlus } from "lucide-react";

export interface SelectableVariant {
  variant_id: string;
  product_id: string | null;
  product_name: string;
  product_code: string | null;
  color: string | null;
  size: string | null;
  sku: string | null;
  barcode: string | null;
  sale_price: number;
  purchase_price: number;
  stock_qty: number;
  category_id: string | null;
  brand_id: string | null;
}

interface RawVariant {
  id: string;
  color: string | null;
  size: string | null;
  sku: string | null;
  barcode: string | null;
  sale_price: number | null;
  purchase_price: number | null;
  stock_qty: number;
  product: {
    id: string;
    name: string;
    code: string | null;
    category_id: string | null;
    brand_id: string | null;
    base_sale_price: number;
    base_purchase_price: number;
  } | null;
}

/**
 * انتخابگر حرفه‌ای کالا — مودال با جستجوی لحظه‌ای، فیلتر دسته/برند/رنگ/سایز/قیمت.
 * در فروش، خرید، انبار و حواله استفاده می‌شود.
 */
export function ProductSelector({
  open,
  onClose,
  onSelect,
  priceMode = "sale",
  ownedByPanel = false,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (v: SelectableVariant) => void;
  priceMode?: "sale" | "purchase";
  /** از داخل یک پنل باز شده؛ پنل میزبان نباید بسته شود. */
  ownedByPanel?: boolean;
}) {
  const { orgId } = useOrg();
  const { openEntityForResult } = usePanelManager();
  const [term, setTerm] = useState("");
  const [creating, setCreating] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<"stock_high" | "stock_low" | "price_low" | "price_high" | "name_asc" | "newest">("stock_high");
  const [onlyInStock, setOnlyInStock] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  // همه‌ی تنوع‌ها (یک‌بار بارگذاری، فیلتر در سمت کلاینت برای سرعت لحظه‌ای)
  const { data: variants, isLoading } = useQuery({
    queryKey: ["all-variants", orgId],
    enabled: !!orgId && open,
    queryFn: async (): Promise<SelectableVariant[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("product_variants")
        .select(
          `id, color, size, sku, barcode, sale_price, purchase_price, stock_qty,
           product:products!inner(id, name, code, category_id, brand_id, base_sale_price, base_purchase_price)`
        )
        .eq("is_active", true)
        .limit(5000);
      if (error) throw error;
      return ((data as unknown as RawVariant[]) ?? []).map((v) => ({
        variant_id: v.id,
        product_id: v.product?.id ?? null,
        product_name: v.product?.name ?? "",
        product_code: v.product?.code ?? null,
        color: v.color,
        size: v.size,
        sku: v.sku,
        barcode: v.barcode,
        sale_price: v.sale_price ?? v.product?.base_sale_price ?? 0,
        purchase_price: v.purchase_price ?? v.product?.base_purchase_price ?? 0,
        stock_qty: v.stock_qty,
        category_id: v.product?.category_id ?? null,
        brand_id: v.product?.brand_id ?? null,
      }));
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["sel-categories", orgId],
    enabled: !!orgId && open,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase.from("categories").select("id, name").eq("is_active", true).order("name");
      return data ?? [];
    },
  });

  const { data: brands } = useQuery({
    queryKey: ["sel-brands", orgId],
    enabled: !!orgId && open,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase.from("brands").select("id, name").eq("is_active", true).order("name");
      return data ?? [];
    },
  });

  // رنگ‌ها و سایزهای موجود (برای فیلتر)
  const { colors, sizes } = useMemo(() => {
    const c = new Set<string>();
    const s = new Set<string>();
    variants?.forEach((v) => {
      if (v.color) c.add(v.color);
      if (v.size) s.add(v.size);
    });
    return { colors: Array.from(c).sort(), sizes: Array.from(s).sort() };
  }, [variants]);

  // فیلتر و مرتب‌سازی لحظه‌ای
  const filtered = useMemo(() => {
    if (!variants) return [];
    const t = normalizeSearchText(term);
    const max = maxPrice ? Number(maxPrice.replace(/[^\d]/g, "")) * 10 : Infinity;

    let result = variants.filter((v) => {
      if (t) {
        const hay = normalizeSearchText(`${v.product_name} ${v.product_code ?? ""} ${v.sku ?? ""} ${v.barcode ?? ""} ${v.color ?? ""} ${v.size ?? ""}`);
        if (!hay.includes(t)) return false;
      }
      if (categoryId && v.category_id !== categoryId) return false;
      if (brandId && v.brand_id !== brandId) return false;
      if (color && v.color !== color) return false;
      if (size && v.size !== size) return false;
      const price = priceMode === "sale" ? v.sale_price : v.purchase_price;
      if (price > max) return false;
      if (onlyInStock && v.stock_qty <= 0) return false;
      return true;
    });

    // مرتب‌سازی
    result.sort((a, b) => {
      switch (sortBy) {
        case "stock_high": return b.stock_qty - a.stock_qty;
        case "stock_low": return a.stock_qty - b.stock_qty;
        case "price_low": return (priceMode === "sale" ? a.sale_price : a.purchase_price) - (priceMode === "sale" ? b.sale_price : b.purchase_price);
        case "price_high": return (priceMode === "sale" ? b.sale_price : b.purchase_price) - (priceMode === "sale" ? a.sale_price : a.purchase_price);
        case "name_asc": return a.product_name.localeCompare(b.product_name, "fa");
        case "newest": return 0; // ترتیب پیش‌فرض
        default: return 0;
      }
    });

    return result.slice(0, 200);
  }, [variants, term, categoryId, brandId, color, size, maxPrice, priceMode, sortBy, onlyInStock]);

  const activeFilters = [categoryId, brandId, color, size, maxPrice].filter(Boolean).length;

  function reset() {
    setCategoryId("");
    setBrandId("");
    setColor("");
    setSize("");
    setMaxPrice("");
  }

  async function openCreateProduct() {
    if (!orgId || creating) return;
    setCreating(true);
    // اول selector را به‌صورت sync از DOM خارج می‌کنیم؛ سپس پنل را باز می‌کنیم.
    flushSync(() => onClose());
    await Promise.resolve();
    const result = await openEntityForResult("product", {
      mode: "create",
      context: "picker",
      title: "کالای جدید",
      props: { initialName: term },
    });
    setCreating(false);
    const data = result?.data as { name?: string; base_sale_price?: number; base_purchase_price?: number; variants?: Array<{ id: string; product_id: string; color: string | null; size: string | null; sku: string | null; barcode: string | null; sale_price: number | null; purchase_price: number | null; stock_qty: number }> } | undefined;
    const firstVariant = data?.variants?.[0];
    if (result?.id && firstVariant) {
      onSelect({
        variant_id: firstVariant.id,
        product_id: result.id,
        product_name: data?.name ?? result.title ?? "کالای جدید",
        product_code: null,
        color: firstVariant.color,
        size: firstVariant.size,
        sku: firstVariant.sku,
        barcode: firstVariant.barcode,
        sale_price: firstVariant.sale_price ?? data?.base_sale_price ?? 0,
        purchase_price: firstVariant.purchase_price ?? data?.base_purchase_price ?? 0,
        stock_qty: firstVariant.stock_qty ?? 0,
        category_id: null,
        brand_id: null,
      });
    }
  }

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="انتخاب کالا" size="lg" mobileFullscreen ownedByPanel={ownedByPanel}>
      <div className="flex h-full min-h-0 flex-col gap-3">
        {/* جستجو */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <input
            ref={inputRef}
            className="input pr-10"
            placeholder="جستجو: نام، کد کالا یا بارکد..."
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
          {term && (
            <button onClick={() => setTerm("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <X size={16} />
            </button>
          )}
        </div>

        <button onClick={openCreateProduct} disabled={creating} className="btn-secondary w-full justify-center border-dashed disabled:opacity-60">
          <PackagePlus size={18} />
          {creating ? "در حال باز کردن فرم..." : "افزودن کالای جدید"}
          {term && ` («${term}»)`}
        </button>

        {/* دکمه فیلتر و مرتب‌سازی */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters((s) => !s)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground"
            >
              <Filter size={16} />
              فیلترها
              {activeFilters > 0 && (
                <span className="badge bg-primary/10 text-primary">{toFaDigits(activeFilters)}</span>
              )}
            </button>
            <select
              aria-label="مرتب‌سازی"
              className="input text-sm py-3 pr-2 min-h-12"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            >
              <option value="stock_high">موجودی زیاد</option>
              <option value="stock_low">موجودی کم</option>
              <option value="price_low">قیمت کم</option>
              <option value="price_high">قیمت زیاد</option>
              <option value="name_asc">نام الفبا</option>
              <option value="newest">جدیدترین</option>
            </select>
            <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={onlyInStock}
                onChange={(e) => setOnlyInStock(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary"
              />
              فقط موجود
            </label>
          </div>
          {activeFilters > 0 && (
            <button onClick={reset} className="text-xs text-destructive">
              پاک‌کردن
            </button>
          )}
        </div>

        {/* فیلترها */}
        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 rounded-xl bg-muted">
            <select aria-label="دسته‌بندی" className="input text-sm" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">همه دسته‌ها</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select aria-label="برند" className="input text-sm" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
              <option value="">همه برندها</option>
              {brands?.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <select aria-label="رنگ" className="input text-sm" value={color} onChange={(e) => setColor(e.target.value)}>
              <option value="">همه رنگ‌ها</option>
              {colors.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select aria-label="سایز" className="input text-sm" value={size} onChange={(e) => setSize(e.target.value)}>
              <option value="">همه سایزها</option>
              {sizes.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <input
              className="input text-sm col-span-2 sm:col-span-1"
              placeholder="حداکثر قیمت (تومان)"
              inputMode="numeric"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
          </div>
        )}

        {/* نتایج */}
        <div className="text-xs text-muted-foreground">
          {isLoading ? "در حال بارگذاری..." : `${toFaDigits(filtered.length)} کالا`}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto -mx-1 px-1 space-y-1.5 pb-3">
          {filtered.length === 0 && !isLoading ? (
            <div className="text-center text-sm text-muted-foreground py-10">کالایی یافت نشد.</div>
          ) : (
            filtered.map((v) => {
              const price = priceMode === "sale" ? v.sale_price : v.purchase_price;
              const out = v.stock_qty <= 0;
              return (
                <button
                  key={v.variant_id}
                  onClick={() => {
                    onSelect(v);
                  }}
                  className="w-full text-right rounded-xl border border-border hover:border-primary/30 hover:bg-primary/[0.04] p-3 transition flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                    <Package size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm text-foreground truncate">{v.product_name}</div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2 mt-0.5">
                      {v.product_code && (
                        <span className="flex items-center gap-1">
                          <Barcode size={11} /> {v.product_code}
                        </span>
                      )}
                      {(v.color || v.size) && (
                        <span>{[v.color, v.size].filter(Boolean).join(" / ")}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-left shrink-0">
                    <div className="text-sm font-medium text-foreground">{formatToman(price, false)}</div>
                    <div className={`text-xs ${out ? "text-destructive" : "text-success-onSoft"}`}>
                      موجودی {toFaDigits(v.stock_qty)}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
}
