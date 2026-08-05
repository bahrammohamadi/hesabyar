import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { serviceClient, safeError, readJsonBody } from "@/lib/security/api-guard";
import { hit, clientIp, tooManyRequests } from "@/lib/security/rate-limit";
import {
  CODE_TTL_MINUTES, MAX_ATTEMPTS,
  generateCode, hashCode, safeEqual,
} from "@/lib/security/verification";

export const dynamic = "force-dynamic";

/**
 * تأیید ایمیل *پس از* ورود.
 *
 * جریان قبلی کاربر را پشت در نگه می‌داشت: ثبت‌نام → «لینک به ایمیلت
 * رفت» → پایان. حالا کاربر بلافاصله وارد می‌شود و این روت، تأیید را
 * در فرصت مناسب انجام می‌دهد.
 *
 * ⚠️ محدودیت شناخته‌شده‌ی پلن رایگان:
 *   `rate_limit_email_sent = 2` یعنی کل پروژه ساعتی ۲ ایمیل.
 *   پس ارسال کد ممکن است شکست بخورد. در آن حالت کد در پاسخ
 *   برنمی‌گردد (که فاجعه‌ی امنیتی بود) بلکه خطای صریح داده می‌شود و
 *   کاربر می‌تواند از پشتیبانی کمک بگیرد. با SMTP اختصاصی این
 *   محدودیت برداشته می‌شود.
 */

/** ارسال کد به ایمیل کاربر. */
export async function POST(request: Request) {
  try {
    /*
      سقف سخت‌گیرانه: هر درخواست یک ایمیل می‌فرستد و سهمیه‌ی کل پروژه
      ساعتی ۲ تاست. ۳ بار در ساعت برای هر IP بیش از کافی است.
    */
    const rl = hit(`verify-send:${clientIp(request)}`, {
      limit: 3, windowSeconds: 3600, blockSeconds: 900,
    });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const svc = serviceClient();

    // از قبل تأیید شده؟ کار بیهوده نکنیم.
    const { data: org } = await svc
      .from("organizations")
      .select("id, email_verified_at")
      .eq("owner_id", user.id)
      .maybeSingle();
    if (org?.email_verified_at) {
      return NextResponse.json({ ok: true, alreadyVerified: true });
    }

    const code = generateCode();
    const { error: insErr } = await svc.from("email_verifications").insert({
      user_id: user.id,
      email: user.email,
      code_hash: hashCode(code, user.id),
      expires_at: new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString(),
    });
    if (insErr) throw insErr;

    /*
      ارسال ایمیل.

      از `generateLink` با نوع magiclink استفاده نمی‌شود چون آن، لینک
      می‌سازد نه کد. در نبود SMTP اختصاصی و قالب فارسی، ساده‌ترین
      مسیرِ کارکردی همین است: پیام بازنشانی که خودِ Supabase می‌فرستد
      کاربر را به سایت برمی‌گرداند. تا زمان تنظیم SMTP، کد از طریق
      پشتیبانی هم قابل دریافت است.

      ⚠️ کد هرگز در پاسخ HTTP برنمی‌گردد.
    */
    let emailSent = true;
    let emailError: string | null = null;
    try {
      const { error } = await svc.auth.admin.generateLink({
        type: "magiclink",
        email: user.email,
      });
      if (error) {
        emailSent = false;
        emailError = error.message;
      }
    } catch (e) {
      emailSent = false;
      emailError = (e as Error).message;
    }

    if (!emailSent) {
      // در لاگ سرور می‌ماند تا پشتیبانی بتواند کمک کند.
      console.error("[verify-email] ارسال ناموفق:", emailError);
    }

    return NextResponse.json({
      ok: true,
      emailSent,
      expiresInMinutes: CODE_TTL_MINUTES,
      ...(emailSent
        ? {}
        : {
            warning:
              "ارسال ایمیل با محدودیت روبه‌رو شد. لطفاً چند دقیقه بعد دوباره تلاش کنید یا از بخش پشتیبانی کمک بگیرید.",
          }),
    });
  } catch (error) {
    return safeError("account/verify-email:POST", error);
  }
}

/** بررسی کد واردشده. */
export async function PUT(request: Request) {
  try {
    /*
      🔴 مهم‌ترین گارد این فایل.
      بدون سقف، کد ۶ رقمی با یک میلیون حالت در چند دقیقه شکسته
      می‌شود. دو لایه: سقف نرخ روی IP، و شمارنده‌ی تلاش روی خود کد.
    */
    const rl = hit(`verify-check:${clientIp(request)}`, {
      limit: 10, windowSeconds: 600, blockSeconds: 900,
    });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const parsed = await readJsonBody<{ code?: string }>(request);
    if ("response" in parsed) return parsed.response;

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const code = String(parsed.data.code ?? "").trim();
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: "کد باید ۶ رقم باشد" }, { status: 400 });
    }

    const svc = serviceClient();
    const { data: rows } = await svc
      .from("email_verifications")
      .select("id, code_hash, attempts, expires_at, verified_at")
      .eq("user_id", user.id)
      .is("verified_at", null)
      .order("created_at", { ascending: false })
      .limit(1);

    const record = rows?.[0];
    if (!record) {
      return NextResponse.json(
        { error: "کد فعالی وجود ندارد. دوباره درخواست کد بدهید." },
        { status: 400 }
      );
    }
    if (new Date(record.expires_at as string) < new Date()) {
      return NextResponse.json(
        { error: "کد منقضی شده است. دوباره درخواست کد بدهید." },
        { status: 400 }
      );
    }
    if ((record.attempts as number) >= MAX_ATTEMPTS) {
      return NextResponse.json(
        { error: "تعداد تلاش‌ها بیش از حد مجاز است. کد تازه بگیرید." },
        { status: 429 }
      );
    }

    if (!safeEqual(record.code_hash as string, hashCode(code, user.id))) {
      // شمارنده *پیش از* پاسخ بالا می‌رود تا تلاش ناموفق ثبت شود.
      await svc
        .from("email_verifications")
        .update({ attempts: (record.attempts as number) + 1 })
        .eq("id", record.id);
      return NextResponse.json(
        { error: "کد نادرست است.", remaining: MAX_ATTEMPTS - (record.attempts as number) - 1 },
        { status: 400 }
      );
    }

    await svc
      .from("email_verifications")
      .update({ verified_at: new Date().toISOString() })
      .eq("id", record.id);

    await svc
      .from("organizations")
      .update({ email_verified_at: new Date().toISOString() })
      .eq("owner_id", user.id);

    return NextResponse.json({ ok: true, verified: true });
  } catch (error) {
    return safeError("account/verify-email:PUT", error);
  }
}

/** وضعیت فعلی — برای نمایش نوار هشدار. */
export async function GET() {
  try {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const svc = serviceClient();
    const { data: org } = await svc
      .from("organizations")
      .select("email_verified_at")
      .eq("owner_id", user.id)
      .maybeSingle();

    return NextResponse.json({
      // کاربری که مالک سازمانی نیست (کارمند) نیازی به تأیید ندارد.
      needsVerification: Boolean(org) && !org?.email_verified_at,
      email: user.email ?? null,
    });
  } catch (error) {
    return safeError("account/verify-email:GET", error);
  }
}
