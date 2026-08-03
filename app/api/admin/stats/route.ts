import { NextResponse } from "next/server";
import { requirePlatformPermission, safeError } from "@/lib/security/api-guard";

export const dynamic = "force-dynamic";

/** شاخص‌های داشبورد ادمین. همه‌ی نقش‌ها اجازه‌ی مشاهده دارند. */
export async function GET() {
  try {
    const auth = await requirePlatformPermission("orgs.view");
    if ("response" in auth) return auth.response;

    const { data, error } = await auth.svc.rpc("platform_stats");
    if (error) throw error;

    return NextResponse.json({ stats: data ?? {} });
  } catch (e) {
    return safeError("admin/stats:GET", e);
  }
}
