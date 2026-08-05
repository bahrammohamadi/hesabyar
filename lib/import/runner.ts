import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readWorkbook } from "./workbook";
import { mapHeaders, parseContacts, parseProducts } from "./parse";
import { importContacts, importProducts, type DuplicateMode } from "./execute";
import { MAX_ROWS, type ImportKind, type RowError } from "./schema";

/**
 * اجرای کامل یک ورود: خواندن فایل → اعتبارسنجی → درج → ثبت دفترچه.
 *
 * چرا مشترک بین مسیر مشتری و مسیر ادمین؟
 *   دو پیاده‌سازی یعنی روزی یکی گارد یا تبدیل واحد پول را از دست
 *   بدهد. تفاوت دو مسیر فقط در «چه کسی اجازه دارد» است، نه در
 *   «چه اتفاقی می‌افتد».
 */

export interface RunResult {
  ok: boolean;
  jobId?: string;
  /** پیش‌نمایش: هیچ چیزی نوشته نشد. */
  dryRun?: boolean;
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: RowError[];
  warnings: string[];
  error?: string;
}

export async function runImport(
  svc: SupabaseClient,
  params: {
    orgId: string;
    userId: string;
    kind: ImportKind;
    mode: DuplicateMode;
    buffer: Buffer;
    fileName: string;
    isAdminImport: boolean;
    /** فقط بررسی کن و گزارش بده؛ چیزی ننویس. */
    dryRun: boolean;
  }
): Promise<RunResult> {
  const { orgId, userId, kind, mode, buffer, fileName, isAdminImport, dryRun } = params;

  const empty: RunResult = {
    ok: false, totalRows: 0, created: 0, updated: 0,
    skipped: 0, failed: 0, errors: [], warnings: [],
  };

  /* ── ۱) خواندن فایل ── */
  let parsed: ReturnType<typeof readWorkbook>;
  try {
    parsed = readWorkbook(buffer);
  } catch {
    return { ...empty, error: "فایل خوانده نشد. مطمئن شوید فایل اکسل (xlsx) سالمی است." };
  }

  const warnings: string[] = [];
  if (parsed.truncated) {
    warnings.push(`فایل بیش از ${MAX_ROWS} سطر داشت؛ فقط ${MAX_ROWS} سطر اول بررسی شد.`);
  }

  /* ── ۲) تطبیق سرستون‌ها ── */
  const { map, missing, unknown } = mapHeaders(parsed.headers, kind);
  if (missing.length > 0) {
    return {
      ...empty,
      error: `ستون‌های اجباری در فایل نیست: ${missing.map((m) => `«${m.header}»`).join("، ")}. لطفاً از قالب خام استفاده کنید.`,
    };
  }
  if (unknown.length > 0) {
    // خطا نیست: کاربر ممکن است ستون یادداشت شخصی داشته باشد.
    warnings.push(`این ستون‌ها شناخته نشدند و نادیده گرفته می‌شوند: ${unknown.slice(0, 5).join("، ")}`);
  }

  /* ── ۳) اعتبارسنجی ── */
  const result =
    kind === "products"
      ? parseProducts(parsed.rows, map)
      : parseContacts(parsed.rows, map);

  const allErrors: RowError[] = [...result.errors, ...result.duplicatesInFile];
  const totalRows = parsed.rows.length;

  if (result.rows.length === 0) {
    return {
      ...empty,
      totalRows,
      errors: allErrors,
      warnings,
      error:
        allErrors.length > 0
          ? "هیچ سطر معتبری پیدا نشد. فهرست ایرادها را ببینید."
          : "فایل خالی است.",
    };
  }

  /* ── ۴) پیش‌نمایش ──
     کاربر پیش از نوشتن باید ببیند چند سطر سالم است و چند تا ایراد
     دارد. بدون این مرحله، تنها راه فهمیدن، انجام دادنش است. */
  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      totalRows,
      created: result.rows.length,
      updated: 0,
      skipped: 0,
      failed: allErrors.length,
      errors: allErrors,
      warnings,
    };
  }

  /* ── ۵) شعبه‌ی پیش‌فرض ── */
  const { data: branch } = await svc
    .from("branches")
    .select("id")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const branchId = (branch?.id as string) ?? null;

  /* ── ۶) دفترچه ──
     job *پیش از* درج ساخته می‌شود چون رکوردها به شناسه‌اش نیاز
     دارند. اگر وسط کار خطا بخورد، job با آمار ناقص می‌ماند — که
     بهتر از رکوردهای بی‌صاحب است. */
  const fileHash = createHash("sha256").update(buffer).digest("hex").slice(0, 32);

  const { data: job, error: jobError } = await svc
    .from("import_jobs")
    .insert({
      org_id: orgId,
      kind,
      created_by: userId,
      is_admin_import: isAdminImport,
      file_name: fileName.slice(0, 200),
      file_hash: fileHash,
      total_rows: totalRows,
      status: "pending",
    })
    .select("id")
    .single();
  if (jobError || !job) {
    return { ...empty, totalRows, errors: allErrors, warnings, error: "ثبت دفترچه‌ی ورود ناموفق بود." };
  }
  const jobId = job.id as string;

  /* ── ۷) درج ── */
  try {
    const summary =
      kind === "products"
        ? await importProducts(svc, {
            orgId, branchId, userId, jobId,
            rows: result.rows as never, mode,
          })
        : await importContacts(svc, {
            orgId, branchId, userId, jobId,
            rows: result.rows as never, mode,
          });

    const errors = [...allErrors, ...summary.errors];

    await svc
      .from("import_jobs")
      .update({
        created_rows: summary.created,
        updated_rows: summary.updated,
        skipped_rows: summary.skipped,
        failed_rows: summary.failed + result.errors.length + result.duplicatesInFile.length,
        status: "done",
        // فقط ۲۰۰ ایراد اول ذخیره می‌شود: ستون jsonb نباید با یک
        // فایل خراب چند مگابایتی پر شود.
        errors: errors.slice(0, 200),
      })
      .eq("id", jobId);

    return {
      ok: true,
      jobId,
      totalRows,
      created: summary.created,
      updated: summary.updated,
      skipped: summary.skipped,
      failed: summary.failed + allErrors.length,
      errors,
      warnings,
    };
  } catch (e) {
    await svc
      .from("import_jobs")
      .update({
        status: "failed",
        errors: [...allErrors, { row: 0, message: (e as Error).message?.slice(0, 300) ?? "" }].slice(0, 200),
      })
      .eq("id", jobId);

    return {
      ...empty,
      jobId,
      totalRows,
      errors: allErrors,
      warnings,
      error: "ورود داده در میانه متوقف شد. با «برگرداندن» می‌توانید سطرهای ثبت‌شده را حذف کنید.",
    };
  }
}

/**
 * تبدیل ردیف `import_jobs` به شکل مورد استفاده‌ی UI.
 *
 * ⚠️ در lib است نه کنار روت: فایل `route.ts` فقط اجازه‌ی export
 * نام‌های شناخته‌شده را دارد و `next build` (نه tsc) هر چیز دیگری را
 * رد می‌کند. همین اشتباه در ساخت تیکت پشتیبانی رخ داد.
 */
export function mapImportJob(j: Record<string, unknown>) {
  return {
    id: j.id as string,
    orgId: (j.org_id as string) ?? null,
    kind: j.kind as string,
    fileName: (j.file_name as string) ?? null,
    totalRows: Number(j.total_rows ?? 0),
    created: Number(j.created_rows ?? 0),
    updated: Number(j.updated_rows ?? 0),
    skipped: Number(j.skipped_rows ?? 0),
    failed: Number(j.failed_rows ?? 0),
    status: j.status as string,
    isAdminImport: j.is_admin_import === true,
    errors: Array.isArray(j.errors) ? j.errors : [],
    createdAt: j.created_at as string,
    rolledBackAt: (j.rolled_back_at as string) ?? null,
  };
}
