"use client";

import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "./useOrg";
import { useOrgPrefs } from "./useOrgPrefs";

export type OptionKind = "color" | "size" | "season" | "material" | "unit";

export type OptionRow = { id: string; kind: string; value: string; sort_order: number };

/**
 * گزینه‌های یک فهرست کشویی.
 *
 * دو منبع با هم ترکیب می‌شوند:
 *   ۱) گزینه‌های تعریف‌شده‌ی سازمان (`option_lists`)
 *   ۲) پیشنهادهای پیش‌فرض صنف
 *
 * 🔴 چرا هر دو و نه فقط یکی؟
 *   اگر فقط پیش‌فرض صنف بود، کاربر نمی‌توانست رنگ «یشمی» را اضافه
 *   کند. اگر فقط تعریف کاربر بود، سازمان تازه با فهرست **خالی**
 *   شروع می‌کرد — یعنی کشویی بدتر از کادر متنی می‌شد.
 *
 * ⚠️ ترتیب مهم است: گزینه‌های خودِ کاربر **اول** می‌آیند. او آن‌ها
 * را عمداً ساخته و بیشتر استفاده می‌کند.
 */
export function useOptionList(kind: OptionKind) {
  const { orgId } = useOrg();
  const { profile } = useOrgPrefs();

  const { data: rows, isLoading } = useQuery({
    queryKey: ["option-list", orgId, kind],
    enabled: !!orgId,
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("option_lists")
        .select("id, kind, value, sort_order")
        .eq("org_id", orgId!)
        .eq("kind", kind)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as OptionRow[];
    },
  });

  const options = useMemo(() => {
    const own = (rows ?? []).map((r) => r.value);
    const suggested = profile.suggested[kind] ?? [];
    /*
      تکراری‌ها حذف می‌شوند. اگر کاربر «مشکی» را دستی اضافه کرده
      باشد و در پیشنهادها هم باشد، دو بار در کشویی دیدنش گیج‌کننده
      است.
    */
    const seen = new Set<string>();
    const merged: string[] = [];
    for (const v of [...own, ...suggested]) {
      const key = v.trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(key);
    }
    return merged;
  }, [rows, profile, kind]);

  return { options, ownRows: rows ?? [], isLoading };
}

/** ابطال کش پس از ویرایش فهرست. */
export function useInvalidateOptionLists() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["option-list"] });
}
