"use client";

import { useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SelectableVariant } from "@/components/shared/product-selector";
import { normalizeBarcode } from "@/lib/barcode";

/**
 * پیدا کردن کالا از روی بارکد.
 *
 * چرا سه مرحله؟
 *   در داده‌ی واقعی این پروژه فقط ۴ کالا از ۳۸۵ بارکد دارند. اگر فقط
 *   ستون barcode را بگردیم، اسکنر عملاً همیشه «پیدا نشد» می‌دهد.
 *   بارکدخوان سخت‌افزاری هم معمولاً همان چیزی را می‌فرستد که فروشنده
 *   روی برچسب داخلی چاپ کرده — که اینجا اغلب SKU یا کد کالاست.
 *
 *   ترتیب از دقیق‌ترین به عام‌ترین است تا تطبیق اشتباه رخ ندهد:
 *     ۱. barcode دقیق
 *     ۲. sku دقیق
 *     ۳. کد کالا (products.code) دقیق
 */
export function useBarcodeLookup(orgId: string | null) {
  return useCallback(
    async (rawCode: string): Promise<SelectableVariant | null> => {
      const code = normalizeBarcode(rawCode);
      if (!code || !orgId) return null;

      const supabase = createClient();
      const select =
        "id, product_id, color, size, sku, barcode, sale_price, purchase_price, stock_qty, " +
        "product:products(id, name, code, category_id, brand_id, base_sale_price, unit, unit_label, pack_label, pack_size)";

      const shape = (row: Record<string, unknown>): SelectableVariant => {
        const product = (row.product ?? {}) as Record<string, unknown>;
        return {
          variant_id: String(row.id),
          product_id: (product.id as string) ?? null,
          product_name: (product.name as string) ?? "بدون نام",
          product_code: (product.code as string) ?? null,
          color: (row.color as string) ?? null,
          size: (row.size as string) ?? null,
          sku: (row.sku as string) ?? null,
          barcode: (row.barcode as string) ?? null,
          sale_price: Number(row.sale_price ?? product.base_sale_price ?? 0),
          purchase_price: Number(row.purchase_price ?? 0),
          unit: ((product.unit as string) ?? "count") as SelectableVariant["unit"],
          unit_label: (product.unit_label as string) ?? null,
          pack_label: (product.pack_label as string) ?? null,
          pack_size: product.pack_size === null || product.pack_size === undefined ? null : Number(product.pack_size),
          stock_qty: Number(row.stock_qty ?? 0),
          category_id: (product.category_id as string) ?? null,
          brand_id: (product.brand_id as string) ?? null,
        };
      };

      // ۱) بارکد دقیق
      const byBarcode = await supabase
        .from("product_variants")
        .select(select)
        .eq("org_id", orgId)
        .eq("barcode", code)
        .limit(1)
        .maybeSingle();
      if (byBarcode.data) return shape(byBarcode.data as unknown as Record<string, unknown>);

      // ۲) SKU دقیق
      const bySku = await supabase
        .from("product_variants")
        .select(select)
        .eq("org_id", orgId)
        .eq("sku", code)
        .limit(1)
        .maybeSingle();
      if (bySku.data) return shape(bySku.data as unknown as Record<string, unknown>);

      /*
        ۳) کد کالا (products.code).

        چون روی جدول والد است، ابتدا محصول را پیدا می‌کنیم و سپس
        اولین واریانتش را برمی‌داریم. دو کوئری ساده به یک join
        تودرتو ترجیح داده شد: خواناتر است و تایپ‌های Supabase برای
        select تودرتوی پویا قابل اتکا نیستند.
      */
      const product = await supabase
        .from("products")
        .select("id")
        .eq("org_id", orgId)
        .eq("code", code)
        .limit(1)
        .maybeSingle();

      if (product.data?.id) {
        const variant = await supabase
          .from("product_variants")
          .select(select)
          .eq("product_id", product.data.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (variant.data) return shape(variant.data as unknown as Record<string, unknown>);
      }

      return null;
    },
    [orgId]
  );
}
