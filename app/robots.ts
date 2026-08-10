import type { MetadataRoute } from "next";

/**
 * قواعد خزنده‌ها.
 *
 * مسیرهای پنل و API صراحتاً مسدود شده‌اند تا صفحات نیازمند ورود
 * در نتایج جستجو ظاهر نشوند.
 *
 * ⚠️ `/shop/...` عمداً **مسدود نیست**: کل هدف صفحه‌ی عمومی فروشگاه
 * این است که دیده شود. ولی `/settings` مسدود است، پس
 * `/settings/storefront` هم خودبه‌خود پوشش داده می‌شود.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tarazooapp.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard",
          "/sales",
          "/purchases",
          "/contacts",
          "/products",
          "/inventory",
          "/finance",
          "/reports",
          "/activity",
          "/settings",
          "/admin",
          "/loyalty",
          "/checks",
          "/setup",
          "/pending-approval",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
