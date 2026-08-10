import { NextResponse } from "next/server";
import { requireMember, serviceClient, safeError } from "@/lib/security/api-guard";
import { hit, clientIp, tooManyRequests } from "@/lib/security/rate-limit";
import { BACKUP_TABLES, fetchTable, type TableResult } from "@/lib/export/backup";
import { buildBackupWorkbook, backupFileName } from "@/lib/export/backup-workbook";
import { xlsxResponse } from "@/lib/import/http";
import { todayJalali } from "@/lib/utils/format";

export const dynamic = "force-dynamic";
/*
  پشتیبان کسب‌وکار بزرگ می‌تواند چند ده‌هزار ردیف باشد و از سقف
  پیش‌فرض ۱۰ ثانیه‌ی Vercel رد شود.
*/
export const maxDuration = 60;

/**
 * دانلود پشتیبان کامل کسب‌وکار (اکسل چندشیتی).
 *
 * چرا `settings.manage` و نه یک مجوز خواندنیِ ساده؟
 *   این فایل *همه‌چیز* را در یک جا جمع می‌کند: فهرست کامل مشتریان با
 *   شماره تلفن، قیمت خرید هر کالا، و کل گردش مالی. هرکدام جداگانه
 *   شاید دسترسی‌پذیر باشند، ولی یک‌جا و قابل حمل بودنشان ریسک
 *   متفاوتی است — این دقیقاً همان فایلی است که یک فروشنده‌ی ناراضی
 *   موقع رفتن برمی‌دارد.
 *
 *   پس فقط کسی که تنظیمات کسب‌وکار را مدیریت می‌کند (مالک/مدیر).
 */
export async function GET(request: Request) {
  try {
    /*
      سقف سخت‌گیرانه: هر درخواست ده‌ها هزار ردیف می‌خواند.
      بدون آن، چند کلیک پشت‌سرهم می‌تواند دیتابیس را زمین بزند.
    */
    const rl = hit(`backup:${clientIp(request)}`, {
      limit: 5,
      windowSeconds: 300,
      blockSeconds: 300,
    });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const url = new URL(request.url);
    const auth = await requireMember(url.searchParams.get("org_id"), "settings.manage");
    if ("response" in auth) return auth.response;
    const { membership, userId } = auth.ctx;

    const svc = serviceClient();

    const { data: org } = await svc
      .from("organizations")
      .select("name")
      .eq("id", membership.org_id)
      .maybeSingle();

    /*
      جدول‌ها پشت‌سرهم خوانده می‌شوند، نه با Promise.all.

      موازی‌سازی ۱۱ کوئریِ صفحه‌بندی‌شده، استخر اتصال‌های Supabase را
      اشباع می‌کند و روی پلن رایگان بقیه‌ی کاربران هم کند می‌شوند.
      پشتیبان عملیاتی نادر است؛ چند ثانیه دیرتر مهم نیست.
    */
    const results: TableResult[] = [];
    for (const spec of BACKUP_TABLES) {
      results.push(await fetchTable(svc, spec, membership.org_id));
    }

    const { data: userData } = await svc.auth.admin.getUserById(userId);

    const buffer = buildBackupWorkbook(results, {
      orgName: org?.name ?? "—",
      generatedAt: todayJalali(),
      generatedBy: userData.user?.email ?? "—",
    });

    return xlsxResponse(buffer, backupFileName(todayJalali()));
  } catch (error) {
    return safeError("backup:GET", error, 500, request);
  }
}
