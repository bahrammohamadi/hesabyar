import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  shouldAutoPrompt,
  canOfferInstall,
  INSTALL_PROMPT_PATH,
  INSTALL_SESSION_KEY,
  MOBILE_MAX_WIDTH,
  DISMISS_DAYS,
} from "@/lib/pwa";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
/*
  ⚠️ تله‌ی تکراری: ادعاهای تست روی *توضیحات فارسی* گیر می‌کنند نه کد.
  کامنت‌ها قبل از هر جستجو حذف می‌شوند.
*/
const readCode = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*(\/\/|--).*$/gm, "");

const DAY = 24 * 60 * 60 * 1000;

/** حالت پایه‌ای که همه‌ی شرط‌ها را پاس می‌کند؛ تست‌ها فقط یک چیز را خراب می‌کنند. */
const ok = {
  mode: "prompt" as const,
  pathname: "/dashboard",
  viewportWidth: 390,
  shownThisSession: false,
  dismissedRaw: null,
};

describe("🔴 بنر نصب فقط در داشبورد موبایل و یک‌بار", () => {
  it("در شرایط پایه نشان داده می‌شود", () => {
    expect(shouldAutoPrompt(ok)).toBe(true);
  });

  it("🔴 در صفحه‌های غیر داشبورد نشان داده نمی‌شود", () => {
    /*
      شکایت کاربر: بنر وسط ثبت فاکتور روی نوار پایین می‌نشست.
      خواسته‌ی صریح: «فقط تو صفحه داشبورد».
    */
    expect(shouldAutoPrompt({ ...ok, pathname: "/sales" })).toBe(false);
    expect(shouldAutoPrompt({ ...ok, pathname: "/products" })).toBe(false);
    expect(shouldAutoPrompt({ ...ok, pathname: "/dashboard/x" })).toBe(false);
  });

  it("🔴 روی دسکتاپ نشان داده نمی‌شود", () => {
    expect(shouldAutoPrompt({ ...ok, viewportWidth: 1440 })).toBe(false);
    expect(shouldAutoPrompt({ ...ok, viewportWidth: MOBILE_MAX_WIDTH + 1 })).toBe(false);
    // درست روی مرز، هنوز موبایل حساب می‌شود.
    expect(shouldAutoPrompt({ ...ok, viewportWidth: MOBILE_MAX_WIDTH })).toBe(true);
  });

  it("🔴 با رفرش دوباره نمی‌آید — پاسخ مستقیم به سؤال کاربر", () => {
    /*
      «هربار که صفحه رفرش میشه نیازه که پیغام نصب بیادش؟» — نه.
      پرچم نشست، دقیقاً همین را می‌بندد.
    */
    expect(shouldAutoPrompt({ ...ok, shownThisSession: true })).toBe(false);
  });

  it("پس از «بعداً» تا سی روز نمی‌آید، بعدش می‌آید", () => {
    const now = Date.now();
    expect(shouldAutoPrompt({ ...ok, dismissedRaw: String(now - 5 * DAY), now })).toBe(false);
    expect(
      shouldAutoPrompt({ ...ok, dismissedRaw: String(now - (DISMISS_DAYS + 1) * DAY), now })
    ).toBe(true);
  });

  it("در حالت‌هایی که نصب ممکن نیست نمی‌آید", () => {
    expect(shouldAutoPrompt({ ...ok, mode: "in-app-browser" })).toBe(false);
    expect(shouldAutoPrompt({ ...ok, mode: "unavailable" })).toBe(false);
    // iOS راهنمای دستی دارد، پس مجاز است.
    expect(shouldAutoPrompt({ ...ok, mode: "ios-manual" })).toBe(true);
  });
});

describe("دکمه‌ی دائمی نصب کنار زنگوله", () => {
  it("قوانین بنر را ارث نمی‌برد", () => {
    /*
      کاربری که خودش دنبال دکمه می‌گردد نباید به‌خاطر «بعداً»ی سه
      هفته پیش یا اینکه در صفحه‌ی فروش است محروم شود.
    */
    expect(canOfferInstall("prompt")).toBe(true);
    expect(canOfferInstall("ios-manual")).toBe(true);
  });

  it("وقتی نصب ممکن نیست اصلاً رندر نمی‌شود", () => {
    expect(canOfferInstall("unavailable")).toBe(false);
    expect(canOfferInstall("in-app-browser")).toBe(false);
    const btn = readCode("components/shared/install-button.tsx");
    expect(btn).toContain("if (!ready || !canOfferInstall(mode)) return null");
    // دکمه‌ی غیرفعالِ بی‌توضیح ممنوع — یا هست و کار می‌کند، یا نیست.
    expect(btn).not.toContain("disabled");
  });

  it("در هدر کنار زنگوله قرار گرفته", () => {
    const header = readCode("components/shared/header.tsx");
    expect(header).toContain("<InstallButton />");
    const btnAt = header.indexOf("<InstallButton />");
    const bellAt = header.indexOf("<NotificationBell />");
    expect(btnAt).toBeGreaterThan(-1);
    expect(bellAt).toBeGreaterThan(-1);
    // فاصله‌ی کم یعنی واقعاً کنار هم‌اند نه در دو گوشه‌ی هدر.
    expect(Math.abs(btnAt - bellAt)).toBeLessThan(200);
  });

  it("برچسب دسترس‌پذیری دارد چون در موبایل فقط آیکون است", () => {
    expect(readCode("components/shared/install-button.tsx")).toContain(
      'aria-label="نصب برنامه روی دستگاه"'
    );
  });
});

describe("🔴 رویداد نصب یک‌بار شلیک می‌شود — باید مشترک باشد", () => {
  /*
    beforeinstallprompt در کل عمر صفحه یک‌بار می‌آید. اگر هر کامپوننت
    جدا گوش بدهد، آنکه دیرتر mount شود آن را از دست می‌دهد و دکمه‌اش
    بی‌اثر می‌ماند — «دکمه‌ای که وعده می‌دهد و عمل نمی‌کند».
  */
  const store = readCode("components/shared/install-store.ts");

  it("شنونده در سطح ماژول ثبت می‌شود نه داخل کامپوننت", () => {
    expect(store).toContain('window.addEventListener("beforeinstallprompt"');
    // خارج از هر تابع React: قبل از اولین export تابعِ hook می‌آید.
    expect(store.indexOf('addEventListener("beforeinstallprompt"')).toBeLessThan(
      store.indexOf("export function useInstallState")
    );
  });

  it("هیچ‌کدام از دو مصرف‌کننده مستقیماً گوش نمی‌دهد", () => {
    expect(readCode("components/shared/install-prompt.tsx")).not.toContain(
      "beforeinstallprompt"
    );
    expect(readCode("components/shared/install-button.tsx")).not.toContain(
      "beforeinstallprompt"
    );
  });

  it("رویداد پس از استفاده دور ریخته می‌شود", () => {
    // یک‌بارمصرف است؛ نگه‌داشتنش دکمه را ظاهراً فعال ولی بی‌اثر می‌کند.
    expect(store).toContain("deferredPrompt = null");
  });
});

describe("بنر — پیاده‌سازی", () => {
  const page = readCode("components/shared/install-prompt.tsx");

  it("از تابع خالص تصمیم‌گیری استفاده می‌کند نه شرط‌های پراکنده", () => {
    expect(page).toContain("shouldAutoPrompt(");
  });

  it("🔴 پیش از نمایش، پرچم نشست را می‌گذارد نه هنگام بستن", () => {
    /*
      اگر منتظر بستن بمانیم، کاربری که بنر را نادیده می‌گیرد و رفرش
      می‌کند دوباره همان را می‌بیند — یعنی همان باگ گزارش‌شده.
    */
    const setAt = page.indexOf("sessionStorage.setItem(INSTALL_SESSION_KEY");
    const openAt = page.indexOf("setOpen(true)");
    expect(setAt).toBeGreaterThan(-1);
    expect(openAt).toBeGreaterThan(-1);
    expect(setAt).toBeLessThan(openAt);
  });

  it("مسیر و کلیدها ثابت‌اند", () => {
    expect(INSTALL_PROMPT_PATH).toBe("/dashboard");
    expect(INSTALL_SESSION_KEY).toBe("tarazoo-install-shown-session");
  });

  it("کلاس lg: برای دسکتاپ ندارد چون اصلاً روی دسکتاپ نمی‌آید", () => {
    // بقایای چیدمان دسکتاپ در بنری که فقط موبایلی است، کد مرده است.
    const banner = page.slice(page.indexOf('role="dialog"'));
    expect(banner).not.toContain("lg:bottom-4");
  });
});
