"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import {
  useProducts,
  useCategories,
  useBrands,
  type ProductWithVariants,
} from "@/lib/hooks/useProducts";
import { PageHeader, Spinner, EmptyState, Modal } from "@/components/shared/ui";
import { formatToman, toFaDigits, toEnDigits, formatNumber } from "@/lib/utils/format";
import { tomanToRial, rialToToman } from "@/lib/utils/format";
import { Plus, Search, Package, Pencil, Trash2, Loader2 } from "lucide-react";

interface VariantForm {
  id?: string;
  color: string;
  size: string;
  sku: string;
  barcode: string;
  purchase_price: string; // تومان
  sale_price: string; // تومان
  stock_qty: string;
}

const emptyVariant = (): VariantForm => ({
  color: "",
  size: "",
  sku: "",
  barcode: "",
  purchase_price: "",
  sale_price: "",
  stock_qty: "0",
});

export default function ProductsPage() {
  const { orgId, branchId } = useOrg();
  const [search, setSearch] = useState("");
  const { data: products, isLoading } = useProducts(orgId, search);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProductWithVariants | null>(null);

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(p: ProductWithVariants) {
    setEditing(p);
    setModalOpen(true);
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

      <div className="relative mb-4">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          className="input pr-10"
          placeholder="جستجوی نام کالا..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <Spinner label="در حال بارگذاری کالاها..." />
      ) : !products || products.length === 0 ? (
        <EmptyState
          title="هنوز کالایی ثبت نشده"
          description="اولین کالای خود را اضافه کنید یا از فایل اکسل وارد کنید."
          action={
            <button onClick={openNew} className="btn-primary">
              <Plus size={18} /> افزودن کالا
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {products.map((p) => {
            const totalStock = p.product_variants.reduce((s, v) => s + v.stock_qty, 0);
            const low = totalStock <= p.low_stock_threshold;
            return (
              <div key={p.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                      <Package size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-800 truncate">{p.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5 flex flex-wrap gap-x-2">
                        {p.code && <span className="font-mono text-brand-600">{p.code}</span>}
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
                    <button
                      onClick={() => openEdit(p)}
                      className="text-slate-400 hover:text-brand-600 p-1"
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

      {modalOpen && (
        <ProductModal
          orgId={orgId}
          branchId={branchId}
          editing={editing}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}

function ProductModal({
  orgId,
  branchId,
  editing,
  onClose,
}: {
  orgId: string | null;
  branchId: string | null;
  editing: ProductWithVariants | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { data: categories } = useCategories(orgId);
  const { data: brands } = useBrands(orgId);

  const [name, setName] = useState(editing?.name ?? "");
  const [code, setCode] = useState(editing?.code ?? "");
  const [season, setSeason] = useState(editing?.season ?? "");
  const [material, setMaterial] = useState(editing?.material ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [categoryId, setCategoryId] = useState(editing?.category_id ?? "");
  const [brandId, setBrandId] = useState(editing?.brand_id ?? "");
  const [lowStock, setLowStock] = useState(String(editing?.low_stock_threshold ?? 3));
  const [variants, setVariants] = useState<VariantForm[]>(
    editing && editing.product_variants.length
      ? editing.product_variants.map((v) => ({
          id: v.id,
          color: v.color ?? "",
          size: v.size ?? "",
          sku: v.sku ?? "",
          barcode: v.barcode ?? "",
          purchase_price: v.purchase_price ? String(rialToToman(v.purchase_price)) : "",
          sale_price: v.sale_price ? String(rialToToman(v.sale_price)) : "",
          stock_qty: String(v.stock_qty),
        }))
      : [emptyVariant()]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateVariant(i: number, field: keyof VariantForm, value: string) {
    setVariants((prev) =>
      prev.map((v, idx) => (idx === i ? { ...v, [field]: value } : v))
    );
  }

  async function handleSave() {
    setError(null);
    if (!name.trim()) {
      setError("نام کالا الزامی است.");
      return;
    }
    if (!orgId) return;
    setSaving(true);
    const supabase = createClient();

    try {
      let productId = editing?.id;

      const baseFields = {
        name: name.trim(),
        code: code.trim() || null,
        season: season.trim() || null,
        material: material.trim() || null,
        description: description.trim() || null,
        category_id: categoryId || null,
        brand_id: brandId || null,
        low_stock_threshold: Number(toEnDigits(lowStock)) || 0,
      };

      if (editing) {
        const { error: e } = await supabase.from("products").update(baseFields).eq("id", editing.id);
        if (e) throw e;
      } else {
        const { data, error: e } = await supabase
          .from("products")
          .insert({ org_id: orgId, branch_id: branchId, ...baseFields })
          .select("id")
          .single();
        if (e) throw e;
        productId = data.id;
      }

      // ذخیره تنوع‌ها
      for (const v of variants) {
        const payload = {
          org_id: orgId,
          branch_id: branchId,
          product_id: productId,
          color: v.color.trim() || null,
          size: v.size.trim() || null,
          sku: v.sku.trim() || null,
          barcode: v.barcode.trim() || null,
          purchase_price: v.purchase_price
            ? tomanToRial(Number(toEnDigits(v.purchase_price)))
            : null,
          sale_price: v.sale_price ? tomanToRial(Number(toEnDigits(v.sale_price))) : null,
        };

        if (v.id) {
          const { error: e } = await supabase
            .from("product_variants")
            .update(payload)
            .eq("id", v.id);
          if (e) throw e;
        } else {
          // تنوع جدید + حرکت موجودی اول دوره
          const { data: newV, error: e } = await supabase
            .from("product_variants")
            .insert({ ...payload, stock_qty: 0 })
            .select("id")
            .single();
          if (e) throw e;
          const qty = Number(toEnDigits(v.stock_qty)) || 0;
          if (qty !== 0) {
            await supabase.from("stock_movements").insert({
              org_id: orgId,
              branch_id: branchId,
              variant_id: newV.id,
              type: "in",
              reason: "opening",
              qty,
              note: "موجودی اول دوره",
            });
          }
        }
      }

      await qc.invalidateQueries({ queryKey: ["products"] });
      onClose();
    } catch (e) {
      setError("خطا در ذخیره: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? "ویرایش کالا" : "افزودن کالای جدید"}
      size="lg"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">نام کالا *</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثلاً: مانتو لینن"
            />
          </div>
          <div>
            <label className="label">کد کالا</label>
            <input
              className="input text-left"
              dir="ltr"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="خالی = تولید خودکار"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">فصل</label>
            <select className="input" value={season} onChange={(e) => setSeason(e.target.value)}>
              <option value="">—</option>
              <option value="بهار">بهار</option>
              <option value="تابستان">تابستان</option>
              <option value="پاییز">پاییز</option>
              <option value="زمستان">زمستان</option>
              <option value="چهارفصل">چهارفصل</option>
            </select>
          </div>
          <div>
            <label className="label">جنس</label>
            <input
              className="input"
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              placeholder="مثلاً: لینن، نخ، مخمل"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">دسته‌بندی</label>
            <select
              className="input"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">—</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">برند</label>
            <select
              className="input"
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
            >
              <option value="">—</option>
              {brands?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">حد کم‌موجودی (هشدار)</label>
            <input
              className="input"
              value={lowStock}
              onChange={(e) => setLowStock(e.target.value)}
              inputMode="numeric"
            />
          </div>
          <div>
            <label className="label">توضیحات</label>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">تنوع‌ها (رنگ / سایز)</label>
            <button
              type="button"
              onClick={() => setVariants((p) => [...p, emptyVariant()])}
              className="text-brand-600 text-sm font-medium"
            >
              + افزودن تنوع
            </button>
          </div>

          <div className="space-y-3">
            {variants.map((v, i) => (
              <div key={i} className="rounded-xl border border-slate-100 p-3 bg-slate-50/50">
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <input
                    className="input"
                    placeholder="رنگ"
                    value={v.color}
                    onChange={(e) => updateVariant(i, "color", e.target.value)}
                  />
                  <input
                    className="input"
                    placeholder="سایز"
                    value={v.size}
                    onChange={(e) => updateVariant(i, "size", e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <input
                    className="input"
                    placeholder="کد کالا (SKU)"
                    value={v.sku}
                    onChange={(e) => updateVariant(i, "sku", e.target.value)}
                  />
                  <input
                    className="input"
                    placeholder="بارکد"
                    value={v.barcode}
                    onChange={(e) => updateVariant(i, "barcode", e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    className="input"
                    placeholder="قیمت خرید"
                    inputMode="numeric"
                    value={v.purchase_price}
                    onChange={(e) => updateVariant(i, "purchase_price", e.target.value)}
                  />
                  <input
                    className="input"
                    placeholder="قیمت فروش"
                    inputMode="numeric"
                    value={v.sale_price}
                    onChange={(e) => updateVariant(i, "sale_price", e.target.value)}
                  />
                  <input
                    className="input"
                    placeholder="موجودی"
                    inputMode="numeric"
                    disabled={!!v.id}
                    title={v.id ? "موجودی از بخش انبار تغییر می‌کند" : ""}
                    value={v.stock_qty}
                    onChange={(e) => updateVariant(i, "stock_qty", e.target.value)}
                  />
                </div>
                {variants.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setVariants((p) => p.filter((_, idx) => idx !== i))}
                    className="text-rose-500 text-xs mt-2 flex items-center gap-1"
                  >
                    <Trash2 size={14} /> حذف این تنوع
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-50 text-rose-700 text-sm px-4 py-3">{error}</div>
        )}

        <div className="flex gap-2 pt-2">
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving && <Loader2 className="animate-spin" size={18} />}
            ذخیره
          </button>
          <button onClick={onClose} className="btn-secondary">
            انصراف
          </button>
        </div>
      </div>
    </Modal>
  );
}
