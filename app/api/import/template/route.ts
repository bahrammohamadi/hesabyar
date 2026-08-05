import { NextResponse } from "next/server";
import { requireMember, serviceClient, safeError } from "@/lib/security/api-guard";
import { hit, clientIp, tooManyRequests } from "@/lib/security/rate-limit";
import { buildTemplate, templateFileName } from "@/lib/import/workbook";
import { xlsxResponse } from "@/lib/import/http";
import type { ImportKind } from "@/lib/import/schema";

export const dynamic = "force-dynamic";

/**
 * دانلود قالب خام اکسل.
 *
 * قالب برای هر سازمان *شخصی‌سازی* می‌شود: شیت «فهرست» دسته‌ها و
 * برندهای همان کسب‌وکار را دارد. قالب عمومی باعث می‌شد کاربر نام
 * دسته را حدس بزند و بعد ده‌ها سطر هشدار «دسته وجود ندارد» بگیرد.
 */
export async function GET(request: Request) {
  try {
    const rl = hit(`import-template:${clientIp(request)}`, { limit: 30, windowSeconds: 60 });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const url = new URL(request.url);
    const kind = (url.searchParams.get("kind") ?? "products") as ImportKind;
    if (kind !== "products" && kind !== "contacts") {
      return NextResponse.json({ error: "نوع نامعتبر" }, { status: 400 });
    }

    /*
      سازمان از پارامتر خوانده می‌شود ولی عضویت بررسی می‌گردد.
      ادمین پلتفرم که برای مشتری قالب می‌گیرد، از مسیر
      /api/admin/import/template می‌آید — نه اینجا.
    */
    const auth = await requireMember(url.searchParams.get("org_id"));
    if ("response" in auth) return auth.response;
    const { membership } = auth.ctx;

    let categories: string[] = [];
    let brands: string[] = [];
    if (kind === "products") {
      const svc = serviceClient();
      const [{ data: cats }, { data: brs }] = await Promise.all([
        svc.from("categories").select("name").order("name"),
        svc.from("brands").select("name").eq("org_id", membership.org_id).order("name"),
      ]);
      categories = (cats ?? []).map((c) => c.name as string).filter(Boolean);
      brands = (brs ?? []).map((b) => b.name as string).filter(Boolean);
    }

    const buffer = buildTemplate(kind, { categories, brands });
    return xlsxResponse(buffer, templateFileName(kind));
  } catch (error) {
    return safeError("import/template", error);
  }
}
