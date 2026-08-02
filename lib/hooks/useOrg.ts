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
  /**
   * پایان دوره‌ی تست رایگان (ISO).
   * null یعنی سازمان قدیمی یا پولی — شمارنده نمایش داده نمی‌شود.
   */
  trialEndsAt: string | null;
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
    trialEndsAt: null,
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

      /*
        وضعیت دمو و مهلت تست از همان یک کوئری خوانده می‌شوند.
        افزودن ستون به select موجود، به‌جای کوئری دوم، یعنی شمارنده‌ی
        هدر هیچ رفت‌وبرگشت اضافه‌ای به سرور تحمیل نمی‌کند.

        اگر ستون‌ها در دسترس نباشند (migration اجرا نشده) مقادیر
        پیش‌فرض می‌مانند و رفتار عادی حفظ می‌شود.
      */
      let isDemo = false;
      let trialEndsAt: string | null = null;
      if (m?.org_id) {
        const { data: org } = await supabase
          .from("organizations")
          .select("is_demo, trial_ends_at")
          .eq("id", m.org_id)
          .maybeSingle();
        const row = org as { is_demo?: boolean; trial_ends_at?: string | null } | null;
        isDemo = Boolean(row?.is_demo);
        trialEndsAt = row?.trial_ends_at ?? null;
      }

      if (!active) return;

      setData({
        orgId: m?.org_id ?? null,
        branchId: m?.branch_id ?? null,
        role: m?.role ?? null,
        isDemo,
        trialEndsAt,
        loading: false,
      });
    })();

    return () => {
      active = false;
    };
  }, []);

  return data;
}
