/** @type {import('next').NextConfig} */

const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co").origin;
  } catch {
    return "https://*.supabase.co";
  }
})();

/**
 * Content-Security-Policy.
 *
 * 'unsafe-inline' برای style لازم است چون Tailwind و Next استایل درون‌خطی تزریق می‌کنند.
 * برای script هم Next در حالت production چند اسکریپت bootstrap درون‌خطی دارد؛
 * حذف آن نیازمند nonce در سطح middleware است که در گام بعدی قابل انجام است.
 * حتی با این محدودیت، CSP جلوی بارگذاری اسکریپت از دامنه‌های بیگانه را می‌گیرد.
 */
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseHost} https://*.supabase.co wss://*.supabase.co`,
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // کلیک‌جکینگ: هیچ سایتی حق ندارد پنل را داخل iframe بگذارد.
  { key: "X-Frame-Options", value: "DENY" },
  // جلوگیری از MIME sniffing (اجرای فایل آپلودی به‌عنوان اسکریپت).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // نشت آدرس صفحات داخلی به سایت‌های ثالث را محدود می‌کند.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // دسترسی به سخت‌افزار حساس را می‌بندد.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig = {
  reactStrictMode: true,
  // نسخه‌ی فریم‌ورک را از مهاجم پنهان می‌کند (شناسایی CVE سخت‌تر می‌شود).
  poweredByHeader: false,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // پاسخ APIها هرگز نباید در CDN یا مرورگر کش شود.
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, private" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
    ];
  },
};

export default nextConfig;
