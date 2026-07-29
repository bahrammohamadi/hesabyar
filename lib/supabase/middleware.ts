import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * به‌روزرسانی نشست کاربر و محافظت از مسیرها.
 * اگر کاربر وارد نشده باشد و به بخش محافظت‌شده برود، به صفحه ورود هدایت می‌شود.
 */
export async function updateSession(request: NextRequest) {
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
  // صفحه‌ی معرفی عمومی؛ بازدیدکننده‌ی مهمان باید بتواند ببیندش.
  // خودِ صفحه اگر کاربر واردشده باشد او را به داشبورد می‌فرستد.
  const isLanding = path === "/";
  const isPublic =
    isAuthPage ||
    isLanding ||
    path.startsWith("/_next") ||
    path.startsWith("/api/public") ||
    path === "/manifest.webmanifest" ||
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
