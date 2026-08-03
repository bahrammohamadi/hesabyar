import { NextResponse } from "next/server";
import { BRAND_VERSION, BRAND_BUILD_SHA, BRAND_BUILT_AT } from "@/lib/brand";

export const dynamic = "force-dynamic";

/**
 * نسخه‌ی بیلدِ در حال اجرا روی سرور.
 *
 * کلاینت هر چند دقیقه این را می‌پرسد و با نسخه‌ای که خودش با آن
 * بارگذاری شده مقایسه می‌کند. اگر فرق داشت، یعنی دیپلوی تازه‌ای
 * انجام شده و کاربر باید صفحه را نو کند.
 *
 * چرا لازم است؟ اپ‌های تک‌صفحه‌ای پس از دیپلوی، همان جاوااسکریپت
 * قدیمی را در حافظه نگه می‌دارند. کاربری که تبش را باز گذاشته
 * ممکن است روزها روی نسخه‌ی کهنه بماند و باگ‌های رفع‌شده را
 * ببیند — یا بدتر، به فایل chunk‌ای درخواست بدهد که دیگر وجود ندارد.
 *
 * پاسخ عمداً کش نمی‌شود؛ وگرنه خودِ همین بررسی هم کهنه می‌ماند.
 */
export async function GET() {
  /*
    ⚠️ از lib/brand خوانده می‌شود، نه مستقیم از process.env.

    بلوک `env` در next.config فقط در زمان *کامپایل* جایگزینی متنی
    انجام می‌دهد؛ در روت سرور که در زمان اجرا ارزیابی می‌شود،
    process.env.NEXT_PUBLIC_APP_VERSION تعریف‌نشده است و مقدار
    پیش‌فرض «1.0» برمی‌گشت. (بازتولیدشده: پاسخ API نسخه‌ی dev می‌داد
    در حالی که بیلد 1.223 بود.)

    ماژول brand در زمان کامپایل بسته می‌شود، پس مقدار درست را دارد.
  */
  return NextResponse.json(
    {
      version: BRAND_VERSION,
      sha: BRAND_BUILD_SHA,
      builtAt: BRAND_BUILT_AT,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
