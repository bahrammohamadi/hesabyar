/**
 * منطق خالص نصب اپ (PWA).
 *
 * در `.ts` جداست تا Vitest بتواند بخواندش — تشخیص پلتفرم و تصمیم
 * «چه راهنمایی نشان بدهیم» دقیقاً همان چیزی است که باید تست شود،
 * چون روی هر مرورگر متفاوت است و اشتباهش یعنی کاربر گیر می‌کند.
 */

/** کلید یادآوریِ «بعداً» در مرورگر کاربر. */
export const INSTALL_DISMISS_KEY = "tarazoo-install-dismissed";

/**
 * کلید «در همین نشست یک‌بار نشان داده شد».
 *
 * 🔴 چرا `sessionStorage` و نه `localStorage`؟
 *   کاربر گزارش داد پیشنهاد نصب با **هر بار رفرش صفحه** برمی‌گشت.
 *   علت این بود که تنها ترمزِ موجود، کلیک روی «بعداً» بود؛ کسی که
 *   بنر را نادیده می‌گرفت و صفحه را رفرش می‌کرد، دوباره همان بنر را
 *   می‌دید. sessionStorage تا بسته‌شدن تب باقی می‌ماند، پس رفرش و
 *   جابه‌جایی بین صفحه‌ها دیگر بنر را برنمی‌گرداند، ولی فردا که
 *   دوباره برنامه را باز کند یک‌بار (و فقط یک‌بار) پیشنهاد می‌بیند.
 */
export const INSTALL_SESSION_KEY = "tarazoo-install-shown-session";

/** پس از رد کردن، چند روز دوباره نپرسیم. */
export const DISMISS_DAYS = 30;

/**
 * تنها مسیری که پیشنهاد نصب خودکار در آن ظاهر می‌شود.
 *
 * خواسته‌ی صریح کاربر: «بهتره فقط تو صفحه داشبورد اونم نسخه موبایل
 * پیغام نصب برنامه بیاد». منطقی هم هست — کسی که وسط ثبت فاکتور است
 * نباید بنری روی نوار پایین ببیند.
 */
export const INSTALL_PROMPT_PATH = "/dashboard";

/** عرض حداکثری که «موبایل» حساب می‌شود (هم‌تراز با بریک‌پوینت lg تیلویند). */
export const MOBILE_MAX_WIDTH = 1023;

export type InstallMode =
  /** کروم/اج اندروید و دسکتاپ — رویداد نصب واقعی داریم. */
  | "prompt"
  /** سافاری iOS — رویدادی وجود ندارد؛ فقط می‌شود راهنما نشان داد. */
  | "ios-manual"
  /** مرورگر داخل اینستاگرام/تلگرام — نصب اصلاً ممکن نیست. */
  | "in-app-browser"
  /** از قبل نصب شده یا مرورگر پشتیبانی نمی‌کند. */
  | "unavailable";

/**
 * آیا برنامه همین حالا به‌صورت نصب‌شده اجرا می‌شود؟
 *
 * دو روش لازم است: اندروید و دسکتاپ از `display-mode: standalone`
 * استفاده می‌کنند، ولی سافاری iOS پرچم غیراستاندارد
 * `navigator.standalone` دارد.
 */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const displayMode =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone =
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return Boolean(displayMode || iosStandalone);
}

/**
 * تصمیم اینکه چه چیزی به کاربر نشان بدهیم.
 *
 * ⚠️ ترتیب شرط‌ها عمدی است:
 *   ۱. نصب‌شده → هیچ‌چیز (مهم‌ترین: کاربری که نصب کرده نباید باز
 *      هم دعوت به نصب ببیند)
 *   ۲. مرورگر درون‌برنامه‌ای → نصب ممکن نیست، حتی اگر iOS باشد
 *   ۳. رویداد نصب داریم → دکمه‌ی واقعی
 *   ۴. iOS → راهنمای دستی
 *   ۵. بقیه → هیچ‌چیز
 */
export function resolveInstallMode(input: {
  standalone: boolean;
  hasPrompt: boolean;
  ios: boolean;
  inAppBrowser: boolean;
}): InstallMode {
  if (input.standalone) return "unavailable";
  if (input.inAppBrowser) return "in-app-browser";
  if (input.hasPrompt) return "prompt";
  if (input.ios) return "ios-manual";
  return "unavailable";
}

/**
 * آیا کاربر اخیراً «بعداً» را زده است؟
 *
 * ورودی خراب (رشته‌ی بی‌معنا در localStorage) نباید باعث شود
 * برنامه بترکد یا برای همیشه پیشنهاد را پنهان کند.
 */
export function isDismissActive(raw: string | null, now: number = Date.now()): boolean {
  if (!raw) return false;
  const at = Number(raw);
  if (!Number.isFinite(at) || at <= 0) return false;
  // زمان آینده یعنی ساعت دستگاه عوض شده؛ محترم می‌شماریم ولی سقف می‌گذاریم.
  const elapsed = now - at;
  if (elapsed < 0) return true;
  return elapsed < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * آیا *بنر خودکار* باید نشان داده شود؟
 *
 * این تابع عمداً از `resolveInstallMode` جداست: آن یکی می‌گوید «نصب
 * از نظر فنی چطور ممکن است»، این یکی می‌گوید «آیا الان جای مزاحمت
 * کردن هست». دکمه‌ی دستی کنار زنگوله فقط به اولی نیاز دارد و همیشه
 * در دسترس است.
 *
 * چهار شرط، هرکدام از یک شکایت واقعی آمده:
 *   ۱. فقط داشبورد — نه وسط ثبت فاکتور
 *   ۲. فقط موبایل — روی دسکتاپ اپ نصب‌شده ارزش کمی دارد
 *   ۳. یک‌بار در هر نشست — پاسخ به «هربار که رفرش میشه نیازه پیغام بیاد؟»
 *   ۴. اگر «بعداً» زده، تا ۳۰ روز نه
 */
export function shouldAutoPrompt(input: {
  mode: InstallMode;
  pathname: string;
  viewportWidth: number;
  shownThisSession: boolean;
  dismissedRaw: string | null;
  now?: number;
}): boolean {
  if (input.mode !== "prompt" && input.mode !== "ios-manual") return false;
  if (input.pathname !== INSTALL_PROMPT_PATH) return false;
  if (input.viewportWidth > MOBILE_MAX_WIDTH) return false;
  if (input.shownThisSession) return false;
  if (isDismissActive(input.dismissedRaw, input.now ?? Date.now())) return false;
  return true;
}

/**
 * آیا دکمه‌ی دستی «نصب برنامه» (کنار زنگوله) معنا دارد؟
 *
 * برخلاف بنر، اینجا «بعداً» و نشست را نادیده می‌گیریم — کاربری که
 * خودش دنبال دکمه می‌گردد نباید به‌خاطر ردکردنِ سه هفته پیش محروم
 * شود. فقط وقتی پنهان می‌شود که نصب واقعاً ممکن نباشد (اپ از قبل
 * نصب است یا مرورگر درون‌برنامه‌ای).
 */
export function canOfferInstall(mode: InstallMode): boolean {
  return mode === "prompt" || mode === "ios-manual";
}

/** راهنمای نصب دستی روی iOS. */
export function iosInstallSteps(): string[] {
  return [
    /*
      🔴 از iOS 15 نوار نشانی سافاری **پایین** صفحه است، نه بالا.
      همان اشتباهی که در راهنمای میکروفون کردیم و کاربر دنبال دکمه‌ای
      در بالای صفحه می‌گشت که آنجا نبود.
    */
    "دکمه‌ی «هم‌رسانی» را در نوار پایین سافاری بزنید (مربع با فلش رو به بالا)",
    "در فهرست باز شده، «Add to Home Screen» یا «افزودن به صفحه اصلی» را انتخاب کنید",
    "روی «Add» بزنید — آیکون ترازو روی صفحه‌ی گوشی ظاهر می‌شود",
  ];
}
