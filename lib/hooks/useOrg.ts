"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Membership } from "@/types/db";

export interface OrgContextData {
  orgId: string | null;
  branchId: string | null;
  role: string | null;
  /** سازمان نمایشی است؟ عملیات مخرب در این حالت مسدود می‌شود. */
  isDemo: boolean;
  loading: boolean;
}

/**
 * سازمان فعال کاربر فعلی را برمی‌گرداند.
 * در نسخه اول هر کاربر یک سازمان دارد؛ اگر چند سازمان داشت، اولی انتخاب می‌شود.
 */
export function useOrg(): OrgContextData {
  const [data, setData] = useState<OrgContextData>({
    orgId: null,
    branchId: null,
    role: null,
    isDemo: false,
    loading: true,
  });

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    (async () => {
      const { data: rows } = await supabase
        .from("memberships")
        .select("org_id, branch_id, role")
        .eq("is_active", true)
        .limit(1);

      if (!active) return;

      const m = (rows?.[0] as Pick<Membership, "org_id" | "branch_id" | "role">) || null;

      // وضعیت دمو از سازمان خوانده می‌شود. اگر ستون در دسترس نباشد
      // (migration اجرا نشده) مقدار false می‌ماند و رفتار عادی حفظ می‌شود.
      let isDemo = false;
      if (m?.org_id) {
        const { data: org } = await supabase
          .from("organizations")
          .select("is_demo")
          .eq("id", m.org_id)
          .maybeSingle();
        isDemo = Boolean((org as { is_demo?: boolean } | null)?.is_demo);
      }

      if (!active) return;

      setData({
        orgId: m?.org_id ?? null,
        branchId: m?.branch_id ?? null,
        role: m?.role ?? null,
        isDemo,
        loading: false,
      });
    })();

    return () => {
      active = false;
    };
  }, []);

  return data;
}
