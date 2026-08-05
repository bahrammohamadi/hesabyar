"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { EntityType } from "@/lib/entities/types";
import { entityQueryKeys } from "@/lib/entities/query-keys";

export type EntityTimelineItemKind =
  | "sale"
  | "purchase"
  | "payment"
  | "check"
  | "interaction"
  | "note"
  | "stock-in"
  | "stock-out"
  | "stock-adjust"
  | "price-change";

export interface EntityTimelineItem {
  id: string;
  kind: EntityTimelineItemKind;
  title: string;
  description?: string | null;
  amount?: number | null;
  qty?: number | null;
  date: string;
  href?: string;
}

function sortTimeline(items: EntityTimelineItem[]) {
  return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function useEntityTimeline(type: EntityType, id?: string | null, options?: { enabled?: boolean; limit?: number }) {
  const limit = options?.limit ?? 25;

  return useQuery({
    queryKey: entityQueryKeys.timeline(type, id),
    enabled: !!id && (options?.enabled ?? true) && (type === "contact" || type === "product"),
    staleTime: 60_000,
    queryFn: async (): Promise<EntityTimelineItem[]> => {
      const supabase = createClient();

      if (type === "contact") {
        const [salesResult, txResult, checksResult, interactionsResult] = await Promise.all([
          supabase
            .from("sales")
            .select("id, invoice_no, total, date")
            .eq("customer_id", id)
            .order("date", { ascending: false })
            .limit(limit),
          supabase
            .from("transactions")
            .select("id, type, amount, date, note")
            .eq("contact_id", id)
            .order("date", { ascending: false })
            .limit(limit),
          supabase
            .from("checks")
            .select("id, type, status, check_no, amount, issue_date, due_date, note")
            .eq("contact_id", id)
            .order("due_date", { ascending: false })
            .limit(limit),
          supabase
            .from("contact_interactions")
            .select("id, type, title, description, next_followup, created_at")
            .eq("contact_id", id)
            .order("created_at", { ascending: false })
            .limit(limit),
        ]);

        if (salesResult.error) throw salesResult.error;
        if (txResult.error) throw txResult.error;
        if (checksResult.error) throw checksResult.error;
        if (interactionsResult.error) throw interactionsResult.error;

        return sortTimeline([
          ...((salesResult.data ?? []).map((sale: any) => ({
            id: `sale-${sale.id}`,
            kind: "sale" as const,
            title: `فروش ${sale.invoice_no ?? ""}`.trim(),
            amount: sale.total ?? 0,
            date: sale.date,
            href: `/sales/${sale.id}`,
          })) as EntityTimelineItem[]),
          ...((txResult.data ?? []).map((tx: any) => ({
            id: `tx-${tx.id}`,
            kind: "payment" as const,
            title: tx.type === "receipt" ? "دریافت" : tx.type === "payment" ? "پرداخت" : tx.type === "expense" ? "هزینه" : "تراکنش",
            description: tx.note,
            amount: tx.amount ?? 0,
            date: tx.date,
          })) as EntityTimelineItem[]),
          ...((checksResult.data ?? []).map((check: any) => ({
            id: `check-${check.id}`,
            kind: "check" as const,
            title: `${check.type === "received" ? "چک دریافتی" : "چک صادره"}${check.check_no ? ` ${check.check_no}` : ""}`,
            description: check.note ?? check.status,
            amount: check.amount ?? 0,
            date: check.due_date ?? check.issue_date,
          })) as EntityTimelineItem[]),
          ...((interactionsResult.data ?? []).map((interaction: any) => ({
            id: `interaction-${interaction.id}`,
            kind: interaction.type === "note" ? ("note" as const) : ("interaction" as const),
            title: interaction.title || (interaction.type === "call" ? "تماس" : interaction.type === "note" ? "یادداشت" : "تعامل CRM"),
            description: interaction.description,
            date: interaction.created_at,
          })) as EntityTimelineItem[]),
        ]).slice(0, limit);
      }

      if (type === "product") {
        const { data: variants, error: variantsError } = await supabase
          .from("product_variants")
          .select("id")
          .eq("product_id", id)
          .eq("is_active", true);
        if (variantsError) throw variantsError;

        const variantIds = (variants ?? []).map((variant) => variant.id);
        if (variantIds.length === 0) return [];

        const [movementsResult, saleItemsResult, purchaseItemsResult, priceItemsResult] = await Promise.all([
          supabase
            .from("stock_movements")
            .select("id, type, reason, qty, note, created_at, ref_table, ref_id")
            .in("variant_id", variantIds)
            .order("created_at", { ascending: false })
            .limit(limit),
          supabase
            .from("sale_items")
            .select("id, qty, line_total, created_at, sale:sales(id, invoice_no)")
            .in("variant_id", variantIds)
            .order("created_at", { ascending: false })
            .limit(limit),
          supabase
            .from("purchase_items")
            .select("id, qty, line_total, created_at, purchase:purchases(id, invoice_no)")
            .in("variant_id", variantIds)
            .order("created_at", { ascending: false })
            .limit(limit),
          supabase
            .from("price_list_items")
            .select("id, price, created_at, price_list:price_lists(name)")
            .in("variant_id", variantIds)
            .order("created_at", { ascending: false })
            .limit(limit),
        ]);

        if (movementsResult.error) throw movementsResult.error;
        if (saleItemsResult.error) throw saleItemsResult.error;
        if (purchaseItemsResult.error) throw purchaseItemsResult.error;
        if (priceItemsResult.error) throw priceItemsResult.error;

        return sortTimeline([
          ...((movementsResult.data ?? []).map((movement: any) => {
            const isIn = movement.qty >= 0;
            const kind: EntityTimelineItemKind = movement.type === "adjust" ? "stock-adjust" : isIn ? "stock-in" : "stock-out";
            return {
              id: `movement-${movement.id}`,
              kind,
              title: movement.type === "adjust" ? "انبارگردانی" : isIn ? "ورود موجودی" : "خروج موجودی",
              description: movement.note ?? movement.reason,
              qty: movement.qty,
              date: movement.created_at,
              href: movement.ref_table === "sales" && movement.ref_id ? `/sales/${movement.ref_id}` : undefined,
            };
          }) as EntityTimelineItem[]),
          ...((saleItemsResult.data ?? []).map((item: any) => ({
            id: `sale-item-${item.id}`,
            kind: "sale" as const,
            title: `فروش ${item.sale?.invoice_no ?? ""}`.trim(),
            qty: item.qty,
            amount: item.line_total ?? 0,
            date: item.created_at,
            href: item.sale?.id ? `/sales/${item.sale.id}` : undefined,
          })) as EntityTimelineItem[]),
          ...((purchaseItemsResult.data ?? []).map((item: any) => ({
            id: `purchase-item-${item.id}`,
            kind: "purchase" as const,
            title: `خرید ${item.purchase?.invoice_no ?? ""}`.trim(),
            qty: item.qty,
            amount: item.line_total ?? 0,
            date: item.created_at,
            href: item.purchase?.id ? `/purchases/${item.purchase.id}` : undefined,
          })) as EntityTimelineItem[]),
          ...((priceItemsResult.data ?? []).map((item: any) => ({
            id: `price-${item.id}`,
            kind: "price-change" as const,
            title: `تغییر قیمت${item.price_list?.name ? ` - ${item.price_list.name}` : ""}`,
            amount: item.price ?? 0,
            date: item.created_at,
          })) as EntityTimelineItem[]),
        ]).slice(0, limit);
      }

      return [];
    },
  });
}
