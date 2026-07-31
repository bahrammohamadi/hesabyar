import type { Metadata, Viewport } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";

/*
  فونت با next/font بارگذاری می‌شود، نه @import از jsDelivr.

  چرا بهتر است:
   • فایل فونت کنار خود سایت سرو می‌شود → یک اتصال شبکه‌ای کمتر،
     بدون DNS/TLS جداگانه به CDN بیگانه (FCP سریع‌تر).
   • display:swap یعنی متن بلافاصله با فونت پشتیبان دیده می‌شود.
   • با size-adjust خودکار Next، پرش چیدمان هنگام سوییچ فونت کم می‌شود.
   • دیگر لازم نیست CSP به jsdelivr.net اجازه بدهد (سطح حمله کمتر).
*/
const vazirmatn = Vazirmatn({
  subsets: ["arabic"],
  weight: ["400", "500", "700", "900"],
  display: "swap",
  variable: "--font-vazirmatn",
  fallback: ["Tahoma", "sans-serif"],
});
import { Providers } from "@/components/providers";
import { BRAND_NAME, BRAND_TITLE, BRAND_DESCRIPTION } from "@/lib/brand";

export const metadata: Metadata = {
  title: BRAND_TITLE,
  description: BRAND_DESCRIPTION,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: BRAND_NAME,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#136451" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
  width: "device-width",
  initialScale: 1,
  /*
    زوم عمداً آزاد است.
    قبلاً maximumScale=1 و userScalable=false بود که axe آن را
    «critical» علامت می‌زد (WCAG 1.4.4): کاربر کم‌بینا نمی‌توانست
    صفحه را بزرگ کند. محدود کردن زوم فقط برای جلوگیری از زوم ناخواسته
    هنگام تپ روی input است که با font-size ≥ ۱۶px در فرم‌ها حل می‌شود.
  */
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
