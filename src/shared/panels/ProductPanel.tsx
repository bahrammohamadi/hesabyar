"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Package, Plus, Trash2 } from "lucide-react";
import type { PanelInstance, PanelMode } from "@/src/core/panel-manager/types";
import { usePanelManager } from "@/src/core/panel-manager/panel-manager.store";
import { useOrg } from "@/lib/hooks/useOrg";
import { useQueryClient } from "@tanstack/react-query";
import { useBrands, useCategories } from "@/lib/hooks/useProducts";
import {
  createVariant as createVariantRecord,
  productMoney,
  useAdjustProductStock,
  useChangeProductPrice,
  useCreateProduct,
  useCreateVariant,
  useDeactivateProduct,
  useProductEntity,
  useProductPriceHistory,
  useProductStock,
  useUpdateProduct,
  useUpdateVariant,
  type ProductEntity,
  type ProductPriceHistoryEntry,
  type ProductVariantEntity,
} from "@/src/core/services/product-service";
import { Badge, Button, DataTable, EmptyState, Field, Input, NumberInput, PanelShell, Section, Select, Spinner, Tabs, useToast, type Column } from "@/src/shared/ui";
import { Money, PersianDate, toPersianDigits } from "@/src/shared/format";

function stockTone(stock: number) {
  if (stock <= 0) return "danger" as const;
  if (stock <= 3) return "warning" as const;
  return "success" as const;
}

type ProductFormState = {
  name: string;
  code: string;
  season: string;
  material: string;
  imageUrl: string;
  categoryId: string;
  brandId: string;
  basePurchasePriceToman: number | null;
  baseSalePriceToman: number | null;
  baseProfitPercent: number | null;
  lowStockThreshold: number | null;
  description: string;
};

type VariantFormState = {
  id?: string;
  color: string;
  size: string;
  sku: string;
  barcode: string;
  purchasePriceToman: number | null;
  salePriceToman: number | null;
  profitPercent: number | null;
  initialStock: number | null;
};

type PriceChangeFormState = {
  purchasePriceToman: number | null;
  salePriceToman: number | null;
  profitPercent: number | null;
  applyToVariants: boolean;
  reason: string;
};

type StockAdjustFormState = {
  variantId: string;
  mode: "new_stock" | "delta";
  value: number | null;
  reason: string;
};

function emptyStockAdjustForm(): StockAdjustFormState {
  return { variantId: "", mode: "new_stock", value: null, reason: "" };
}

function emptyPriceChangeForm(): PriceChangeFormState {
  return { purchasePriceToman: null, salePriceToman: null, profitPercent: null, applyToVariants: true, reason: "" };
}

/** محاسبه درصد سود از قیمت خرید و فروش */
function calcProfitPercent(purchaseToman: number | null, saleToman: number | null): number | null {
  if (!purchaseToman || purchaseToman <= 0 || saleToman === null) return null;
  return Math.round(((saleToman - purchaseToman) / purchaseToman) * 10000) / 100;
}

/** محاسبه قیمت فروش از قیمت خرید و درصد سود */
function calcSaleFromProfit(purchaseToman: number | null, profitPercent: number | null): number | null {
  if (!purchaseToman || purchaseToman <= 0 || profitPercent === null) return null;
  return Math.round(purchaseToman * (1 + profitPercent / 100));
}

function emptyProductForm(): ProductFormState {
  return { name: "", code: "", season: "", material: "", imageUrl: "", categoryId: "", brandId: "", basePurchasePriceToman: null, baseSalePriceToman: null, baseProfitPercent: null, lowStockThreshold: 3, description: "" };
}

function emptyVariantForm(): VariantFormState {
  return { color: "", size: "", sku: "", barcode: "", purchasePriceToman: null, salePriceToman: null, profitPercent: null, initialStock: 0 };
}

function formFromProduct(product: ProductEntity): ProductFormState {
  const purchaseToman = productMoney.rialToTomanNumber(product.base_purchase_price);
  const saleToman = productMoney.rialToTomanNumber(product.base_sale_price);
  return {
    name: product.name,
    code: product.code ?? "",
    season: product.season ?? "",
    material: product.material ?? "",
    imageUrl: product.image_url ?? "",
    categoryId: product.category_id ?? "",
    brandId: product.brand_id ?? "",
    basePurchasePriceToman: purchaseToman,
    baseSalePriceToman: saleToman,
    baseProfitPercent: calcProfitPercent(purchaseToman, saleToman),
    lowStockThreshold: product.low_stock_threshold,
    description: product.description ?? "",
  };
}

function formFromVariant(variant: ProductVariantEntity): VariantFormState {
  const purchaseToman = productMoney.rialToTomanNumber(variant.purchase_price);
  const saleToman = productMoney.rialToTomanNumber(variant.sale_price);
  return {
    id: variant.id,
    color: variant.color ?? "",
    size: variant.size ?? "",
    sku: variant.sku ?? "",
    barcode: variant.barcode ?? "",
    purchasePriceToman: purchaseToman,
    salePriceToman: saleToman,
    profitPercent: calcProfitPercent(purchaseToman, saleToman),
    initialStock: null,
  };
}

export function ProductPanel({ panel }: { panel: PanelInstance }) {
  const { closeTop, replaceTop, resolveTop } = usePanelManager();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { orgId, branchId } = useOrg();
  const { data: categories } = useCategories(orgId);
  const { data: brands } = useBrands(orgId);
  const productId = panel.entityId;
  const [mode, setMode] = useState<PanelMode>(panel.mode);
  const productQuery = useProductEntity(productId);
  const stockQuery = useProductStock(productId);
  const priceHistoryQuery = useProductPriceHistory(productId);
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const adjustProductStock = useAdjustProductStock();
  const changeProductPrice = useChangeProductPrice();
  const deactivateProduct = useDeactivateProduct();
  const createVariant = useCreateVariant(productId);
  const updateVariant = useUpdateVariant();
  const [productForm, setProductForm] = useState<ProductFormState>(emptyProductForm());
  const [variantForm, setVariantForm] = useState<VariantFormState>(emptyVariantForm());
  const [batchVariantForms, setBatchVariantForms] = useState<VariantFormState[]>([emptyVariantForm(), emptyVariantForm()]);
  const [batchOpen, setBatchOpen] = useState(false);
  const [savingBatch, setSavingBatch] = useState(false);
  const [priceForm, setPriceForm] = useState<PriceChangeFormState>(emptyPriceChangeForm());
  const [priceFormOpen, setPriceFormOpen] = useState(false);
  const [stockAdjustForm, setStockAdjustForm] = useState<StockAdjustFormState>(emptyStockAdjustForm());
  const [variantEdit, setVariantEdit] = useState<VariantFormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const product = productQuery.data;
  const initialTab = typeof panel.props?.initialTab === "string" ? panel.props.initialTab : undefined;

  useEffect(() => {
    if (mode === "create") {
      const initialName = typeof panel.props?.initialName === "string" ? panel.props.initialName : "";
      setProductForm({ ...emptyProductForm(), name: initialName });
    }
    else if (product) {
      setProductForm(formFromProduct(product));
      const purchaseToman = productMoney.rialToTomanNumber(product.base_purchase_price);
      const saleToman = productMoney.rialToTomanNumber(product.base_sale_price);
      setPriceForm({
        purchasePriceToman: purchaseToman,
        salePriceToman: saleToman,
        profitPercent: calcProfitPercent(purchaseToman, saleToman),
        applyToVariants: true,
        reason: "",
      });
    }
  }, [mode, product, panel.props?.initialName]);

  useEffect(() => {
    setBatchVariantForms([emptyVariantForm(), emptyVariantForm()]);
    setBatchOpen(false);
    setSavingBatch(false);
    setStockAdjustForm(emptyStockAdjustForm());
  }, [productId, mode]);

  const stockByVariant = useMemo(() => new Map((stockQuery.data ?? []).map((row) => [row.product_variant_id, row.current_stock])), [stockQuery.data]);
  const totalStock = (stockQuery.data ?? []).reduce((sum, row) => sum + row.current_stock, 0);

  function updateBatchVariant(index: number, updater: (prev: VariantFormState) => VariantFormState) {
    setBatchVariantForms((prev) => prev.map((row, rowIndex) => (rowIndex === index ? updater(row) : row)));
  }

  function addBatchVariantRow() {
    setBatchVariantForms((prev) => [...prev, emptyVariantForm()]);
  }

  function removeBatchVariantRow(index: number) {
    setBatchVariantForms((prev) => (prev.length <= 1 ? [emptyVariantForm()] : prev.filter((_, rowIndex) => rowIndex !== index)));
  }

  function isMeaningfulVariant(row: VariantFormState) {
    return Boolean(
      row.color.trim() ||
      row.size.trim() ||
      row.sku.trim() ||
      row.barcode.trim() ||
      row.purchasePriceToman ||
      row.salePriceToman ||
      row.initialStock,
    );
  }

  function batchRowsToSave(rows = batchVariantForms) {
    return rows.filter(isMeaningfulVariant);
  }

  async function saveVariantRows(targetProductId: string, rows: VariantFormState[]) {
    if (!orgId) throw new Error("سازمان فعال یافت نشد.");
    const savedVariants: ProductVariantEntity[] = [];
    for (const row of rows) {
      const savedVariant = await createVariantRecord(targetProductId, {
        org_id: orgId,
        branch_id: branchId,
        color: row.color,
        size: row.size,
        sku: row.sku,
        barcode: row.barcode,
        purchase_price_toman: row.purchasePriceToman,
        sale_price_toman: row.salePriceToman,
        initial_stock: row.initialStock,
      });
      savedVariants.push(savedVariant);
    }
    await queryClient.invalidateQueries({ queryKey: ["products"] });
    await queryClient.invalidateQueries({ queryKey: ["entity", "product"] });
    await queryClient.invalidateQueries({ queryKey: ["entity", "product", "detail", targetProductId] });
    await queryClient.invalidateQueries({ queryKey: ["entity", "product", "stock", targetProductId] });
    return savedVariants;
  }

  async function handleSaveBatchVariants() {
    if (!productId) return;
    const rows = batchRowsToSave();
    if (rows.length === 0) {
      setFormError("برای افزودن دسته‌ای، حداقل یک ردیف واریانت را تکمیل کنید.");
      return;
    }
    setFormError(null);
    setSavingBatch(true);
    try {
      const savedVariants = await saveVariantRows(productId, rows);
      setBatchVariantForms([emptyVariantForm(), emptyVariantForm()]);
      setBatchOpen(false);
      toast({ title: `${toPersianDigits(savedVariants.length)} واریانت اضافه شد`, tone: "success" });
    } catch (error) {
      setFormError((error as Error).message);
    } finally {
      setSavingBatch(false);
    }
  }

  async function handleProductSave() {
    setFormError(null);
    if (!productForm.name.trim()) {
      setFormError("نام کالا الزامی است.");
      return;
    }
    try {
      if (mode === "create") {
        if (!orgId) {
          setFormError("سازمان فعال یافت نشد.");
          return;
        }
        const meaningfulVariantRows = batchRowsToSave();
        const variantRows = meaningfulVariantRows.length > 0 ? meaningfulVariantRows : [{
          ...emptyVariantForm(),
          purchasePriceToman: productForm.basePurchasePriceToman,
          salePriceToman: productForm.baseSalePriceToman,
        }];
        const created = await createProduct.mutateAsync({
          org_id: orgId,
          branch_id: branchId,
          name: productForm.name,
          code: productForm.code,
          season: productForm.season,
          material: productForm.material,
          description: productForm.description,
          image_url: productForm.imageUrl,
          category_id: productForm.categoryId,
          brand_id: productForm.brandId,
          base_purchase_price_toman: productForm.basePurchasePriceToman,
          base_sale_price_toman: productForm.baseSalePriceToman,
          low_stock_threshold: productForm.lowStockThreshold ?? 3,
        });
        const savedVariants = await saveVariantRows(created.id, variantRows);
        if (savedVariants.length > 0 && meaningfulVariantRows.length > 0) {
          toast({ title: `${toPersianDigits(savedVariants.length)} واریانت اضافه شد`, tone: "success" });
        }
        if (typeof panel.props?.resultRequestId === "string") {
          resolveTop({ id: created.id, type: "product", title: created.name, data: { ...created, variants: savedVariants } });
        } else {
          replaceTop({ type: "product", entityId: created.id, mode: "view", title: created.name, context: panel.context });
        }
      } else if (productId) {
        await updateProduct.mutateAsync({
          id: productId,
          patch: {
            name: productForm.name,
            code: productForm.code,
            season: productForm.season,
            material: productForm.material,
            description: productForm.description,
            image_url: productForm.imageUrl,
            category_id: productForm.categoryId,
            brand_id: productForm.brandId,
            base_purchase_price_toman: productForm.basePurchasePriceToman,
            base_sale_price_toman: productForm.baseSalePriceToman,
            low_stock_threshold: productForm.lowStockThreshold ?? 3,
          },
        });
        setMode("view");
      }
    } catch (error) {
      setFormError((error as Error).message);
    }
  }

  async function handleDeactivate() {
    if (!productId || !product) return;
    if (!window.confirm("کالا غیرفعال شود؟")) return;
    await deactivateProduct.mutateAsync(productId);
  }

  async function handleCreateVariant() {
    if (!productId || !orgId) return;
    await createVariant.mutateAsync({
      org_id: orgId,
      branch_id: branchId,
      color: variantForm.color,
      size: variantForm.size,
      sku: variantForm.sku,
      barcode: variantForm.barcode,
      purchase_price_toman: variantForm.purchasePriceToman,
      sale_price_toman: variantForm.salePriceToman,
      initial_stock: variantForm.initialStock,
    });
    setVariantForm(emptyVariantForm());
  }

  async function handleUpdateVariant() {
    if (!variantEdit?.id) return;
    await updateVariant.mutateAsync({
      id: variantEdit.id,
      patch: {
        color: variantEdit.color,
        size: variantEdit.size,
        sku: variantEdit.sku,
        barcode: variantEdit.barcode,
        purchase_price_toman: variantEdit.purchasePriceToman,
        sale_price_toman: variantEdit.salePriceToman,
      },
    });
    setVariantEdit(null);
  }


  async function handleChangePrice() {
    if (!productId) return;
    if (!priceForm.purchasePriceToman || !priceForm.salePriceToman) {
      setFormError("قیمت خرید و فروش جدید را وارد کنید.");
      return;
    }
    setFormError(null);
    await changeProductPrice.mutateAsync({
      product_id: productId,
      purchase_price_toman: priceForm.purchasePriceToman,
      sale_price_toman: priceForm.salePriceToman,
      apply_variants: priceForm.applyToVariants,
      reason: priceForm.reason,
    });
    setPriceFormOpen(false);
  }


  function openStockAdjust(row: ProductVariantEntity) {
    const currentStock = stockByVariant.get(row.id) ?? row.stock_qty ?? 0;
    setFormError(null);
    setStockAdjustForm({ variantId: row.id, mode: "new_stock", value: currentStock, reason: "" });
  }

  async function handleAdjustStock() {
    if (!productId || !stockAdjustForm.variantId) return;
    const targetVariant = product?.variants.find((variant) => variant.id === stockAdjustForm.variantId);
    if (!targetVariant) return;
    const currentStock = stockByVariant.get(stockAdjustForm.variantId) ?? targetVariant.stock_qty ?? 0;
    const value = stockAdjustForm.value ?? 0;
    const diff = stockAdjustForm.mode === "new_stock" ? value - currentStock : value;
    if (diff === 0) {
      setFormError("تغییری برای ثبت وجود ندارد.");
      return;
    }
    setFormError(null);
    await adjustProductStock.mutateAsync({
      product_id: productId,
      variant_id: stockAdjustForm.variantId,
      qty: diff,
      note: stockAdjustForm.reason || "تعدیل موجودی از ProductPanel",
    });
    setStockAdjustForm(emptyStockAdjustForm());
  }

  const isCreate = mode === "create";
  const savingProduct = createProduct.isPending || updateProduct.isPending;

  if (!isCreate && !productId) {
    return <PanelShell title="کالا" subtitle="شناسه موجود نیست" icon={<Package size={20} />} onClose={closeTop}><EmptyState title="شناسه کالا مشخص نیست" /></PanelShell>;
  }

  if (!isCreate && productQuery.isLoading) {
    return <PanelShell title="در حال بارگذاری کالا" icon={<Package size={20} />} onClose={closeTop}><Spinner /></PanelShell>;
  }

  if (!isCreate && productQuery.error) {
    return <PanelShell title="خطا" icon={<Package size={20} />} onClose={closeTop}><EmptyState title="خطا در دریافت کالا" description={(productQuery.error as Error).message} /></PanelShell>;
  }

  if (!isCreate && !product) {
    return <PanelShell title="کالا یافت نشد" icon={<Package size={20} />} onClose={closeTop}><EmptyState title="موجودیت یافت نشد" /></PanelShell>;
  }

  const productFormContent = (
    <Section title={isCreate ? "کالای جدید" : "ویرایش کالا"} description="کد کالا اگر خالی بماند توسط دیتابیس تولید می‌شود.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="نام کالا" required error={formError && !productForm.name.trim() ? formError : null}>
          <Input value={productForm.name} onChange={(event) => setProductForm((prev) => ({ ...prev, name: event.target.value }))} />
        </Field>
        <Field label="کد کالا">
          <Input dir="ltr" className="text-left" value={productForm.code} onChange={(event) => setProductForm((prev) => ({ ...prev, code: event.target.value }))} placeholder="خالی = تولید خودکار" />
        </Field>
        <Field label="دسته‌بندی">
          <Select value={productForm.categoryId} onChange={(event) => setProductForm((prev) => ({ ...prev, categoryId: event.target.value }))}>
            <option value="">—</option>
            {categories?.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </Select>
        </Field>
        <Field label="برند">
          <Select value={productForm.brandId} onChange={(event) => setProductForm((prev) => ({ ...prev, brandId: event.target.value }))}>
            <option value="">—</option>
            {brands?.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
          </Select>
        </Field>
        <Field label="فصل"><Input value={productForm.season} onChange={(event) => setProductForm((prev) => ({ ...prev, season: event.target.value }))} /></Field>
        <Field label="جنس"><Input value={productForm.material} onChange={(event) => setProductForm((prev) => ({ ...prev, material: event.target.value }))} /></Field>
        <Field label="آدرس تصویر" className="sm:col-span-2"><Input dir="ltr" className="text-left" value={productForm.imageUrl} onChange={(event) => setProductForm((prev) => ({ ...prev, imageUrl: event.target.value }))} placeholder="https://..." /></Field>
        <Field label="قیمت خرید پایه (تومان)">
          <NumberInput
            value={productForm.basePurchasePriceToman}
            onValueChange={(value) =>
              setProductForm((prev) => ({
                ...prev,
                basePurchasePriceToman: value,
                baseProfitPercent: calcProfitPercent(value, prev.baseSalePriceToman),
              }))
            }
          />
        </Field>
        <Field label="درصد سود پایه (%)" hint="وارد کردن درصد، قیمت فروش را محاسبه می‌کند">
          <NumberInput
            value={productForm.baseProfitPercent}
            onValueChange={(value) =>
              setProductForm((prev) => ({
                ...prev,
                baseProfitPercent: value,
                baseSalePriceToman: calcSaleFromProfit(prev.basePurchasePriceToman, value),
              }))
            }
            placeholder="مثلاً ۲۰"
          />
        </Field>
        <Field label="قیمت فروش پایه (تومان)">
          <NumberInput
            value={productForm.baseSalePriceToman}
            onValueChange={(value) =>
              setProductForm((prev) => ({
                ...prev,
                baseSalePriceToman: value,
                baseProfitPercent: calcProfitPercent(prev.basePurchasePriceToman, value),
              }))
            }
          />
        </Field>
        <Field label="حداقل موجودی"><NumberInput value={productForm.lowStockThreshold} onValueChange={(value) => setProductForm((prev) => ({ ...prev, lowStockThreshold: value }))} /></Field>
        <Field label="توضیحات" className="sm:col-span-2"><Input value={productForm.description} onChange={(event) => setProductForm((prev) => ({ ...prev, description: event.target.value }))} /></Field>
      </div>
      {isCreate && (
        <div className="mt-4 rounded-2xl border border-dashed border-primary/20 bg-primary/[0.03] p-3">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-extrabold text-slate-800">تنوع‌های اولیه</div>
              <p className="text-xs text-muted-foreground">اختیاری؛ چند واریانت را همراه ساخت کالا با یک ذخیره ثبت کنید.</p>
            </div>
            <Button size="sm" variant="secondary" onClick={addBatchVariantRow}><Plus size={16} /> افزودن ردیف دیگر</Button>
          </div>
          {renderBatchVariantRows()}
        </div>
      )}
      {formError && productForm.name.trim() && <div className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-destructive">{formError}</div>}
      <div className="mt-4 flex gap-2">
        <Button loading={savingProduct} onClick={handleProductSave}>ذخیره</Button>
        <Button variant="secondary" onClick={() => (isCreate ? closeTop() : setMode("view"))}>انصراف</Button>
      </div>
    </Section>
  );

  if (mode === "create" || mode === "edit") {
    return <PanelShell title={isCreate ? "کالای جدید" : product?.name ?? "ویرایش کالا"} subtitle={isCreate ? "Create Product" : product?.code ?? undefined} icon={<Package size={20} />} onClose={closeTop}>{productFormContent}</PanelShell>;
  }

  const variantColumns: Column<ProductVariantEntity>[] = [
    { key: "sku", header: "SKU", render: (row) => <span className="font-mono" dir="ltr">{row.sku ?? "—"}</span> },
    { key: "barcode", header: "بارکد", render: (row) => <span className="font-mono" dir="ltr">{row.barcode ?? "—"}</span> },
    { key: "attrs", header: "تنوع", render: (row) => [row.color, row.size].filter(Boolean).join(" / ") || "ساده" },
    { key: "stock", header: "موجودی", align: "center", render: (row) => <Badge tone={stockTone(stockByVariant.get(row.id) ?? row.stock_qty ?? 0)}>{toPersianDigits(stockByVariant.get(row.id) ?? row.stock_qty ?? 0)}</Badge> },
    { key: "purchase", header: "خرید", align: "left", render: (row) => <Money value={row.purchase_price ?? 0} /> },
    {
      key: "profit",
      header: "سود %",
      align: "center",
      render: (row) => {
        const p = calcProfitPercent(
          productMoney.rialToTomanNumber(row.purchase_price),
          productMoney.rialToTomanNumber(row.sale_price),
        );
        return p !== null ? (
          <span className="text-emerald-600 font-medium">{toPersianDigits(p)}٪</span>
        ) : (
          <span className="text-slate-300">—</span>
        );
      },
    },
    { key: "sale", header: "فروش", align: "left", render: (row) => <Money value={row.sale_price ?? 0} /> },
    { key: "action", header: "", render: (row) => <div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => setVariantEdit(formFromVariant(row))}>ویرایش</Button><Button size="sm" variant="secondary" onClick={() => openStockAdjust(row)}>تعدیل موجودی</Button></div> },
  ];

  const priceHistoryColumns: Column<ProductPriceHistoryEntry>[] = [
    { key: "created_at", header: "تاریخ", render: (row) => <PersianDate value={row.created_at} /> },
    { key: "scope", header: "دامنه", render: (row) => row.variant_id ? "واریانت" : "کالا" },
    { key: "old_price", header: "قیمت قبلی", align: "left", render: (row) => <div className="space-y-1"><div>خرید: <Money value={row.old_purchase_price ?? 0} /></div><div>فروش: <Money value={row.old_sale_price ?? 0} /></div></div> },
    { key: "new_price", header: "قیمت جدید", align: "left", render: (row) => <div className="space-y-1"><div>خرید: <Money value={row.new_purchase_price ?? 0} /></div><div>فروش: <Money value={row.new_sale_price ?? 0} /></div></div> },
    { key: "created_by", header: "تغییردهنده", render: (row) => <span className="font-mono text-xs" dir="ltr">{row.created_by ?? "—"}</span> },
    { key: "reason", header: "دلیل", render: (row) => row.reason ?? "—" },
  ];

  const variantFormView = (state: VariantFormState, setState: (updater: (prev: VariantFormState) => VariantFormState) => void, includeStock: boolean) => (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="SKU"><Input dir="ltr" className="text-left" value={state.sku} onChange={(e) => setState((p) => ({ ...p, sku: e.target.value }))} /></Field>
      <Field label="بارکد"><Input dir="ltr" className="text-left" value={state.barcode} onChange={(e) => setState((p) => ({ ...p, barcode: e.target.value }))} /></Field>
      <Field label="رنگ"><Input value={state.color} onChange={(e) => setState((p) => ({ ...p, color: e.target.value }))} /></Field>
      <Field label="سایز"><Input value={state.size} onChange={(e) => setState((p) => ({ ...p, size: e.target.value }))} /></Field>
      <Field label="قیمت خرید (تومان)">
        <NumberInput
          value={state.purchasePriceToman}
          onValueChange={(v) => setState((p) => ({
            ...p,
            purchasePriceToman: v,
            profitPercent: calcProfitPercent(v, p.salePriceToman),
          }))}
        />
      </Field>
      <Field label="درصد سود (%)" hint="وارد کردن درصد، قیمت فروش را محاسبه می‌کند">
        <NumberInput
          value={state.profitPercent}
          onValueChange={(v) => setState((p) => ({
            ...p,
            profitPercent: v,
            salePriceToman: calcSaleFromProfit(p.purchasePriceToman, v),
          }))}
          placeholder="مثلاً ۲۰"
        />
      </Field>
      <Field label="قیمت فروش (تومان)">
        <NumberInput
          value={state.salePriceToman}
          onValueChange={(v) => setState((p) => ({
            ...p,
            salePriceToman: v,
            profitPercent: calcProfitPercent(p.purchasePriceToman, v),
          }))}
        />
      </Field>
      {includeStock && <Field label="موجودی اولیه"><NumberInput value={state.initialStock} onValueChange={(v) => setState((p) => ({ ...p, initialStock: v }))} /></Field>}
    </div>
  );

  function renderBatchVariantRows() {
    return (
      <div className="space-y-3">
        {batchVariantForms.map((row, index) => (
          <div key={index} className="rounded-2xl border border-border bg-slate-50/50 p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="text-sm font-bold text-slate-700">ردیف {toPersianDigits(index + 1)}</div>
              <Button size="sm" variant="ghost" onClick={() => removeBatchVariantRow(index)}><Trash2 size={15} /> حذف</Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="SKU"><Input dir="ltr" className="text-left" value={row.sku} onChange={(e) => updateBatchVariant(index, (prev) => ({ ...prev, sku: e.target.value }))} /></Field>
              <Field label="بارکد"><Input dir="ltr" className="text-left" value={row.barcode} onChange={(e) => updateBatchVariant(index, (prev) => ({ ...prev, barcode: e.target.value }))} /></Field>
              <Field label="رنگ"><Input value={row.color} onChange={(e) => updateBatchVariant(index, (prev) => ({ ...prev, color: e.target.value }))} /></Field>
              <Field label="سایز"><Input value={row.size} onChange={(e) => updateBatchVariant(index, (prev) => ({ ...prev, size: e.target.value }))} /></Field>
              <Field label="قیمت خرید (تومان)">
                <NumberInput
                  value={row.purchasePriceToman}
                  onValueChange={(value) => updateBatchVariant(index, (prev) => ({
                    ...prev,
                    purchasePriceToman: value,
                    profitPercent: calcProfitPercent(value, prev.salePriceToman),
                  }))}
                />
              </Field>
              <Field label="درصد سود (%)">
                <NumberInput
                  value={row.profitPercent}
                  onValueChange={(value) => updateBatchVariant(index, (prev) => ({
                    ...prev,
                    profitPercent: value,
                    salePriceToman: calcSaleFromProfit(prev.purchasePriceToman, value),
                  }))}
                  placeholder="مثلاً ۲۰"
                />
              </Field>
              <Field label="قیمت فروش (تومان)">
                <NumberInput
                  value={row.salePriceToman}
                  onValueChange={(value) => updateBatchVariant(index, (prev) => ({
                    ...prev,
                    salePriceToman: value,
                    profitPercent: calcProfitPercent(prev.purchasePriceToman, value),
                  }))}
                />
              </Field>
              <Field label="موجودی اولیه"><NumberInput value={row.initialStock} onValueChange={(value) => updateBatchVariant(index, (prev) => ({ ...prev, initialStock: value }))} /></Field>
            </div>
          </div>
        ))}
        <Button variant="secondary" onClick={addBatchVariantRow}><Plus size={16} /> افزودن ردیف دیگر</Button>
      </div>
    );
  }

  return (
    <PanelShell title={product!.name} subtitle={product!.code ? `کد: ${product!.code}` : "کالا"} icon={<Package size={20} />} onClose={closeTop}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={product!.is_active ? "success" : "neutral"}>{product!.is_active ? "فعال" : "غیرفعال"}</Badge>
          {product!.code && <Badge tone="primary">{product!.code}</Badge>}
          <Badge tone={stockTone(totalStock)}>موجودی کل: {toPersianDigits(totalStock)}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/products/${product!.id}`} className="btn-secondary min-h-9 rounded-xl px-3 py-1.5 text-xs">
            مشاهده صفحه کامل
          </Link>
          <Button size="sm" variant="secondary" onClick={() => setMode("edit")}>ویرایش</Button>
          <Button size="sm" variant="danger" loading={deactivateProduct.isPending} onClick={handleDeactivate}>غیرفعال‌سازی</Button>
        </div>

        <Tabs
          defaultValue={initialTab}
          items={[
            {
              value: "summary",
              label: "خلاصه",
              content: (
                <div className="space-y-4">
                  <Section title="اطلاعات کالا">
                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                      <div><dt className="text-muted-foreground">نام</dt><dd className="font-bold text-slate-800">{product!.name}</dd></div>
                      <div><dt className="text-muted-foreground">کد</dt><dd className="font-mono" dir="ltr">{product!.code ?? "—"}</dd></div>
                      <div><dt className="text-muted-foreground">فصل</dt><dd>{product!.season ?? "—"}</dd></div>
                      <div><dt className="text-muted-foreground">جنس</dt><dd>{product!.material ?? "—"}</dd></div>
                    </dl>
                  </Section>
                  <Section title="قیمت‌های پایه">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-border p-3">
                        <div className="text-sm text-muted-foreground">خرید پایه</div>
                        <Money value={product!.base_purchase_price} />
                      </div>
                      <div className="rounded-xl border border-border p-3">
                        <div className="text-sm text-muted-foreground">درصد سود</div>
                        <span className="font-bold text-emerald-600">
                          {(() => {
                            const p = calcProfitPercent(
                              productMoney.rialToTomanNumber(product!.base_purchase_price),
                              productMoney.rialToTomanNumber(product!.base_sale_price),
                            );
                            return p !== null ? `${toPersianDigits(p)}٪` : "—";
                          })()}
                        </span>
                      </div>
                      <div className="rounded-xl border border-border p-3">
                        <div className="text-sm text-muted-foreground">فروش پایه</div>
                        <Money value={product!.base_sale_price} />
                      </div>
                    </div>
                  </Section>
                </div>
              ),
            },
            {
              value: "variants",
              label: "واریانت‌ها",
              content: (
                <div className="space-y-4">
                  <DataTable rows={product!.variants} columns={variantColumns} keyExtractor={(row) => row.id} empty={<EmptyState title="واریانتی برای این کالا ثبت نشده" />} />
                  {stockAdjustForm.variantId && (
                    <Section title="تعدیل موجودی" description="اختلاف موجودی از مسیر fn_add_stock_movement با type='adjust' ثبت می‌شود.">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="حالت تعدیل">
                          <Select value={stockAdjustForm.mode} onChange={(event) => setStockAdjustForm((prev) => ({ ...prev, mode: event.target.value as StockAdjustFormState["mode"] }))}>
                            <option value="new_stock">ثبت موجودی جدید</option>
                            <option value="delta">افزایش/کاهش نسبت به موجودی فعلی</option>
                          </Select>
                        </Field>
                        <Field label={stockAdjustForm.mode === "new_stock" ? "موجودی جدید" : "مقدار تغییر (+/-)"}>
                          <NumberInput value={stockAdjustForm.value} onValueChange={(value) => setStockAdjustForm((prev) => ({ ...prev, value }))} />
                        </Field>
                        <Field label="دلیل" className="sm:col-span-2"><Input value={stockAdjustForm.reason} onChange={(event) => setStockAdjustForm((prev) => ({ ...prev, reason: event.target.value }))} placeholder="مثلاً: انبارگردانی" /></Field>
                      </div>
                      {formError && <div className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-destructive">{formError}</div>}
                      <div className="mt-4 flex gap-2"><Button loading={adjustProductStock.isPending} onClick={handleAdjustStock}>ثبت تعدیل</Button><Button variant="secondary" onClick={() => setStockAdjustForm(emptyStockAdjustForm())}>انصراف</Button></div>
                    </Section>
                  )}
                  <Section title="افزودن واریانت جدید" description="موجودی اولیه از مسیر fn_add_stock_movement ثبت می‌شود.">
                    <div className="mb-4 flex flex-wrap gap-2">
                      <Button size="sm" variant={!batchOpen ? "primary" : "secondary"} onClick={() => setBatchOpen(false)}>تکی</Button>
                      <Button size="sm" variant={batchOpen ? "primary" : "secondary"} onClick={() => setBatchOpen(true)}>افزودن دسته‌ای</Button>
                    </div>
                    {batchOpen ? (
                      <>
                        {renderBatchVariantRows()}
                        <div className="mt-4"><Button loading={savingBatch} onClick={handleSaveBatchVariants}>ذخیره همه</Button></div>
                      </>
                    ) : (
                      <>
                        {variantFormView(variantForm, setVariantForm, true)}
                        <div className="mt-4"><Button loading={createVariant.isPending} onClick={handleCreateVariant}>افزودن واریانت</Button></div>
                      </>
                    )}
                  </Section>
                  {variantEdit && (
                    <Section title="ویرایش واریانت" description="ویرایش قیمت‌ها و شناسه‌های واریانت؛ موجودی از مسیر انبار تغییر می‌کند.">
                      {variantFormView(variantEdit, (updater) => setVariantEdit((prev) => updater(prev ?? emptyVariantForm())), false)}
                      <div className="mt-4 flex gap-2"><Button loading={updateVariant.isPending} onClick={handleUpdateVariant}>ذخیره واریانت</Button><Button variant="secondary" onClick={() => setVariantEdit(null)}>انصراف</Button></div>
                    </Section>
                  )}
                </div>
              ),
            },
            {
              value: "price-history",
              label: "تاریخچه قیمت",
              content: (
                <div className="space-y-4">
                  <Section title="تغییر قیمت" description="از RPC رسمی change_product_price استفاده می‌شود و در product_price_history ثبت می‌شود.">
                    {!priceFormOpen ? (
                      <Button onClick={() => setPriceFormOpen(true)}>تغییر قیمت</Button>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="قیمت خرید جدید (تومان)">
                            <NumberInput
                              value={priceForm.purchasePriceToman}
                              onValueChange={(value) => setPriceForm((prev) => ({
                                ...prev,
                                purchasePriceToman: value,
                                profitPercent: calcProfitPercent(value, prev.salePriceToman),
                              }))}
                            />
                          </Field>
                          <Field label="درصد سود (%)" hint="وارد کردن درصد، قیمت فروش را محاسبه می‌کند">
                            <NumberInput
                              value={priceForm.profitPercent}
                              onValueChange={(value) => setPriceForm((prev) => ({
                                ...prev,
                                profitPercent: value,
                                salePriceToman: calcSaleFromProfit(prev.purchasePriceToman, value),
                              }))}
                              placeholder="مثلاً ۲۰"
                            />
                          </Field>
                          <Field label="قیمت فروش جدید (تومان)">
                            <NumberInput
                              value={priceForm.salePriceToman}
                              onValueChange={(value) => setPriceForm((prev) => ({
                                ...prev,
                                salePriceToman: value,
                                profitPercent: calcProfitPercent(prev.purchasePriceToman, value),
                              }))}
                            />
                          </Field>
                          <Field label="دلیل تغییر" className="sm:col-span-2"><Input value={priceForm.reason} onChange={(event) => setPriceForm((prev) => ({ ...prev, reason: event.target.value }))} placeholder="مثلاً: بروزرسانی لیست قیمت" /></Field>
                        </div>
                        <label className="flex items-center gap-2 text-sm text-slate-600">
                          <input type="checkbox" checked={priceForm.applyToVariants} onChange={(event) => setPriceForm((prev) => ({ ...prev, applyToVariants: event.target.checked }))} />
                          اعمال قیمت روی همه واریانت‌های فعال کالا
                        </label>
                        {formError && <div className="rounded-xl bg-rose-50 p-3 text-sm text-destructive">{formError}</div>}
                        <div className="flex gap-2"><Button loading={changeProductPrice.isPending} onClick={handleChangePrice}>ذخیره قیمت</Button><Button variant="secondary" onClick={() => setPriceFormOpen(false)}>انصراف</Button></div>
                      </div>
                    )}
                  </Section>
                  <Section title="تاریخچه قیمت" description="آخرین تغییرات ثبت‌شده در product_price_history">
                    {priceHistoryQuery.isLoading ? <Spinner /> : priceHistoryQuery.error ? <EmptyState title="خطا در دریافت تاریخچه قیمت" description={(priceHistoryQuery.error as Error).message} /> : <DataTable rows={priceHistoryQuery.data ?? []} columns={priceHistoryColumns} keyExtractor={(row) => row.id} empty={<EmptyState title="تاریخچه قیمتی ثبت نشده" />} />}
                  </Section>
                </div>
              ),
            },
            {
              value: "stock",
              label: "موجودی",
              content: stockQuery.isLoading ? <Spinner /> : stockQuery.error ? <EmptyState title="خطا در دریافت موجودی" description={(stockQuery.error as Error).message} /> : (
                <Section title="خلاصه موجودی" description="بر اساس v_product_stock و SUM(stock_movements.qty)">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-border p-3"><div className="text-sm text-muted-foreground">موجودی کل</div><Badge tone={stockTone(totalStock)}>{toPersianDigits(totalStock)}</Badge></div>
                    <div className="rounded-xl border border-border p-3"><div className="text-sm text-muted-foreground">تعداد واریانت</div><strong>{toPersianDigits(product!.variants.length)}</strong></div>
                    <div className="rounded-xl border border-border p-3"><div className="text-sm text-muted-foreground">آخرین حرکت</div><PersianDate value={stockQuery.data?.[0]?.last_movement_at ?? null} /></div>
                  </div>
                </Section>
              ),
            },
          ]}
        />
      </div>
    </PanelShell>
  );
}
