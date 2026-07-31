import type { MetadataRoute } from "next";

/**
 * نقشه‌ی سایت برای موتورهای جستجو.
 *
 * فقط صفحات عمومی فهرست می‌شوند؛ مسیرهای پنل (داشبورد، فروش، …) عمداً
 * نیامده‌اند چون نیازمند ورود هستند و نباید ایندکس شوند.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hesabyar-two.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const routes: { path: string; priority: number; changeFrequency: "weekly" | "monthly" }[] = [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    { path: "/features", priority: 0.9, changeFrequency: "monthly" },
    { path: "/pricing", priority: 0.9, changeFrequency: "weekly" },
    { path: "/guide", priority: 0.7, changeFrequency: "monthly" },
    { path: "/faq", priority: 0.7, changeFrequency: "monthly" },
    { path: "/about", priority: 0.5, changeFrequency: "monthly" },
    { path: "/contact", priority: 0.5, changeFrequency: "monthly" },
    { path: "/privacy", priority: 0.3, changeFrequency: "monthly" },
    { path: "/terms", priority: 0.3, changeFrequency: "monthly" },
  ];

  return routes.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
