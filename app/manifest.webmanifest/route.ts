import { NextResponse } from "next/server";
import { BRAND_NAME, BRAND_TAGLINE, BRAND_DESCRIPTION } from "@/lib/brand";

/** فایل مانیفست PWA (داینامیک تا آیکون‌ها قابل تنظیم باشند) */
export async function GET() {
  const manifest = {
    name: `${BRAND_NAME} — ${BRAND_TAGLINE}`,
    short_name: BRAND_NAME,
    description: BRAND_DESCRIPTION,
    start_url: "/dashboard",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f7fb",
    theme_color: "#136451",
    dir: "rtl",
    lang: "fa",
    /*
      🔴 «any» و «maskable» جدا اعلام می‌شوند، نه به‌صورت
      "any maskable" روی یک آیکون.

      آیکون maskable باید حاشیه‌ی امن داشته باشد چون اندروید آن را
      در قالب دایره/مربع گرد می‌برد. اعلام یک فایل به‌عنوان هر دو
      یعنی یا در حالت maskable لبه‌هایش بریده می‌شود، یا در حالت
      any حاشیه‌ی خالی بزرگی دور آیکون می‌ماند.

      چون آیکون فعلی حاشیه‌ی امن maskable ندارد، فقط «any» اعلام
      می‌شود. اعلام نکردن maskable بی‌خطر است (اندروید خودش پس‌زمینه
      می‌گذارد)؛ اعلام نادرستش آیکون را خراب نشان می‌دهد.
    */
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
    /*
      میان‌برهای فشار طولانی روی آیکون. کاربر بدون باز کردن اپ
      مستقیم به پرکاربردترین کار می‌رسد.
    */
    shortcuts: [
      { name: "فروش جدید", short_name: "فروش", url: "/sales?panels=invoice:sale:create:new" },
      { name: "کالاها", short_name: "کالا", url: "/products" },
      { name: "مشتریان", short_name: "مشتری", url: "/contacts" },
    ],
    categories: ["business", "finance", "productivity"],
  };

  return NextResponse.json(manifest, {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
