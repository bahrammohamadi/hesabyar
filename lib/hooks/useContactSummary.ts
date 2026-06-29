"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { entityQueryKeys } from "@/lib/entities/query-keys";

export interface ContactSummary {
  id: string;
  name: string;
  phone: string | null;
  type: string;
  balance: number;
  invoiceCount: number;
  totalSales: number;
  totalPurchases: number;
  lastSaleDate: string | null;
  lastPurchaseDate: string | null;
  lastPaymentDate: string | null;
  lastPaymentAmount: number;
  lastInteractionDate: string | null;
  lastInteractionTitle: string | null;
  lastInteractionType: string | null;
}

export function useContactSummary(contactId?: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: entityQueryKeys.contactSummary(contactId),
    enabled: !!contactId && (options?.enabled ?? true),
    staleTime: 60_000,
    queryFn: async (): Promise<ContactSummary | null> => {
      const supabase = createClient();
      const { data: contact, error: contactError } = await supabase
        .from("contacts")
        .select("id, name, phone, type")
        .eq("id", contactId)
        .single();
      if (contactError) throw contactError;

      const [balanceResult, salesResult, purchasesResult, paymentResult, interactionResult] = await Promise.all([
        supabase.from("contact_balances").select("balance").eq("contact_id", contactId).maybeSingle(),
        supabase.from("sales").select("id, total, date").eq("customer_id", contactId).order("date", { ascending: false }).limit(100),
        supabase.from("purchases").select("id, total, date").eq("supplier_id", contactId).order("date", { ascending: false }).limit(100),
        supabase
          .from("transactions")
          .select("id, type, amount, date")
          .eq("contact_id", contactId)
          .in("type", ["receipt", "payment"])
          .order("date", { ascending: false })
          .limit(1),
        supabase
          .from("contact_interactions")
          .select("id, type, title, description, created_at")
          .eq("contact_id", contactId)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

      if (balanceResult.error) throw balanceResult.error;
      if (salesResult.error) throw salesResult.error;
      if (purchasesResult.error) throw purchasesResult.error;
      if (paymentResult.error) throw paymentResult.error;
      if (interactionResult.error) throw interactionResult.error;

      const sales = salesResult.data ?? [];
      const purchases = purchasesResult.data ?? [];
      const lastPayment = paymentResult.data?.[0] ?? null;
      const lastInteraction = interactionResult.data?.[0] ?? null;

      return {
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
        type: contact.type,
        balance: (balanceResult.data as { balance?: number } | null)?.balance ?? 0,
        invoiceCount: sales.length,
        totalSales: sales.reduce((sum, row) => sum + (row.total ?? 0), 0),
        totalPurchases: purchases.reduce((sum, row) => sum + (row.total ?? 0), 0),
        lastSaleDate: sales[0]?.date ?? null,
        lastPurchaseDate: purchases[0]?.date ?? null,
        lastPaymentDate: lastPayment?.date ?? null,
        lastPaymentAmount: lastPayment?.amount ?? 0,
        lastInteractionDate: lastInteraction?.created_at ?? null,
        lastInteractionTitle: lastInteraction?.title ?? lastInteraction?.description ?? null,
        lastInteractionType: lastInteraction?.type ?? null,
      };
    },
  });
}
