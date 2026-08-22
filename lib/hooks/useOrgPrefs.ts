"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "./useOrg";
import {
  DEFAULT_PREFS,
  effectiveBusinessType,
  industryProfile,
  parsePrefs,
  showsField,
  type OrgPrefs,
} from "@/lib/org-prefs";
import { currencyLabel, formatMoney, moneyFieldLabel, displayToRial, rialToDisplay } from "@/lib/utils/money";

/**
 * ترجیحات سازمان + کمک‌کننده‌های آماده‌ی نمایش.
 *
 * ⚠️ چرا React Query و نه useState داخل useOrg؟
 *   `useOrg` در هر کامپوننتی که صدایش می‌زند یک `useEffect` تازه
 *   اجرا می‌کند و کش مشترکی ندارد. اگر ترجیحات را آنجا می‌گذاشتیم،
 *   هر صفحه با ده کامپوننت یعنی ده کوئری تکراری. با کلید مشترک
 *   React Query، همه یک نتیجه را می‌بینند.
 *
 * ⚠️ `staleTime` بلند است چون این داده تقریباً هرگز عوض نمی‌شود.
 */
export function useOrgPrefs() {
  const { orgId, loading: orgLoading } = useOrg();

  const { data, isLoading } = useQuery({
    queryKey: ["org-prefs", orgId],
    enabled: !!orgId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<{ prefs: OrgPrefs; orgBusinessType: string | null }> => {
      const supabase = createClient();
      const [{ data: raw }, { data: org }] = await Promise.all([
        supabase.rpc("get_org_prefs", { p_org: orgId }),
        supabase.from("organizations").select("business_type").eq("id", orgId!).maybeSingle(),
      ]);
      return {
        prefs: parsePrefs(raw),
        orgBusinessType: (org?.business_type as string | null) ?? null,
      };
    },
  });

  const prefs = data?.prefs ?? DEFAULT_PREFS;
  const businessType = effectiveBusinessType(prefs, data?.orgBusinessType);
  const profile = industryProfile(businessType);
  const currency = prefs.currency;

  return {
    prefs,
    /** صنف مؤثر — با احتساب خاموش‌بودن شخصی‌سازی. */
    businessType,
    profile,
    currency,
    loading: orgLoading || isLoading,

    /* ── کمک‌کننده‌های پول ── */
    /** مبلغ ریالی را با واحد سازمان قالب‌بندی می‌کند. */
    money: (rial: number | null | undefined, withLabel = true) =>
      formatMoney(rial, currency, withLabel),
    /** «قیمت فروش» → «قیمت فروش (تومان)» یا «(ریال)». */
    moneyLabel: (base: string) => moneyFieldLabel(base, currency),
    /** فقط نام واحد. */
    unitLabel: currencyLabel(currency),
    /** ریال ذخیره‌شده → عدد قابل ویرایش در فرم. */
    toDisplay: (rial: number | null | undefined) => rialToDisplay(rial, currency),
    /** عدد فرم → ریال برای ذخیره. */
    toRial: (value: number | null | undefined) => displayToRial(value, currency),

    /* ── کمک‌کننده‌های صنفی ── */
    /** «کالا» یا «آیتم منو» یا «مصنوع». */
    productWord: profile.productWord,
    /** آیا این فیلد اختیاری برای این صنف نمایش داده شود؟ */
    shows: (field: "color" | "size" | "season" | "material") => showsField(businessType, field),
  };
}

/** ابطال کش پس از ذخیره‌ی تنظیمات. */
export function useInvalidateOrgPrefs() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["org-prefs"] });
}
