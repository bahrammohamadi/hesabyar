"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { SelectableVariant } from "@/components/shared/product-selector";

type RawVariant = {
  id: string;
  color: string | null;
  size: string | null;
  sku: string | null;
  barcode: string | null;
  sale_price: number | null;
  purchase_price: number | null;
  stock_qty: number;
  product?: {
    id: string;
    name: string;
    code: string | null;
    category_id: string | null;
    brand_id: string | null;
    base_sale_price: number | null;
    base_purchase_price: number | null;
  } | null;
};

/**
 * کاتالوگ کامل واریانت‌ها.
 *
 * ⚠️ کلید کش عمداً همان `["all-variants", orgId]` است که
 * ProductSelector استفاده می‌کند. با یکی بودن کلید، React Query
 * داده را به اشتراک می‌گذارد و باز کردن انتخابگر صوتی هیچ کوئری
 * اضافه‌ای به سرور نمی‌زند — کاتالوگ ۳۸۵ ردیفی دو بار دانلود نمی‌شود.
 */
export function useAllVariants(orgId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["all-variants", orgId],
    enabled: !!orgId && enabled,
    staleTime: 60_000,
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
}
