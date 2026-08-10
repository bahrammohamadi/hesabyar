import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hit, clientIp } from "@/lib/security/rate-limit";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * سقف درخواست در لبه (Edge).
 *
 * چرا اینجا و نه فقط داخل روت‌ها؟
 *   روت‌های API روی توابع serverless اجرا می‌شوند و هر درخواست ممکن است به
 *   instance تازه‌ای برود؛ شمارنده‌ی درون‌حافظه‌ای آنجا عملاً بی‌اثر است.
 *   middleware روی Edge اجرا می‌شود و instanceهایش بیشتر بازاستفاده می‌شوند،
 *   پس شمارنده مؤثرتر است و پیش از رسیدن به منطق سنگین جلوی سیل را می‌گیرد.
 *
 * ⚠️ همچنان جایگزین کامل یک WAF یا Redis مشترک نیست. برای محافظت قطعی،
 *    باید Vercel Firewall یا Upstash Redis اضافه شود (در SECURITY_RUNBOOK آمده).
 */
function edgeRateLimit(request: NextRequest, path: string): NextResponse | null {
  const ip = clientIp(request);

  // ورود و ثبت‌نام: هدف اصلی brute-force و credential stuffing.
  if (path.startsWith("/login") || path.startsWith("/register")) {
    if (request.method === "POST") {
      const rl = hit(`edge-auth-post:${ip}`, { limit: 10, windowSeconds: 300, blockSeconds: 900 });
      if (!rl.allowed) {
        return NextResponse.json(
          { error: "تلاش‌های ناموفق زیاد بود. لطفاً چند دقیقه بعد دوباره تلاش کنید." },
          { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
        );
      }
    }
    const view = hit(`edge-auth-view:${ip}`, { limit: 60, windowSeconds: 60 });
    if (!view.allowed) {
      return NextResponse.json(
        { error: "تعداد درخواست بیش از حد مجاز" },
        { status: 429, headers: { "Retry-After": String(view.retryAfterSeconds) } }
      );
    }
  }

  // سایر مسیرهای API
  if (path.startsWith("/api/")) {
    const rl = hit(`edge-api:${ip}`, { limit: 120, windowSeconds: 60, blockSeconds: 60 });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "تعداد درخواست بیش از حد مجاز" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
      );
    }
  }

  return null;
}

/**
 * به‌روزرسانی نشست کاربر و محافظت از مسیرها.
 * اگر کاربر وارد نشده باشد و به بخش محافظت‌شده برود، به صفحه ورود هدایت می‌شود.
 */
export async function updateSession(request: NextRequest) {
  // پیش از هر کار سنگین (از جمله تماس شبکه‌ای با Supabase) سیل درخواست را می‌گیریم.
  const limited = edgeRateLimit(request, request.nextUrl.pathname);
  if (limited) return limited;

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthPage = path.startsWith("/login") || path.startsWith("/register");

  /*
    صفحات وب‌سایت عمومی (معرفی محصول).

    ⚠️ هر صفحه‌ی جدیدی که به وب‌سایت اضافه می‌شود باید اینجا هم ثبت شود،
    وگرنه middleware بازدیدکننده‌ی مهمان را به /login می‌فرستد.
    این دقیقاً همان باگی بود که پیش‌تر باعث شد لندینگ دیده نشود.

    از تطبیق دقیق (نه startsWith) استفاده می‌کنیم تا مسیری مثل
    «/features-secret» ناخواسته عمومی نشود.
  */
  const PUBLIC_SITE_PATHS = new Set([
    "/",
    "/features",
    "/pricing",
    "/about",
    "/contact",
    "/faq",
    "/guide",
    "/privacy",
    "/terms",
  ]);
  /*
    🔴 صفحه‌ی عمومی فروشگاه — /shop/<slug>

    اینجا استثنائاً startsWith لازم است چون slug متغیر است و در
    فهرست ثابت نمی‌گنجد.

    این باگ در تست واقعی گرفته شد: صفحه ساخته شده بود، تابع
    دیتابیس درست کار می‌کرد و تست‌ها سبز بودند، ولی بازدیدکننده‌ی
    ناشناس به /login منتقل می‌شد — یعنی صفحه‌ی «عمومی» عملاً
    خصوصی بود. نه tsc و نه next build چنین چیزی را نمی‌گیرند.

    خطر گسترده‌شدن ناخواسته ندارد: هرچه زیر /shop/ است عمداً عمومی
    است، و خودِ صفحه فقط فروشگاه منتشرشده را نشان می‌دهد و برای
    بقیه ۴۰۴ می‌دهد.
  */
  const isPublicStorefront = path === "/shop" || path.startsWith("/shop/");

  const isPublicSite = PUBLIC_SITE_PATHS.has(path) || isPublicStorefront;

  /*
    /onboarding و /setup نیاز به نشست دارند ولی هنوز سازمانی وجود
    ندارد. اگر عمومی حسابشان نکنیم مشکلی پیش نمی‌آید (کاربر واردشده
    است)، اما اینجا صریح نگهشان می‌داریم تا منطق واضح بماند.
  */
  const isPublic =
    isAuthPage ||
    isPublicSite ||
    path.startsWith("/_next") ||
    path.startsWith("/api/public") ||
    /*
      نسخه‌ی بیلد اطلاعات حساسی نیست و باید پیش از ورود هم قابل
      خواندن باشد، وگرنه بررسی به‌روزرسانی در صفحه‌ی ورود کار
      نمی‌کند و ۴۰۱ می‌گیرد.
    */
    path === "/api/version" ||
    /*
      🔴 روت ورود باید عمومی باشد — وگرنه تناقض منطقی:
      کاربری که هنوز وارد نشده نمی‌تواند به مسیر ورود دسترسی داشته
      باشد و همیشه 401 می‌گیرد.

      (بازتولید شد: پس از انتقال ورود به سرور، حتی رمز درست هم
      «Unauthorized» می‌گرفت چون middleware جلوتر از خود روت جواب
      می‌داد.)

      امنیتش از دست نمی‌رود: خودِ روت هم محدودیت نرخ per-IP دارد و هم
      کندسازی نمایی per-account.
    */
    path === "/api/auth/login" ||
    /*
      ⚠️ /api/market و /api/weather عمداً *عمومی نیستند*.

      نوار قیمت فقط داخل AppShell رندر می‌شود، یعنی کاربر حتماً وارد
      شده است. اگر عمومی می‌شدند، این سایت به یک پراکسی رایگان برای
      tgju و open-meteo تبدیل می‌شد که هر کسی می‌توانست از آن استفاده
      کند و سهمیه‌ی ما را بسوزاند.
    */
    path === "/manifest.webmanifest" ||
    path === "/robots.txt" ||
    path === "/sitemap.xml" ||
    path.startsWith("/icons");

  // کاربر وارد نشده و در صفحه/API محافظت‌شده است
  if (!user && !isPublic) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // کاربر وارد شده و در صفحه ورود است → برو به داشبورد
  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
