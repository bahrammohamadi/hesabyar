import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { serviceClient, safeError, readJsonBody } from "@/lib/security/api-guard";
import { hit, clientIp, tooManyRequests } from "@/lib/security/rate-limit";
import {
  formatBackupCode,
  generateBackupCodes,
  hashBackupCode,
  isWellFormedBackupCode,
  normalizeBackupCode,
} from "@/lib/security/backup-codes";

export const dynamic = "force-dynamic";

/**
 * فلفل هش.
 *
 * ⚠️ اگر متغیر محیطی نباشد از کلید سرویس مشتق می‌شود — ایده‌آل
 * نیست ولی از ثابتِ درون کد بسیار بهتر است: کلید سرویس در مخزن
 * نیست و بین نصب‌ها فرق می‌کند.
 */
function pepper(): string {
  return (
    process.env.RESET_CODE_PEPPER ??
    process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-32) ??
    "tarazoo-backup"
  );
}

/**
 * POST — ساخت مجموعه‌ی تازه‌ی کدهای پشتیبان.
 *
 * ⚠️ مجموعه‌ی قبلی **کاملاً باطل** می‌شود. استاندارد همین را
 * می‌گوید: کاربری که کد تازه گرفته باید بداند کاغذ قبلی بی‌ارزش
 * است، وگرنه دو مجموعه‌ی معتبر همزمان وجود دارد و یکی‌شان
 * احتمالاً جایی رها شده.
 *
 * 🔴 کدها فقط **همین یک بار** برمی‌گردند. در دیتابیس هش ذخیره
 * می‌شود، پس بازیابی‌شان ممکن نیست.
 */
export async function POST(request: Request) {
  try {
    const rl = hit(`backup-codes-gen:${clientIp(request)}`, { limit: 10, windowSeconds: 3600 });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    /*
      🔴 فقط کاربری که ورود دومرحله‌ای **تأییدشده** دارد می‌تواند
      کد پشتیبان بسازد.

      بدون این چک، کاربری بدون 2FA هم می‌توانست ده کد بسازد که
      هیچ کاری نمی‌کنند — و بعد فکر کند محافظت اضافه‌ای دارد.
    */
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const hasVerified = (factors?.all ?? []).some((f) => f.status === "verified");
    if (!hasVerified) {
      return NextResponse.json(
        { error: "ابتدا ورود دومرحله‌ای را فعال کنید." },
        { status: 400 }
      );
    }

    const codes = generateBackupCodes();
    const hashes = codes.map((c) => hashBackupCode(c, user.id, pepper()));

    const svc = serviceClient();
    const { data: count, error } = await svc.rpc("replace_backup_codes", {
      p_user_id: user.id,
      p_hashes: hashes,
    });
    if (error) {
      return safeError("auth/backup-codes:create", error);
    }

    return NextResponse.json({
      ok: true,
      // 🔴 تنها جایی که کد خام دیده می‌شود.
      codes: codes.map(formatBackupCode),
      count: Number(count ?? codes.length),
    });
  } catch (error) {
    return safeError("auth/backup-codes:post", error);
  }
}

/**
 * PUT — مصرف یک کد پشتیبان به‌جای کد اپ.
 *
 * ⚠️ این مسیر عمداً **نشست جدید نمی‌سازد**. کاربر از قبل نشست
 * `aal1` دارد (رمز را داده)؛ کاری که اینجا انجام می‌شود صدور یک
 * پرچم موقت است تا گارد middleware او را رد کند.
 *
 * 🔴 چرا نمی‌شود مستقیم به `aal2` رساند؟
 *   سطح تضمین در توکن Supabase امضا شده و از بیرون قابل ارتقا
 *   نیست. تنها راه رسمی، تأیید یک فاکتور واقعی است. پس کد پشتیبان
 *   **فاکتور دومرحله‌ای را حذف می‌کند** و کاربر با رمز وارد
 *   می‌شود — سپس باید دوباره فعالش کند.
 *
 *   این همان رفتاری است که GitHub و Google هم دارند: کد پشتیبان
 *   یک در اضطراری است، نه یک روش ورود دائمی.
 */
export async function PUT(request: Request) {
  try {
    const rl = hit(`backup-codes-use:${clientIp(request)}`, {
      limit: 5,
      windowSeconds: 900,
      blockSeconds: 900,
    });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const parsed = await readJsonBody<Record<string, unknown>>(request);
    if ("response" in parsed) return parsed.response;

    const raw = String(parsed.data.code ?? "");
    /*
      شکل کد پیش از تماس با دیتابیس بررسی می‌شود تا ورودی آشکارا
      غلط سهمیه‌ی محدود کاربر را نسوزاند.
    */
    if (!isWellFormedBackupCode(raw)) {
      return NextResponse.json({ error: "کد پشتیبان نادرست است." }, { status: 400 });
    }

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const svc = serviceClient();
    const { data, error } = await svc.rpc("consume_backup_code", {
      p_user_id: user.id,
      p_code_hash: hashBackupCode(normalizeBackupCode(raw), user.id, pepper()),
    });
    if (error) {
      return safeError("auth/backup-codes:consume", error);
    }

    const result = data as { ok?: boolean; remaining?: number };
    if (!result?.ok) {
      /* ثبت تلاش ناموفق تا حمله در سابقه دیده شود. */
      try {
        await svc.rpc("record_login_event", {
          p_login_id: user.email ?? user.id,
          p_event: "mfa_failure",
          p_user_id: user.id,
          p_ip: clientIp(request),
          p_user_agent: request.headers.get("user-agent"),
        });
      } catch {
        /* ثبت سابقه نباید مسیر را بشکند. */
      }
      return NextResponse.json({ error: "کد پشتیبان نادرست است." }, { status: 400 });
    }

    /*
      کد درست بود ⇒ فاکتورهای دومرحله‌ای حذف می‌شوند تا کاربر با
      همان نشست فعلی وارد شود.

      ⚠️ این عمدی و صریح است: کاربر باید بداند 2FA خاموش شده و
      دوباره فعالش کند. پیام پاسخ همین را می‌گوید.
    */
    for (const f of (await supabase.auth.mfa.listFactors()).data?.all ?? []) {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }

    try {
      await svc.rpc("record_login_event", {
        p_login_id: user.email ?? user.id,
        p_event: "reset",
        p_user_id: user.id,
        p_ip: clientIp(request),
        p_user_agent: request.headers.get("user-agent"),
      });
    } catch {
      /* ثبت سابقه نباید مسیر را بشکند. */
    }

    return NextResponse.json({
      ok: true,
      remaining: Number(result.remaining ?? 0),
      /* کلاینت این را به کاربر نشان می‌دهد. */
      mfaDisabled: true,
    });
  } catch (error) {
    return safeError("auth/backup-codes:put", error);
  }
}
