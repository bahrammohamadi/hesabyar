"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MoreVertical, Package } from "lucide-react";
import type { PanelInstance, PanelMode } from "@/src/core/panel-manager/types";
import { usePanelManager } from "@/src/core/panel-manager/panel-manager.store";
import { useOrg } from "@/lib/hooks/useOrg";
import { useBrands, useCategories } from "@/lib/hooks/useProducts";
import {
  productMoney,
  useCreateProduct,
  useCreateVariant,
  useDeactivateProduct,
  useProductEntity,
  useProductStock,
  useUpdateProduct,
  useUpdateVariant,
  type ProductEntity,
  type ProductVariantEntity,
} from "@/src/core/services/product-service";
import { Badge, Button, DataTable, EmptyState, Field, IconButton, Input, NumberInput, PanelShell, Section, Select, Spinner, Tabs, type Column } from "@/src/shared/ui";
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
  initialStock: number | null;
};

function emptyProductForm(): ProductFormState {
  return { name: "", code: "", season: "", material: "", imageUrl: "", categoryId: "", brandId: "", basePurchasePriceToman: null, baseSalePriceToman: null, lowStockThreshold: 3, description: "" };
}

function emptyVariantForm(): VariantFormState {
  return { color: "", size: "", sku: "", barcode: "", purchasePriceToman: null, salePriceToman: null, initialStock: 0 };
}

function formFromProduct(product: ProductEntity): ProductFormState {
  return {
    name: product.name,
    code: product.code ?? "",
    season: product.season ?? "",
    material: product.material ?? "",
    imageUrl: product.image_url ?? "",
    categoryId: product.category_id ?? "",
    brandId: product.brand_id ?? "",
    basePurchasePriceToman: productMoney.rialToTomanNumber(product.base_purchase_price),
    baseSalePriceToman: productMoney.rialToTomanNumber(product.base_sale_price),
    lowStockThreshold: product.low_stock_threshold,
    description: product.description ?? "",
  };
}

function formFromVariant(variant: ProductVariantEntity): VariantFormState {
  return {
    id: variant.id,
    color: variant.color ?? "",
    size: variant.size ?? "",
    sku: variant.sku ?? "",
    barcode: variant.barcode ?? "",
    purchasePriceToman: productMoney.rialToTomanNumber(variant.purchase_price),
    salePriceToman: productMoney.rialToTomanNumber(variant.sale_price),
    initialStock: null,
  };
}

export function ProductPanel({ panel }: { panel: PanelInstance }) {
  const { closeTop, replaceTop } = usePanelManager();
  const { orgId, branchId } = useOrg();
  const { data: categories } = useCategories(orgId);
  const { data: brands } = useBrands(orgId);
  const productId = panel.entityId;
  const [mode, setMode] = useState<PanelMode>(panel.mode);
  const productQuery = useProductEntity(productId);
  const stockQuery = useProductStock(productId);
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deactivateProduct = useDeactivateProduct();
  const createVariant = useCreateVariant(productId);
  const updateVariant = useUpdateVariant();
  const [productForm, setProductForm] = useState<ProductFormState>(emptyProductForm());
  const [variantForm, setVariantForm] = useState<VariantFormState>(emptyVariantForm());
  const [variantEdit, setVariantEdit] = useState<VariantFormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const product = productQuery.data;

  useEffect(() => {
    if (mode === "create") setProductForm(emptyProductForm());
    else if (product) setProductForm(formFromProduct(product));
  }, [mode, product]);

  const stockByVariant = useMemo(() => new Map((stockQuery.data ?? []).map((row) => [row.product_variant_id, row.current_stock])), [stockQuery.data]);
  const totalStock = (stockQuery.data ?? []).reduce((sum, row) => sum + row.current_stock, 0);

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
        replaceTop({ type: "product", entityId: created.id, mode: "view", title: created.name, context: panel.context });
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
        <Field label="قیمت خرید پایه (تومان)"><NumberInput value={productForm.basePurchasePriceToman} onValueChange={(value) => setProductForm((prev) => ({ ...prev, basePurchasePriceToman: value }))} /></Field>
        <Field label="قیمت فروش پایه (تومان)"><NumberInput value={productForm.baseSalePriceToman} onValueChange={(value) => setProductForm((prev) => ({ ...prev, baseSalePriceToman: value }))} /></Field>
        <Field label="حداقل موجودی"><NumberInput value={productForm.lowStockThreshold} onValueChange={(value) => setProductForm((prev) => ({ ...prev, lowStockThreshold: value }))} /></Field>
        <Field label="توضیحات" className="sm:col-span-2"><Input value={productForm.description} onChange={(event) => setProductForm((prev) => ({ ...prev, description: event.target.value }))} /></Field>
      </div>
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
    { key: "sale", header: "فروش", align: "left", render: (row) => <Money value={row.sale_price ?? 0} /> },
    { key: "action", header: "", render: (row) => <Button size="sm" variant="ghost" onClick={() => setVariantEdit(formFromVariant(row))}>ویرایش</Button> },
  ];

  const variantFormView = (state: VariantFormState, setState: (updater: (prev: VariantFormState) => VariantFormState) => void, includeStock: boolean) => (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="SKU"><Input dir="ltr" className="text-left" value={state.sku} onChange={(e) => setState((p) => ({ ...p, sku: e.target.value }))} /></Field>
      <Field label="بارکد"><Input dir="ltr" className="text-left" value={state.barcode} onChange={(e) => setState((p) => ({ ...p, barcode: e.target.value }))} /></Field>
      <Field label="رنگ"><Input value={state.color} onChange={(e) => setState((p) => ({ ...p, color: e.target.value }))} /></Field>
      <Field label="سایز"><Input value={state.size} onChange={(e) => setState((p) => ({ ...p, size: e.target.value }))} /></Field>
      <Field label="قیمت خرید (تومان)"><NumberInput value={state.purchasePriceToman} onValueChange={(v) => setState((p) => ({ ...p, purchasePriceToman: v }))} /></Field>
      <Field label="قیمت فروش (تومان)"><NumberInput value={state.salePriceToman} onValueChange={(v) => setState((p) => ({ ...p, salePriceToman: v }))} /></Field>
      {includeStock && <Field label="موجودی اولیه"><NumberInput value={state.initialStock} onValueChange={(v) => setState((p) => ({ ...p, initialStock: v }))} /></Field>}
    </div>
  );

  return (
    <PanelShell title={product!.name} subtitle={product!.code ? `کد: ${product!.code}` : "کالا"} icon={<Package size={20} />} onClose={closeTop} actions={<IconButton aria-label="گزینه‌های کالا"><MoreVertical size={18} /></IconButton>}>
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
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-border p-3"><div className="text-sm text-muted-foreground">خرید پایه</div><Money value={product!.base_purchase_price} /></div>
                      <div className="rounded-xl border border-border p-3"><div className="text-sm text-muted-foreground">فروش پایه</div><Money value={product!.base_sale_price} /></div>
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
                  <Section title="افزودن واریانت جدید" description="موجودی اولیه از مسیر fn_add_stock_movement ثبت می‌شود.">
                    {variantFormView(variantForm, setVariantForm, true)}
                    <div className="mt-4"><Button loading={createVariant.isPending} onClick={handleCreateVariant}>افزودن واریانت</Button></div>
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
