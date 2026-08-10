/**
 * منطق خالص نصب اپ (PWA).
 *
 * در `.ts` جداست تا Vitest بتواند بخواندش — تشخیص پلتفرم و تصمیم
 * «چه راهنمایی نشان بدهیم» دقیقاً همان چیزی است که باید تست شود،
 * چون روی هر مرورگر متفاوت است و اشتباهش یعنی کاربر گیر می‌کند.
 */

/** کلید یادآوریِ «بعداً» در مرورگر کاربر. */
export const INSTALL_DISMISS_KEY = "tarazoo-install-dismissed";

/** پس از رد کردن، چند روز دوباره نپرسیم. */
export const DISMISS_DAYS = 30;

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
