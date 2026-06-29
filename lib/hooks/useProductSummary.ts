"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { entityQueryKeys } from "@/lib/entities/query-keys";

export interface ProductSummary {
  id: string;
  name: string;
  code: string | null;
  imageUrl: string | null;
  basePurchasePrice: number;
  baseSalePrice: number;
  currentPurchasePrice: number;
  currentSalePrice: number;
  stock: number;
  variantCount: number;
  lastSaleDate: string | null;
  lastPurchaseDate: string | null;
  movementCount: number;
}

export function useProductSummary(productId?: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: entityQueryKeys.productSummary(productId),
    enabled: !!productId && (options?.enabled ?? true),
    staleTime: 60_000,
    queryFn: async (): Promise<ProductSummary | null> => {
      const supabase = createClient();
      const { data: product, error } = await supabase
        .from("products")
        .select(
          "id, name, code, image_url, base_purchase_price, base_sale_price, product_variants(id, purchase_price, sale_price, stock_qty)"
        )
        .eq("id", productId)
        .single();
      if (error) throw error;

      const variants = ((product as any).product_variants ?? []) as {
        id: string;
        purchase_price: number | null;
        sale_price: number | null;
        stock_qty: number;
      }[];
      const variantIds = variants.map((variant) => variant.id);

      let lastSaleDate: string | null = null;
      let lastPurchaseDate: string | null = null;
      let movementCount = 0;

      if (variantIds.length > 0) {
        const [lastSaleResult, lastPurchaseResult, movementCountResult] = await Promise.all([
          supabase
            .from("sale_items")
            .select("created_at")
            .in("variant_id", variantIds)
            .order("created_at", { ascending: false })
            .limit(1),
          supabase
            .from("purchase_items")
            .select("created_at")
            .in("variant_id", variantIds)
            .order("created_at", { ascending: false })
            .limit(1),
          supabase
            .from("stock_movements")
            .select("id", { count: "exact", head: true })
            .in("variant_id", variantIds),
        ]);
        if (lastSaleResult.error) throw lastSaleResult.error;
        if (lastPurchaseResult.error) throw lastPurchaseResult.error;
        if (movementCountResult.error) throw movementCountResult.error;
        lastSaleDate = lastSaleResult.data?.[0]?.created_at ?? null;
        lastPurchaseDate = lastPurchaseResult.data?.[0]?.created_at ?? null;
        movementCount = movementCountResult.count ?? 0;
      }

      const firstVariantWithPrice = variants.find((variant) => variant.sale_price || variant.purchase_price) ?? variants[0];

      return {
        id: product.id,
        name: product.name,
        code: (product as any).code ?? null,
        imageUrl: product.image_url ?? null,
        basePurchasePrice: product.base_purchase_price ?? 0,
        baseSalePrice: product.base_sale_price ?? 0,
        currentPurchasePrice: firstVariantWithPrice?.purchase_price ?? product.base_purchase_price ?? 0,
        currentSalePrice: firstVariantWithPrice?.sale_price ?? product.base_sale_price ?? 0,
        stock: variants.reduce((sum, variant) => sum + (variant.stock_qty ?? 0), 0),
        variantCount: variants.length,
        lastSaleDate,
        lastPurchaseDate,
        movementCount,
      };
    },
  });
}
