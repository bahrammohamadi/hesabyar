import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * همه مسیرها به جز فایل‌های استاتیک و تصاویر
     *
     * 🔴 offline.html هم مستثنا شد.
     *   بدون آن، middleware صفحه‌ی آفلاین را به /login ریدایرکت
     *   می‌کرد (۳۰۷ اندازه‌گیری شد). یعنی سرویس‌ورکر موقع قطع شبکه
     *   صفحه‌ای را نشان می‌داد که خودش نیازمند شبکه و ورود بود —
     *   دقیقاً در بدترین لحظه‌ی ممکن.
     */
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.webmanifest|sw.js|offline.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
