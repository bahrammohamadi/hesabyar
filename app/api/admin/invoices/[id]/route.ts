import { NextResponse } from "next/server";
import {
  requirePlatformPermission,
  safeError,
  isUuid,
  readJsonBody,
  requestIp,
} from "@/lib/security/api-guard";
import { hit, clientIp, tooManyRequests } from "@/lib/security/rate-limit";
import { isReasonValid, MIN_REASON_LENGTH } from "@/lib/admin/invoices";
import { toFaDigits } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

/** جزئیات یک فاکتور به‌همراه اقلامش. */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const rl = hit(`admin-invoice:${clientIp(request)}`, { limit: 60, windowSeconds: 60 });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const auth = await requirePlatformPermission("invoice.view");
    if ("response" in auth) return auth.response;

    if (!isUuid(params.id)) {
      return NextResponse.json({ error: "شناسه‌ی نامعتبر" }, { status: 400 });
    }

    const { data: invoice, error } = await auth.svc
      .from("v_admin_invoices")
      .select("*")
      .eq("id", params.id)
      .maybeSingle();
    if (error) throw error;
    if (!invoice) return NextResponse.json({ error: "فاکتور یافت نشد" }, { status: 404 });

    const { data: items } = await auth.svc
      .from("v_admin_invoice_items")
      .select("*")
      .eq("sale_id", params.id);

    /*
      رویدادهای ممیزی مربوط به همین فاکتور.

      بدون این، ادمین نمی‌داند سند قبلاً دست‌کاری شده یا نه — و
      تاریخچه‌ی دخالت پشتیبانی دقیقاً همان چیزی است که موقع اختلاف
      با مشتری لازم می‌شود.
    */
    const { data: audit } = await auth.svc
      .from("v_platform_audit")
      .select("*")
      .eq("target_type", "sale")
      .eq("target_id", params.id)
      .order("created_at", { ascending: false })
      .limit(20);

    return NextResponse.json({
      invoice,
      items: items ?? [],
      audit: audit ?? [],
      viewerRole: auth.role,
    });
  } catch (error) {
    return safeError("admin/invoice:GET", error, 500, request);
  }
}

/**
 * ابطال فاکتور توسط پشتیبانی.
 *
 * چرا فقط «ابطال» و نه «حذف»؟
 *   کاربر «حذف فاکتور» خواسته بود. حذف واقعی سطر، در یک سیستم
 *   حسابداری کار غلطی است و هیچ نرم‌افزار جدی‌ای آن را انجام نمی‌دهد:
 *   فاکتور به موجودی انبار، مانده‌ی حساب مشتری و گردش صندوق گره
 *   خورده. حذف سطر یعنی موجودی انبار برای همیشه غلط می‌ماند و
 *   شماره‌ی فاکتور در دنباله سوراخ می‌شود — دقیقاً همان الگویی که
 *   حسابرس به آن مشکوک می‌شود.
 *
 *   ابطال (storno) اثر مالی و انباری را کاملاً خنثی می‌کند، سند را
 *   با برچسب «باطل‌شده» نگه می‌دارد و ردّ ممیزی می‌گذارد. نتیجه‌ی
 *   عملی برای کاربر یکی است، بدون خرابیِ داده.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    // عملیات مخرب روی داده‌ی مشتری: سقف سخت‌گیرانه.
    const rl = hit(`admin-invoice-act:${clientIp(request)}`, {
      limit: 10,
      windowSeconds: 60,
      blockSeconds: 300,
    });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const auth = await requirePlatformPermission("invoice.modify");
    if ("response" in auth) return auth.response;

    if (!isUuid(params.id)) {
      return NextResponse.json({ error: "شناسه‌ی نامعتبر" }, { status: 400 });
    }

    const parsed = await readJsonBody<{ action?: string; reason?: string }>(request);
    if ("response" in parsed) return parsed.response;

    const { action } = parsed.data;
    const reason = typeof parsed.data.reason === "string" ? parsed.data.reason.slice(0, 500) : "";

    if (action !== "cancel") {
      return NextResponse.json({ error: "عملیات نامعتبر" }, { status: 400 });
    }
    if (!isReasonValid(reason)) {
      /*
        🔴 رقم فارسی، نه لاتین.
        نسخه‌ی اول این پیام `${MIN_REASON_LENGTH}` را مستقیم درج
        می‌کرد و کاربر «حداقل 5 نویسه» می‌دید — تنها رقم لاتین در یک
        رابط تماماً فارسی. در تست HTTP واقعی دیده شد، نه در بیلد.
      */
      return NextResponse.json(
        { error: `ثبت دلیل الزامی است (حداقل ${toFaDigits(MIN_REASON_LENGTH)} نویسه)` },
        { status: 400 }
      );
    }

    /*
      p_actor صریح پاس داده می‌شود چون این کلاینت با service_role کار
      می‌کند و در آن حالت auth.uid() داخل دیتابیس NULL است (۰۰۲۲).
      هویت از قبل در requirePlatformPermission تأیید شده است.
    */
    const { data, error } = await auth.svc.rpc("admin_cancel_sale", {
      p_sale: params.id,
      p_actor: auth.userId,
      p_reason: reason.trim(),
      p_ip: requestIp(request),
    });

    if (error) {
      /*
        خطاهای گاردِ خود تابع (دسترسی، دلیل کوتاه، فاکتور ناموجود)
        پیام فارسیِ قابل‌نمایش دارند و باید به کاربر برسند، نه اینکه
        زیر «خطای داخلی سرور» پنهان شوند.
      */
      const msg = error.message ?? "";
      if (msg.includes("یافت نشد")) return NextResponse.json({ error: msg }, { status: 404 });
      if (msg.includes("دسترسی")) return NextResponse.json({ error: msg }, { status: 403 });
      if (msg.includes("دلیل")) return NextResponse.json({ error: msg }, { status: 400 });
      throw error;
    }

    const result = (data ?? {}) as { cancelled?: boolean; invoice_no?: string };

    return NextResponse.json({
      ok: true,
      cancelled: result.cancelled === true,
      // پیام صادق: اگر از قبل باطل بوده، وانمود نکنیم کاری کردیم.
      message:
        result.cancelled === true
          ? "فاکتور باطل شد و موجودی و مانده‌ی حساب برگشت خورد."
          : "این فاکتور از قبل باطل شده بود؛ تغییری اعمال نشد.",
    });
  } catch (error) {
    return safeError("admin/invoice:POST", error, 500, request);
  }
}
