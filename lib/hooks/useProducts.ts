"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { normalizeSearchText } from "@/lib/utils/format";

export interface ProductWithVariants {
  id: string;
  name: string;
  code: string | null;
  season: string | null;
  material: string | null;
  description: string | null;
  image_url: string | null;
  category_id: string | null;
  brand_id: string | null;
  base_purchase_price: number;
  base_sale_price: number;
  low_stock_threshold: number;
  is_active: boolean;
  category?: { name: string } | null;
  brand?: { name: string } | null;
  product_variants: {
    id: string;
    color: string | null;
    size: string | null;
    sku: string | null;
    barcode: string | null;
    purchase_price: number | null;
    sale_price: number | null;
    stock_qty: number;
    is_active: boolean;
  }[];
}

export function useProducts(orgId: string | null, search = "") {
  return useQuery({
    queryKey: ["products", orgId, search],
    enabled: !!orgId,
    queryFn: async (): Promise<ProductWithVariants[]> => {
      const supabase = createClient();
      let query = supabase
        .from("products")
        .select(
          `id, name, code, season, material, description, image_url, category_id, brand_id,
           base_purchase_price, base_sale_price, low_stock_threshold, is_active,
           category:categories(name), brand:brands(name),
           product_variants(id, color, size, sku, barcode, purchase_price, sale_price, stock_qty, is_active)`
        )
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      const rows = (data as unknown as ProductWithVariants[]) ?? [];
      const term = normalizeSearchText(search);
      if (!term) return rows;
      return rows.filter((product) => {
        const haystack = [
          product.name,
          product.code,
          product.season,
          product.material,
          product.category?.name,
          product.brand?.name,
          ...product.product_variants.flatMap((variant) => [variant.sku, variant.barcode, variant.color, variant.size]),
        ].filter(Boolean).join(" ");
        return normalizeSearchText(haystack).includes(term);
      });
    },
  });
}

export function useCategories(orgId: string | null) {
  return useQuery({
    queryKey: ["categories", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("categories")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useBrands(orgId: string | null) {
  return useQuery({
    queryKey: ["brands", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("brands")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}
