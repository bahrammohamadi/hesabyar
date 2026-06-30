"use client";

import { createClient } from "@/lib/supabase/client";

export async function logActivity({
  orgId,
  action,
  entityType,
  entityId,
  oldData,
  newData,
}: {
  orgId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
}) {
  if (!orgId) return;
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("activity_logs").insert({
      org_id: orgId,
      user_id: user?.id ?? null,
      action,
      entity_type: entityType,
      entity_id: entityId ?? null,
      old_data: oldData ?? null,
      new_data: newData ?? null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
  } catch {
    // لاگ فعالیت نباید عملیات اصلی فروش/خرید/انبار را خراب کند.
  }
}
