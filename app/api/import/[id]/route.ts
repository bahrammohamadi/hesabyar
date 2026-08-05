import { NextResponse } from "next/server";
import { requireMember, serviceClient, safeError, isUuid } from "@/lib/security/api-guard";
import { hit, clientIp, tooManyRequests } from "@/lib/security/rate-limit";
import { roleHasPermission } from "@/lib/permissions";
import { logActivityServer } from "@/lib/utils/activity-log-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * برگرداندن یک ورود.
 *
 * 🔴 گارد IDOR: شناسه از URL می‌آید و کوئری با service_role اجرا
 * می‌شود، یعنی RLS دور زده می‌شود. شرط سازمان داخل خودِ WHERE است تا
 * «فراموش‌کردن بررسی» به نتیجه‌ی خالی ختم شود، نه به حذف داده‌ی
 * کسب‌وکار دیگر.
 */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const rl = hit(`import-rollback:${clientIp(request)}`, {
      limit: 10, windowSeconds: 600, blockSeconds: 300,
    });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    if (!isUuid(params.id)) {
      return NextResponse.json({ error: "شناسه نامعتبر" }, { status: 400 });
    }

    const auth = await requireMember();
    if ("response" in auth) return auth.response;
    const { membership, userId } = auth.ctx;

    const svc = serviceClient();
    const { data: job } = await svc
      .from("import_jobs")
      .select("id, kind, org_id, status, file_name")
      .eq("id", params.id)
      .eq("org_id", membership.org_id)   // ← گارد داخل کوئری
      .maybeSingle();

    // ورود ناموجود و ورود سازمان دیگر پاسخ یکسان می‌گیرند.
    if (!job) return NextResponse.json({ error: "ورود موردنظر یافت نشد" }, { status: 404 });

    const needed = job.kind === "products" ? "products.edit" : "contacts.edit";
    if (!roleHasPermission(membership.role as never, needed)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (job.status === "rolled_back") {
      return NextResponse.json({ error: "این ورود قبلاً برگردانده شده است" }, { status: 409 });
    }

    const { data, error } = await svc.rpc("rollback_import", { p_job: params.id });
    if (error) {
      return NextResponse.json(
        { error: error.message?.slice(0, 200) ?? "برگرداندن ناموفق بود" },
        { status: 400 }
      );
    }

    await logActivityServer({
      userId,
      orgId: membership.org_id,
      action: "delete",
      entityType: job.kind === "products" ? "product" : "contact",
      entityId: params.id,
      oldData: { import_rollback: true, file: job.file_name, result: data },
    });

    return NextResponse.json({ ok: true, result: data });
  } catch (error) {
    return safeError("import/rollback", error);
  }
}
