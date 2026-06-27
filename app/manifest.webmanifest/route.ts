import { NextResponse } from "next/server";

/** فایل مانیفست PWA (داینامیک تا آیکون‌ها قابل تنظیم باشند) */
export async function GET() {
  const manifest = {
    name: "مهرجامه — مدیریت فروش و مالی",
    short_name: "مهرجامه",
    description: "سیستم مدیریت فروش، انبار و مالی مهرجامه",
    start_url: "/dashboard",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f7fb",
    theme_color: "#136451",
    dir: "rtl",
    lang: "fa",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ],
  };

  return NextResponse.json(manifest, {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
