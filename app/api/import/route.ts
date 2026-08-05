import { NextResponse } from "next/server";
import { requireMember, serviceClient, safeError, isUuid } from "@/lib/security/api-guard";
import { hit, clientIp, tooManyRequests } from "@/lib/security/rate-limit";
import { roleHasPermission } from "@/lib/permissions";
import { runImport, mapImportJob } from "@/lib/import/runner";
import { MAX_FILE_BYTES, type ImportKind } from "@/lib/import/schema";
import type { DuplicateMode } from "@/lib/import/execute";
import { logActivityServer } from "@/lib/utils/activity-log-server";

export const dynamic = "force-dynamic";
/*
  ورود چند صد سطر از سقف پیش‌فرض ۱۰ ثانیه رد می‌شود.
  ۶۰ ثانیه سقف پلن رایگان Vercel است.
*/
export const maxDuration = 60;

/** فهرست ورودهای قبلی این سازمان. */
export async function GET(request: Request) {
  try {
    const rl = hit(`import-list:${clientIp(request)}`, { limit: 60, windowSeconds: 60 });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const url = new URL(request.url);
    const auth = await requireMember(url.searchParams.get("org_id"));
    if ("response" in auth) return auth.response;

    const svc = serviceClient();
    const { data, error } = await svc
      .from("import_jobs")
      .select("*")
      .eq("org_id", auth.ctx.membership.org_id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;

    return NextResponse.json({ jobs: (data ?? []).map(mapImportJob) });
  } catch (error) {
    return safeError("import:GET", error);
  }
}

/** آپلود فایل و ورود داده. */
export async function POST(request: Request) {
  try {
    /*
      سقف سخت‌گیرانه: هر ورود ده‌ها کوئری می‌زند. ۱۰ بار در ۱۰ دقیقه
      برای کوچ یک کسب‌وکار کافی است و جلوی حلقه‌ی تصادفی را می‌گیرد.
    */
    const rl = hit(`import-post:${clientIp(request)}`, {
      limit: 10, windowSeconds: 600, blockSeconds: 300,
    });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "فایلی ارسال نشد" }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `حجم فایل بیش از ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} مگابایت است` },
        { status: 413 }
      );
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

    const requestedOrg = form.get("org_id");
    const orgId = typeof requestedOrg === "string" && isUuid(requestedOrg) ? requestedOrg : null;

    const auth = await requireMember(orgId);
    if ("response" in auth) return auth.response;
    const { membership, userId } = auth.ctx;

    /*
      ورود دسته‌جمعی معادل ساختن انبوه رکورد است، پس همان مجوزی را
      می‌خواهد که ساختن تکی می‌خواهد — نه کمتر.
    */
    const needed = kind === "products" ? "products.edit" : "contacts.edit";
    if (!roleHasPermission(membership.role as never, needed)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await runImport(serviceClient(), {
      orgId: membership.org_id,
      userId,
      kind,
      mode,
      buffer,
      fileName: file.name,
      isAdminImport: false,
      dryRun,
    });

    if (!result.dryRun && result.ok) {
      await logActivityServer({
        userId,
        orgId: membership.org_id,
        action: "create",
        entityType: kind === "products" ? "product" : "contact",
        entityId: result.jobId ?? null,
        newData: {
          import: true,
          created: result.created,
          updated: result.updated,
          file: file.name.slice(0, 120),
        },
      });
    }

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return safeError("import:POST", error);
  }
}
