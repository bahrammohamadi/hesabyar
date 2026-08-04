/**
 * تشخیص دستگاه از رشته‌ی User-Agent.
 *
 * ⚠️ این یک تشخیص «به‌اندازه‌ی کافی خوب» است، نه دقیق. هدف کمک به
 * کاربر برای شناختن نشست‌های خودش است («این همان گوشی من است؟»)، نه
 * تحلیل فنی. کتابخانه‌ی کامل ua-parser حدود ۲۰KB به باندل اضافه
 * می‌کند که برای این کار ارزشش را ندارد.
 */

export interface DeviceInfo {
  browser: string;
  os: string;
  /** برچسب کوتاه برای نمایش: «کروم روی اندروید» */
  label: string;
  kind: "mobile" | "tablet" | "desktop" | "unknown";
}

export function parseUserAgent(ua: string | null | undefined): DeviceInfo {
  if (!ua) return { browser: "نامشخص", os: "نامشخص", label: "دستگاه ناشناس", kind: "unknown" };

  const s = ua.toLowerCase();

  /*
    ترتیب مهم است: بیشتر مرورگرها «Safari» و خیلی‌ها «Chrome» را هم
    در رشته‌ی خود دارند. پس خاص‌ترین‌ها اول بررسی می‌شوند.
  */
  let browser = "مرورگر ناشناس";
  if (s.includes("firefox/")) browser = "فایرفاکس";
  else if (s.includes("edg/")) browser = "اِج";
  else if (s.includes("opr/") || s.includes("opera")) browser = "اپرا";
  else if (s.includes("samsungbrowser")) browser = "سامسونگ";
  // headlesschrome رشته‌ی «chrome/» ندارد — در تست واقعی ۸۰ نشست
  // «مرورگر ناشناس» شدند تا این اضافه شد.
  else if (s.includes("headlesschrome")) browser = "کروم (خودکار)";
  else if (s.includes("chrome/") || s.includes("crios")) browser = "کروم";
  else if (s.includes("safari/")) browser = "سافاری";

  let os = "سیستم ناشناس";
  let kind: DeviceInfo["kind"] = "desktop";
  if (s.includes("android")) {
    os = "اندروید";
    // اندرویدِ بدون «mobile» یعنی تبلت.
    kind = s.includes("mobile") ? "mobile" : "tablet";
  } else if (s.includes("iphone")) {
    os = "آی‌او‌اس";
    kind = "mobile";
  } else if (s.includes("ipad")) {
    os = "آی‌پدOS";
    kind = "tablet";
  } else if (s.includes("windows")) {
    os = "ویندوز";
  } else if (s.includes("mac os") || s.includes("macintosh")) {
    os = "مک";
  } else if (s.includes("linux") || s.includes("x11")) {
    os = "لینوکس";
  }

  /*
    ابزارهای غیرمرورگری. این‌ها معمولاً نشست‌های سرور یا اسکریپت‌اند و
    نمایششان به‌عنوان «مرورگر ناشناس» گمراه‌کننده است.
  */
  if (s.startsWith("curl/")) return { browser: "curl", os: "خط فرمان", label: "ابزار خط فرمان (curl)", kind: "unknown" };
  if (s.includes("vercel edge")) return { browser: "سرور", os: "Vercel", label: "سرور برنامه", kind: "unknown" };
  if (s.includes("node") || s.includes("python")) return { browser: "اسکریپت", os: "سرور", label: "اسکریپت خودکار", kind: "unknown" };

  return { browser, os, label: `${browser} روی ${os}`, kind };
}
