"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

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
