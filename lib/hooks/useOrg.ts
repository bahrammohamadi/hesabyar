"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Membership } from "@/types/db";

export interface OrgContextData {
  orgId: string | null;
  branchId: string | null;
  role: string | null;
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
      setData({
        orgId: m?.org_id ?? null,
        branchId: m?.branch_id ?? null,
        role: m?.role ?? null,
        loading: false,
      });
    })();

    return () => {
      active = false;
    };
  }, []);

  return data;
}
