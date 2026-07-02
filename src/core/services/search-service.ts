"use client";

import { createClient } from "@/lib/supabase/client";

export type GlobalSearchResultType = "contact" | "product" | "document";

export interface GlobalSearchResult {
  result_type: GlobalSearchResultType;
  id: string;
  title: string;
  subtitle: string | null;
  meta: Record<string, unknown> | null;
  score: number;
}

export async function globalSearch(query: string, limit = 20): Promise<GlobalSearchResult[]> {
  const term = query.trim();
  if (!term) return [];

  const supabase = createClient();
  const { data, error } = await supabase.rpc("fn_global_search", {
    q: term,
    p_limit: limit,
  });

  if (error) throw error;
  return (data ?? []) as GlobalSearchResult[];
}
