"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { toEnglishDigits } from "@/src/shared/format";
import { tomanToRial } from "@/lib/utils/format";
import { useToast } from "@/src/shared/ui";

export interface ProductVariantEntity {
  id: string;
  product_id: string;
  color: string | null;
  size: string | null;
  sku: string | null;
  barcode: string | null;
  purchase_price: number | null;
  sale_price: number | null;
  stock_qty: number;
  is_active: boolean;
}

export interface ProductEntity {
  id: string;
  org_id: string;
  branch_id: string | null;
  name: string;
  code: string | null;
  season: string | null;
  material: string | null;
  category_id: string | null;
  brand_id: string | null;
  description: string | null;
  image_url: string | null;
  base_purchase_price: number;
  base_sale_price: number;
  low_stock_threshold: number;
  is_active: boolean;
  created_at: string;
  category: { name: string } | null;
  brand: { name: string } | null;
  variants: ProductVariantEntity[];
}

export interface ProductStock {
  product_id: string;
  product_variant_id: string;
  current_stock: number;
  last_movement_at: string | null;
}

export interface ProductPriceHistoryEntry {
  id: string;
  org_id: string;
  product_id: string;
  variant_id: string | null;
  old_purchase_price: number | null;
  new_purchase_price: number | null;
  old_sale_price: number | null;
  new_sale_price: number | null;
  reason: string | null;
  created_at: string;
  created_by: string | null;
}

export interface ProductPriceChangeInput {
  product_id: string;
  purchase_price_toman: number;
  sale_price_toman: number;
  apply_variants?: boolean;
  reason?: string | null;
}

export interface ProductStockAdjustInput {
  product_id: string;
  variant_id: string;
  qty: number;
  note?: string | null;
}

type ProductRow = Omit<ProductEntity, "variants" | "category" | "brand"> & {
  category: { name: string } | null;
  brand: { name: string } | null;
  product_variants: ProductVariantEntity[] | null;
};

type ProductStockRow = {
  product_id: string;
  product_variant_id: string;
  current_stock: number | string | null;
  last_movement_at: string | null;
};

export async function getProductById(id: string): Promise<ProductEntity | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("products")
    .select(`id, org_id, branch_id, name, code, season, material, category_id, brand_id, description, image_url,
      base_purchase_price, base_sale_price, low_stock_threshold, is_active, created_at,
      category:categories(name), brand:brands(name),
      product_variants(id, product_id, color, size, sku, barcode, purchase_price, sale_price, stock_qty, is_active)`)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as ProductRow;
  return {
    ...row,
    variants: row.product_variants ?? [],
  };
}

export async function getProductStock(id: string): Promise<ProductStock[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("v_product_stock")
    .select("product_id,product_variant_id,current_stock,last_movement_at")
    .eq("product_id", id)
    .order("current_stock", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as ProductStockRow[]).map((row) => ({
    product_id: row.product_id,
    product_variant_id: row.product_variant_id,
    current_stock: Number(row.current_stock ?? 0),
    last_movement_at: row.last_movement_at,
  }));
}

export async function getPriceHistory(productId: string): Promise<ProductPriceHistoryEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("product_price_history")
    .select("id, org_id, product_id, variant_id, old_purchase_price, new_purchase_price, old_sale_price, new_sale_price, reason, created_at, created_by")
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error("خطا در دریافت تاریخچه قیمت: " + error.message);
  return (data ?? []) as ProductPriceHistoryEntry[];
}

export async function changePrice(input: ProductPriceChangeInput): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("change_product_price", {
    p_product: input.product_id,
    p_purchase_price: tomanToRial(input.purchase_price_toman || 0),
    p_sale_price: tomanToRial(input.sale_price_toman || 0),
    p_apply_variants: input.apply_variants ?? true,
    p_reason: input.reason?.trim() || null,
  });
  if (error) throw new Error("خطا در تغییر قیمت: " + error.message);
}


export async function adjustStock(input: ProductStockAdjustInput): Promise<void> {
  if (input.qty !== Math.trunc(input.qty)) throw new Error("مقدار تعدیل باید عدد صحیح باشد.");
  if (input.qty === 0) throw new Error("مقدار تعدیل صفر است.");
  const supabase = createClient();
  const { error } = await supabase.rpc("fn_add_stock_movement", {
    p_product_id: input.product_id,
    p_variant_id: input.variant_id,
    p_type: "adjust",
    p_qty: input.qty,
    p_ref_type: null,
    p_ref_id: null,
    p_note: input.note?.trim() || "تعدیل موجودی از ProductPanel",
  });
  if (error) throw new Error("خطا در تعدیل موجودی: " + error.message);
}

export function useProductPriceHistory(id?: string | null) {
  return useQuery({
    queryKey: ["entity", "product", "price-history", id] as const,
    enabled: !!id,
    staleTime: 30_000,
    queryFn: () => getPriceHistory(id!),
  });
}

export function useProductEntity(id?: string | null) {
  return useQuery({
    queryKey: ["entity", "product", "detail", id] as const,
    enabled: !!id,
    staleTime: 60_000,
    queryFn: () => getProductById(id!),
  });
}

export function useProductStock(id?: string | null) {
  return useQuery({
    queryKey: ["entity", "product", "stock", id] as const,
    enabled: !!id,
    staleTime: 60_000,
    queryFn: () => getProductStock(id!),
  });
}

export interface ProductMutationInput {
  org_id?: string;
  branch_id?: string | null;
  name: string;
  code?: string | null;
  season?: string | null;
  material?: string | null;
  description?: string | null;
  image_url?: string | null;
  category_id?: string | null;
  brand_id?: string | null;
  low_stock_threshold?: number;
  base_purchase_price_toman?: number | null;
  base_sale_price_toman?: number | null;
}

export interface ProductUpdatePatch extends Partial<Omit<ProductMutationInput, "org_id" | "branch_id">> {
  is_active?: boolean;
}

export interface VariantMutationInput {
  org_id?: string;
  branch_id?: string | null;
  product_id?: string;
  color?: string | null;
  size?: string | null;
  sku?: string | null;
  barcode?: string | null;
  purchase_price_toman?: number | null;
  sale_price_toman?: number | null;
  initial_stock?: number | null;
}

export type VariantUpdatePatch = Omit<VariantMutationInput, "org_id" | "branch_id" | "product_id" | "initial_stock">;

type ProductWritePayload = {
  name: string;
  code: string | null;
  season: string | null;
  material: string | null;
  description: string | null;
  image_url: string | null;
  category_id: string | null;
  brand_id: string | null;
  low_stock_threshold: number;
  base_purchase_price?: number;
  base_sale_price?: number;
  is_active?: boolean;
};

type VariantWritePayload = {
  org_id?: string;
  branch_id?: string | null;
  product_id?: string;
  color: string | null;
  size: string | null;
  sku: string | null;
  barcode: string | null;
  purchase_price: number | null;
  sale_price: number | null;
};

function cleanText(value?: string | null) {
  const text = value?.trim();
  return text ? text : null;
}

function toNumber(value?: number | null) {
  if (value === null || value === undefined) return null;
  if (Number.isNaN(value)) return null;
  return value;
}

function normalizeStock(value?: number | null) {
  const stock = toNumber(value) ?? 0;
  if (stock !== Math.trunc(stock)) throw new Error("موجودی اولیه باید عدد صحیح باشد.");
  return stock;
}

function validateProductName(name: string) {
  const clean = name.trim();
  if (!clean) throw new Error("نام کالا الزامی است.");
  return clean;
}

function toProductPayload(input: ProductMutationInput): ProductWritePayload {
  return {
    name: validateProductName(input.name),
    code: cleanText(input.code),
    season: cleanText(input.season),
    material: cleanText(input.material),
    description: cleanText(input.description),
    image_url: cleanText(input.image_url),
    category_id: input.category_id || null,
    brand_id: input.brand_id || null,
    low_stock_threshold: input.low_stock_threshold ?? 3,
    base_purchase_price: input.base_purchase_price_toman ? tomanToRial(input.base_purchase_price_toman) : undefined,
    base_sale_price: input.base_sale_price_toman ? tomanToRial(input.base_sale_price_toman) : undefined,
  };
}

function toProductPatch(patch: ProductUpdatePatch): Partial<ProductWritePayload> {
  const payload: Partial<ProductWritePayload> = {};
  if (patch.name !== undefined) payload.name = validateProductName(patch.name);
  if (patch.code !== undefined) payload.code = cleanText(patch.code);
  if (patch.season !== undefined) payload.season = cleanText(patch.season);
  if (patch.material !== undefined) payload.material = cleanText(patch.material);
  if (patch.description !== undefined) payload.description = cleanText(patch.description);
  if (patch.image_url !== undefined) payload.image_url = cleanText(patch.image_url);
  if (patch.category_id !== undefined) payload.category_id = patch.category_id || null;
  if (patch.brand_id !== undefined) payload.brand_id = patch.brand_id || null;
  if (patch.low_stock_threshold !== undefined) payload.low_stock_threshold = patch.low_stock_threshold ?? 3;
  if (patch.base_purchase_price_toman !== undefined) payload.base_purchase_price = patch.base_purchase_price_toman ? tomanToRial(patch.base_purchase_price_toman) : 0;
  if (patch.base_sale_price_toman !== undefined) payload.base_sale_price = patch.base_sale_price_toman ? tomanToRial(patch.base_sale_price_toman) : 0;
  if (patch.is_active !== undefined) payload.is_active = patch.is_active;
  return payload;
}

function toVariantPayload(input: VariantMutationInput): VariantWritePayload {
  return {
    org_id: input.org_id,
    branch_id: input.branch_id ?? null,
    product_id: input.product_id,
    color: cleanText(input.color),
    size: cleanText(input.size),
    sku: cleanText(input.sku),
    barcode: cleanText(input.barcode),
    purchase_price: input.purchase_price_toman ? tomanToRial(input.purchase_price_toman) : null,
    sale_price: input.sale_price_toman ? tomanToRial(input.sale_price_toman) : null,
  };
}

function rialToTomanNumber(rial: number | null | undefined) {
  return Math.round((rial ?? 0) / 10);
}

export async function createProduct(input: ProductMutationInput & { org_id: string }): Promise<ProductEntity> {
  const supabase = createClient();
  const payload = toProductPayload(input);
  const { data, error } = await supabase
    .from("products")
    .insert({ org_id: input.org_id, branch_id: input.branch_id ?? null, ...payload })
    .select("id")
    .single();
  if (error) throw new Error("خطا در ساخت کالا: " + error.message);
  const product = await getProductById(data.id as string);
  if (!product) throw new Error("کالا ساخته شد اما دوباره خوانده نشد.");
  return product;
}

export async function updateProduct(id: string, patch: ProductUpdatePatch): Promise<ProductEntity> {
  const supabase = createClient();
  const { error } = await supabase.from("products").update(toProductPatch(patch)).eq("id", id);
  if (error) throw new Error("خطا در ویرایش کالا: " + error.message);
  const product = await getProductById(id);
  if (!product) throw new Error("کالا یافت نشد.");
  return product;
}

export async function deactivateProduct(id: string) {
  return updateProduct(id, { is_active: false });
}

export async function reactivateProduct(id: string) {
  return updateProduct(id, { is_active: true });
}

export async function createVariant(productId: string, input: VariantMutationInput & { org_id: string }): Promise<ProductVariantEntity> {
  const supabase = createClient();
  const payload = toVariantPayload({ ...input, product_id: productId });
  const { data, error } = await supabase
    .from("product_variants")
    .insert({ ...payload, org_id: input.org_id, branch_id: input.branch_id ?? null, product_id: productId, stock_qty: 0 })
    .select("id, product_id, color, size, sku, barcode, purchase_price, sale_price, stock_qty, is_active")
    .single();
  if (error) throw new Error("خطا در ساخت واریانت: " + error.message);

  const initialStock = normalizeStock(input.initial_stock);
  if (initialStock !== 0) {
    const { error: stockError } = await supabase.rpc("fn_add_stock_movement", {
      p_product_id: productId,
      p_variant_id: data.id,
      p_type: "opening",
      p_qty: initialStock,
      p_ref_type: null,
      p_ref_id: null,
      p_note: "موجودی اولیه واریانت از ProductPanel",
    });
    if (stockError) throw new Error("واریانت ساخته شد اما ثبت موجودی اولیه خطا داد: " + stockError.message);
  }

  return data as ProductVariantEntity;
}

export async function updateVariant(id: string, patch: VariantUpdatePatch): Promise<ProductVariantEntity> {
  const supabase = createClient();
  const payload = toVariantPayload(patch);
  const { data, error } = await supabase
    .from("product_variants")
    .update(payload)
    .eq("id", id)
    .select("id, product_id, color, size, sku, barcode, purchase_price, sale_price, stock_qty, is_active")
    .single();
  if (error) throw new Error("خطا در ویرایش واریانت: " + error.message);
  return data as ProductVariantEntity;
}

function invalidateProductQueries(queryClient: ReturnType<typeof useQueryClient>, id?: string) {
  // "products"، "all-variants" و "all-products" هر سه باید invalidate شوند.
  // React Query v5: ["all-variants",...] با ["products"] prefix match نمی‌شود.
  queryClient.invalidateQueries({ queryKey: ["products"] });
  queryClient.invalidateQueries({ queryKey: ["all-variants"] });
  queryClient.invalidateQueries({ queryKey: ["entity", "product"] });
  if (id) {
    queryClient.invalidateQueries({ queryKey: ["entity", "product", "detail", id] });
    queryClient.invalidateQueries({ queryKey: ["entity", "product", "stock", id] });
  }
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: createProduct,
    onSuccess: (product) => {
      invalidateProductQueries(queryClient, product.id);
      toast({ title: "کالا ساخته شد", description: product.name, tone: "success" });
    },
    onError: (error) => toast({ title: "خطا در ساخت کالا", description: (error as Error).message, tone: "error" }),
  });
}

export function useAdjustProductStock() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: adjustStock,
    onSuccess: (_, input) => {
      invalidateProductQueries(queryClient, input.product_id);
      toast({ title: "موجودی تعدیل شد", description: input.note || "گردش انبار ثبت شد", tone: "success" });
    },
    onError: (error) => toast({ title: "خطا در تعدیل موجودی", description: (error as Error).message, tone: "error" }),
  });
}

export function useChangeProductPrice() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: changePrice,
    onSuccess: (_, input) => {
      invalidateProductQueries(queryClient, input.product_id);
      queryClient.invalidateQueries({ queryKey: ["entity", "product", "price-history", input.product_id] });
      // all-variants در ProductSelector باید بعد از تغییر قیمت هم stale شود
      queryClient.invalidateQueries({ queryKey: ["all-variants"] });
      toast({ title: "قیمت کالا ثبت شد", description: input.reason || "تاریخچه قیمت به‌روزرسانی شد", tone: "success" });
    },
    onError: (error) => toast({ title: "خطا در تغییر قیمت", description: (error as Error).message, tone: "error" }),
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ProductUpdatePatch }) => updateProduct(id, patch),
    onSuccess: (product) => {
      invalidateProductQueries(queryClient, product.id);
      toast({ title: "کالا ذخیره شد", description: product.name, tone: "success" });
    },
    onError: (error) => toast({ title: "خطا در ذخیره کالا", description: (error as Error).message, tone: "error" }),
  });
}

export function useDeactivateProduct() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: deactivateProduct,
    onSuccess: (product) => {
      invalidateProductQueries(queryClient, product.id);
      toast({ title: "کالا غیرفعال شد", description: product.name, tone: "success" });
    },
    onError: (error) => toast({ title: "خطا در غیرفعال‌سازی کالا", description: (error as Error).message, tone: "error" }),
  });
}

export function useCreateVariant(productId?: string | null) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (input: VariantMutationInput & { org_id: string }) => createVariant(productId!, input),
    onSuccess: (variant) => {
      invalidateProductQueries(queryClient, variant.product_id);
      toast({ title: "واریانت ساخته شد", description: variant.sku ?? variant.barcode ?? "واریانت جدید", tone: "success" });
    },
    onError: (error) => toast({ title: "خطا در ساخت واریانت", description: (error as Error).message, tone: "error" }),
  });
}

export function useUpdateVariant() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: VariantUpdatePatch }) => updateVariant(id, patch),
    onSuccess: (variant) => {
      invalidateProductQueries(queryClient, variant.product_id);
      toast({ title: "واریانت ذخیره شد", description: variant.sku ?? variant.barcode ?? "واریانت", tone: "success" });
    },
    onError: (error) => toast({ title: "خطا در ذخیره واریانت", description: (error as Error).message, tone: "error" }),
  });
}

export const productMoney = { rialToTomanNumber };
