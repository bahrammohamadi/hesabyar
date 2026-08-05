import { NextResponse } from "next/server";
import {
  requirePlatformPermission,
  safeError,
  isUuid,
  requestIp,
} from "@/lib/security/api-guard";
import { hit, clientIp, tooManyRequests } from "@/lib/security/rate-limit";
import { runImport, mapImportJob } from "@/lib/import/runner";
import { buildTemplate, templateFileName } from "@/lib/import/workbook";
import { xlsxResponse } from "@/lib/import/http";
import { MAX_FILE_BYTES, type ImportKind } from "@/lib/import/schema";
import type { DuplicateMode } from "@/lib/import/execute";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * ورود داده به‌جای مشتری — پنل مدیریت.
 *
 * چرا مجوز جدا (`data.import`) و نه `orgs.view`؟
 *   این کار *نوشتن* انبوه در دیتابیس مشتری است، نه خواندن. باید
 *   بشود ادمینی داشت که کسب‌وکارها را می‌بیند ولی حق دست‌زدن به
 *   داده‌شان را ندارد. در مهاجرت ۰۰۳۷ پرخطر علامت خورده و فقط به
 *   مدیر ارشد داده می‌شود.
 */

/** فهرست ورودهای یک سازمان، یا قالب خام آن. */
export async function GET(request: Request) {
  try {
    const rl = hit(`admin-import-get:${clientIp(request)}`, { limit: 60, windowSeconds: 60 });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const auth = await requirePlatformPermission("data.import");
    if ("response" in auth) return auth.response;

    const url = new URL(request.url);
    const orgId = url.searchParams.get("org_id");
    if (!orgId || !isUuid(orgId)) {
      return NextResponse.json({ error: "شناسه‌ی کسب‌وکار نامعتبر است" }, { status: 400 });
    }

    /* قالب خام، شخصی‌سازی‌شده برای همان کسب‌وکار */
    if (url.searchParams.get("template") === "1") {
      const kind = (url.searchParams.get("kind") ?? "products") as ImportKind;
      if (kind !== "products" && kind !== "contacts") {
        return NextResponse.json({ error: "نوع نامعتبر" }, { status: 400 });
      }
      let categories: string[] = [];
      let brands: string[] = [];
      if (kind === "products") {
        const [{ data: cats }, { data: brs }] = await Promise.all([
          auth.svc.from("categories").select("name").order("name"),
          auth.svc.from("brands").select("name").eq("org_id", orgId).order("name"),
        ]);
        categories = (cats ?? []).map((c) => c.name as string).filter(Boolean);
        brands = (brs ?? []).map((b) => b.name as string).filter(Boolean);
      }
      return xlsxResponse(buildTemplate(kind, { categories, brands }), templateFileName(kind));
    }

    const { data, error } = await auth.svc
      .from("import_jobs")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;

    return NextResponse.json({ jobs: (data ?? []).map(mapImportJob) });
  } catch (error) {
    return safeError("admin/import:GET", error);
  }
}

export async function POST(request: Request) {
  try {
    const rl = hit(`admin-import-post:${clientIp(request)}`, {
      limit: 10, windowSeconds: 600, blockSeconds: 300,
    });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const auth = await requirePlatformPermission("data.import");
    if ("response" in auth) return auth.response;

    const form = await request.formData();
    const orgId = String(form.get("org_id") ?? "");
    if (!isUuid(orgId)) {
      return NextResponse.json({ error: "شناسه‌ی کسب‌وکار نامعتبر است" }, { status: 400 });
    }

    /*
      دلیل اجباری.
      نوشتن در دیتابیس مشتری بدون توضیح، در ممیزی غیرقابل‌دفاع است —
      همان قاعده‌ای که برای بازنشانی رمز گذاشته شد.
    */
    const reason = String(form.get("reason") ?? "").trim();
    if (reason.length < 5) {
      return NextResponse.json(
        { error: "دلیل ورود داده را بنویسید (حداقل ۵ نویسه)" },
        { status: 400 }
      );
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "فایلی ارسال نشد" }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "حجم فایل بیش از حد مجاز است" }, { status: 413 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "فایل خالی است" }, { status: 400 });
    }

    const kind = String(form.get("kind") ?? "products") as ImportKind;
    if (kind !== "products" && kind !== "contacts") {
      return NextResponse.json({ error: "نوع نامعتبر" }, { status: 400 });
    }
    const mode: DuplicateMode = form.get("mode") === "update" ? "update" : "skip";
    const dryRun = String(form.get("dry_run") ?? "") === "1";

    // سازمان باید واقعاً وجود داشته باشد.
    const { data: org } = await auth.svc
      .from("organizations")
      .select("id, name")
      .eq("id", orgId)
      .maybeSingle();
    if (!org) return NextResponse.json({ error: "کسب‌وکار یافت نشد" }, { status: 404 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await runImport(auth.svc, {
      orgId,
      userId: auth.userId,
      kind,
      mode,
      buffer,
      fileName: file.name,
      isAdminImport: true,
      dryRun,
    });

    /*
      ثبت در گزارش ممیزی — فقط برای نوشتن واقعی، نه پیش‌نمایش.
      محتوای فایل ثبت نمی‌شود؛ لاگ ممیزی نباید نسخه‌ی دومی از داده‌ی
      مشتری شود.
    */
    if (!result.dryRun && result.ok) {
      await auth.svc.rpc("log_platform_action", {
        p_action: "data.imported",
        p_actor: auth.userId,
        p_target_type: "organization",
        p_target_id: orgId,
        p_target_name: org.name,
        p_reason: reason.slice(0, 500),
        p_meta: {
          kind,
          mode,
          job_id: result.jobId,
          created: result.created,
          updated: result.updated,
          skipped: result.skipped,
          failed: result.failed,
          file: file.name.slice(0, 120),
        },
        p_ip: requestIp(request),
      });
    }

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return safeError("admin/import:POST", error);
  }
}
