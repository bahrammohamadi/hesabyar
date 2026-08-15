import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  normalizeNotifications,
  unreadCount,
  resolvePushSupport,
  pushSupportMessage,
  urlBase64ToUint8Array,
  isImportantRelease,
  looksLikeVapidKey,
  NOTIFICATION_LABEL,
} from "@/lib/notifications";
import { RELEASES, unseenReleases, unseenAll } from "@/lib/changelog";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
/*
  ⚠️ تله‌ی تکراری: ادعاهای تست روی *توضیحات فارسی* گیر می‌کنند نه کد.
*/
const readCode = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^\s*(\/\/|--).*$/gm, "");

describe("🔴 زنگوله فقط نسخه‌های مهم را نشان می‌دهد", () => {
  /*
    خواسته‌ی کاربر: «نیازی نیست همه آپدیت‌ها بیاد تو نوتیفیکیشن بار».
    شمارش واقعی پیش از اصلاح: ۲۷ نسخه با ۱۰۹ تغییر، ۳۴ تای آن رفع
    اشکال جزئی.
  */
  it("تعداد نسخه‌های مهم بسیار کمتر از کل است", () => {
    const important = RELEASES.filter((r) => r.important === true);
    expect(important.length).toBeGreaterThan(0);
    // اگر روزی نصف نسخه‌ها مهم شدند، دوباره به همان انباشت برگشته‌ایم.
    expect(important.length).toBeLessThan(RELEASES.length / 3);
  });

  it("unseenReleases فقط مهم‌ها را برمی‌گرداند", () => {
    const out = unseenReleases(null);
    expect(out.every((r) => r.important === true)).toBe(true);
  });

  it("unseenAll همه را می‌دهد تا در تاریخچه گم نشوند", () => {
    // کاربر باید بتواند جایی همه‌ی تغییرات را ببیند.
    const last = RELEASES[5]?.version ?? null;
    expect(unseenAll(last).length).toBeGreaterThanOrEqual(unseenReleases(last).length);
  });

  it("🔴 پیش‌فرض important نبودن است", () => {
    /*
      عمدی: هر نسخه‌ی جدید باید صریحاً مهم علامت بخورد، وگرنه
      فراموش‌کاری دوباره زنگوله را پر می‌کند.
    */
    expect(isImportantRelease({})).toBe(false);
    expect(isImportantRelease({ important: false })).toBe(false);
    expect(isImportantRelease({ important: true })).toBe(true);
  });

  it("زنگوله از فهرست فیلترشده استفاده می‌کند نه RELEASES خام", () => {
    const bell = readCode("components/shared/notification-bell.tsx");
    expect(bell).toContain("IMPORTANT_RELEASES");
    expect(bell).not.toContain("{RELEASES.map((release)");
  });
});

describe("اعلان‌های کسب‌وکار", () => {
  it("ورودی خراب صفحه را نمی‌شکند", () => {
    expect(normalizeNotifications(null)).toEqual([]);
    expect(normalizeNotifications("x")).toEqual([]);
    expect(normalizeNotifications({})).toEqual([]);
  });

  it("ردیف بدون id دور ریخته می‌شود", () => {
    const out = normalizeNotifications([{ id: "a" }, { title: "بی‌شناسه" }, null]);
    expect(out).toHaveLength(1);
  });

  it("شمار خوانده‌نشده درست است", () => {
    const list = normalizeNotifications([
      { id: "1", read_at: null },
      { id: "2", read_at: "2026-01-01" },
      { id: "3", read_at: null },
    ]);
    expect(unreadCount(list)).toBe(2);
  });

  it("هر نوع اعلان برچسب فارسی دارد", () => {
    for (const [, label] of Object.entries(NOTIFICATION_LABEL)) {
      expect(label.length).toBeGreaterThan(0);
      // بدون رقم یا حرف لاتین
      expect(label).not.toMatch(/[A-Za-z0-9]/);
    }
  });

  it("در زنگوله بالای یادداشت انتشار می‌آید", () => {
    const bell = readCode("components/shared/notification-bell.tsx");
    const bizAt = bell.indexOf("bizNotifs ?? []).map");
    const relAt = bell.indexOf("IMPORTANT_RELEASES.map");
    expect(bizAt).toBeGreaterThan(-1);
    expect(relAt).toBeGreaterThan(-1);
    expect(bizAt).toBeLessThan(relAt);
  });
});

describe("🔴 پشتیبانی پوش — تله‌ی iOS", () => {
  const base = {
    hasServiceWorker: true,
    hasPushManager: true,
    hasNotification: true,
    permission: "default" as const,
    ios: false,
    standalone: false,
  };

  it("اندروید/دسکتاپ آماده است", () => {
    expect(resolvePushSupport(base)).toBe("ready");
  });

  it("🔴 آیفونِ نصب‌نشده راهنمای نصب می‌گیرد نه دکمه", () => {
    /*
      پوش وب روی آیفون فقط از iOS 16.4 و **فقط** وقتی برنامه از
      صفحه‌ی اصلی باز شده باشد کار می‌کند. در تب سافاری PushManager
      اصلاً وجود ندارد.

      دکمه‌ای که بزنند و کار نکند بدتر از نبودنش است — درسی که از
      دکمه‌ی ورود صوتی گرفتیم.
    */
    expect(resolvePushSupport({ ...base, ios: true, standalone: false })).toBe(
      "ios-needs-install"
    );
  });

  it("آیفونِ نصب‌شده مثل بقیه است", () => {
    expect(resolvePushSupport({ ...base, ios: true, standalone: true })).toBe("ready");
  });

  it("🔴 iOS حتی با API موجود هم رد می‌شود", () => {
    // ترتیب شرط‌ها مهم است: iOS پیش از بررسی API چک می‌شود.
    expect(
      resolvePushSupport({
        ...base,
        ios: true,
        standalone: false,
        hasPushManager: true,
        permission: "granted",
      })
    ).toBe("ios-needs-install");
  });

  it("مرورگر بدون API پشتیبانی نمی‌شود", () => {
    expect(resolvePushSupport({ ...base, hasPushManager: false })).toBe("unsupported");
    expect(resolvePushSupport({ ...base, hasServiceWorker: false })).toBe("unsupported");
    expect(resolvePushSupport({ ...base, hasNotification: false })).toBe("unsupported");
  });

  it("رد شده و فعال از هم تفکیک می‌شوند", () => {
    expect(resolvePushSupport({ ...base, permission: "denied" })).toBe("denied");
    expect(resolvePushSupport({ ...base, permission: "granted" })).toBe("granted");
  });

  it("هر وضعیت پیام فارسی روشن دارد", () => {
    for (const s of ["ready", "ios-needs-install", "unsupported", "denied", "granted"] as const) {
      const msg = pushSupportMessage(s);
      expect(msg.length).toBeGreaterThan(10);
      expect(msg).not.toMatch(/[A-Za-z]{4,}/);
    }
  });
});

describe("🔴 تبدیل کلید VAPID", () => {
  it("base64url را درست می‌خواند", () => {
    /*
      base64url با base64 استاندارد فرق دارد: `-` و `_` به‌جای `+` و
      `/`، بدون padding. بدون تبدیل، subscribe با خطای مبهم
      InvalidCharacterError شکست می‌خورد.
    */
    const out = urlBase64ToUint8Array("aGVsbG8");
    expect(new TextDecoder().decode(out)).toBe("hello");
  });

  it("نویسه‌های خاص base64url مدیریت می‌شوند", () => {
    /*
      ⚠️ تست اول خودم اشتباه بود: «a-b_c» با ۵ نویسه اصلاً base64
      معتبر نیست و هر پیاده‌سازی درستی هم رویش استثنا می‌دهد.
      ادعای واقعی این است که `-` و `_` به `+` و `/` تبدیل شوند.

      «a-b_» چهار نویسه و معتبر است؛ اگر تبدیل انجام نشود atob
      استثنا می‌دهد.
    */
    expect(() => urlBase64ToUint8Array("a-b_")).not.toThrow();
    const withDash = urlBase64ToUint8Array("a-b_");
    const withPlus = urlBase64ToUint8Array("a+b/");
    expect(Array.from(withDash)).toEqual(Array.from(withPlus));
  });

  it("کلید واقعی VAPID طول درست می‌دهد", () => {
    // کلید عمومی VAPID همیشه ۶۵ بایت است (فرمت uncompressed P-256).
    const real =
      "BNefjLWpVzlv9oBrV0AZOFXyZOWe3JdHslZw7Ohc2mSnhGFTXZb0zdscBMk1QckitiyDxryuxvbMT9OyM8EJBJw";
    expect(urlBase64ToUint8Array(real).length).toBe(65);
  });
});

describe("🔴 اعتبارسنجی کلید VAPID", () => {
  /*
    باگ واقعی: کلید عمومی را در Vercel به‌صورت `encrypted` ثبت کردم.
    NEXT_PUBLIC_* در باندل کلاینت می‌نشیند و Vercel مقدار رمزشده
    (`eyJ2IjoidjIi…`) را جای کلید گذاشت. subscribe بی‌صدا شکست
    می‌خورد بدون هیچ پیامی.
  */
  it("کلید واقعی پذیرفته می‌شود", () => {
    expect(
      looksLikeVapidKey(
        "BNefjLWpVzlv9oBrV0AZOFXyZOWe3JdHslZw7Ohc2mSnhGFTXZb0zdscBMk1QckitiyDxryuxvbMT9OyM8EJBJw"
      )
    ).toBe(true);
  });

  it("🔴 مقدار رمزشده‌ی Vercel رد می‌شود", () => {
    expect(looksLikeVapidKey("eyJ2IjoidjIiLCJjIjoiZ3hhWCsydys4QlpiZExJT1BlSzBNS2")).toBe(false);
  });

  it("خالی و کوتاه رد می‌شوند", () => {
    expect(looksLikeVapidKey(undefined)).toBe(false);
    expect(looksLikeVapidKey("")).toBe(false);
    expect(looksLikeVapidKey("abc")).toBe(false);
  });

  it("پیش از subscribe بررسی می‌شود", () => {
    const t = readCode("components/shared/push-toggle.tsx");
    expect(t).toContain("looksLikeVapidKey(key)");
    expect(t.indexOf("looksLikeVapidKey")).toBeLessThan(t.indexOf("pushManager.subscribe"));
  });
});

describe("مهاجرت ۰۰۴۵", () => {
  const sql = readCode("supabase/migrations/0045_notifications.sql");

  it("🔴 تکرار اعلان با ایندکس یکتا جلوگیری می‌شود", () => {
    /*
      بدون این، هر بار باز کردن داشبورد یک اعلان تکراری می‌ساخت و
      زنگوله ظرف یک هفته صد ردیف «چک فردا سررسید می‌شود» داشت —
      دقیقاً همان مشکلی که می‌خواهیم حلش کنیم.
    */
    expect(sql).toContain("uq_notifications_dedupe");
    expect(sql).toContain("on conflict (org_id, dedupe_key)");
  });

  it("🔴 کاربر عادی نمی‌تواند اعلان بسازد", () => {
    // وگرنه هر کسی می‌توانست اعلان جعلی به همکارانش بفرستد.
    expect(sql).not.toMatch(/create policy[^;]*notifications[^;]*for insert/);
    expect(sql).toContain(
      "revoke all on function public.push_notification(uuid, text, text, text, text, text, text, uuid) from public, anon, authenticated"
    );
  });

  it("RLS اعلان‌ها هم سازمان و هم کاربر را چک می‌کند", () => {
    expect(sql).toContain("org_id in (select public.user_org_ids())");
    expect(sql).toContain("(user_id is null or user_id = auth.uid())");
  });

  it("اشتراک پوش فقط مال خود کاربر است", () => {
    expect(sql).toMatch(/push_own_all[\s\S]*?using \(user_id = auth\.uid\(\)\)/);
  });

  it("🔴 بدهی زیر سی روز اعلان نمی‌گیرد", () => {
    /*
      درس «موجودی کم» با ۳۶۱ مورد: هشداری که همه‌چیز را علامت بزند،
      نویز است. نسیه‌ی ۱۰ روزه عادی است نه مشکل.
    */
    expect(sql).toContain("now() - interval '30 days'");
  });

  it("🔴 مبلغ در متن اعلان ارقام فارسی دارد", () => {
    /*
      to_char ارقام لاتین می‌سازد و متن اعلان مستقیم به کاربر می‌رسد —
      در زنگوله و در پوش دستگاه که هیچ لایه‌ی نمایشی برای تبدیل ندارد.
      «500,000 تومان» وسط جمله‌ی فارسی هم زشت است هم با bidi جابه‌جا
      می‌شود. از روی اسکرین‌شات پیدا شد، نه تست.
    */
    expect(sql).toContain("public.fa_amount");
    expect(sql).toContain("'۰۱۲۳۴۵۶۷۸۹'");
    // هیچ to_char خامی روی مبلغ نماند
    expect(sql).not.toMatch(/to_char\(r\.(amount|paid_credit)/);
  });

  it("یادآوری بدهی هفتگی است نه روزانه", () => {
    // بدهی ۶۰ روزه هر روز یادآوری لازم ندارد.
    expect(sql).toContain("IYYY-IW");
  });

  it("هر کوئری سقف تعداد دارد", () => {
    const limits = sql.match(/limit 20/g) ?? [];
    expect(limits.length).toBeGreaterThanOrEqual(4);
  });

  it("تابع تولید، عضویت سازمان را چک می‌کند", () => {
    expect(sql).toContain("دسترسی غیرمجاز");
  });
});

describe("سرویس‌ورکر — دریافت پوش", () => {
  const sw = readCode("public/sw.js");

  it("رویداد push را می‌گیرد", () => {
    expect(sw).toContain('self.addEventListener("push"');
    expect(sw).toContain("showNotification");
  });

  it("🔴 waitUntil استفاده می‌شود", () => {
    /*
      بدون آن مرورگر ممکن است سرویس‌ورکر را پیش از نمایش اعلان
      بخواباند و پیام گم شود — یا کروم اعلان بی‌ربط
      «This site has been updated in the background» را نشان دهد.
    */
    expect(sw).toMatch(/event\.waitUntil\(self\.registration\.showNotification/);
  });

  it("payload خراب کل اعلان را از بین نمی‌برد", () => {
    expect(sw).toContain("catch");
  });

  it("کلیک، پنجره‌ی باز را جلو می‌آورد نه تب جدید", () => {
    expect(sw).toContain('self.addEventListener("notificationclick"');
    expect(sw).toContain("clients.matchAll");
    expect(sw).toContain("client.focus()");
  });

  it("اعلان راست‌به‌چپ و فارسی است", () => {
    expect(sw).toContain('dir: "rtl"');
    expect(sw).toContain('lang: "fa"');
  });
});

describe("مسیر API پوش", () => {
  const route = readCode("app/api/push/route.ts");

  it("🔴 فقط نام‌های مجاز export می‌شوند", () => {
    /*
      route.ts فقط GET/POST/PUT/DELETE/dynamic/runtime/… را می‌پذیرد.
      هر export دیگر `next build` را می‌شکند در حالی که tsc تمیز رد
      می‌کند — این تله را یک بار خورده‌ایم.
    */
    const exports = [...route.matchAll(/export (?:async )?(?:function|const) (\w+)/g)].map(
      (m) => m[1]
    );
    const allowed = ["GET", "POST", "PUT", "DELETE", "PATCH", "dynamic", "runtime", "revalidate", "maxDuration"];
    for (const e of exports) expect(allowed, `export غیرمجاز: ${e}`).toContain(e);
  });

  it("بدون احراز هویت رد می‌شود", () => {
    const guards = route.match(/if \(!auth\.user\)/g) ?? [];
    expect(guards.length).toBe(3);
  });

  it("🔴 حذف اشتراک فقط برای صاحبش", () => {
    // بدون این، هر کسی می‌توانست اشتراک دیگری را با endpoint حذف کند.
    expect(route).toContain('.eq("user_id", auth.user.id)');
  });

  it("اشتراک مرده پاک می‌شود", () => {
    // ۴۰۴/۴۱۰ یعنی کاربر اپ را حذف کرده؛ نگه‌داشتنش خطای بی‌فایده می‌سازد.
    expect(route).toContain("code === 404 || code === 410");
  });

  it("نبود کلید VAPID خطای روشن می‌دهد نه کرش", () => {
    expect(route).toContain("کلیدهای پوش تنظیم نشده‌اند");
  });
});

describe("رابط فعال‌سازی پوش", () => {
  const toggle = readCode("components/shared/push-toggle.tsx");

  it("در تنظیمات رندر می‌شود", () => {
    expect(readCode("app/(app)/settings/general/page.tsx")).toContain("<PushToggle />");
  });

  it("🔴 روی آیفون نصب‌نشده دکمه نشان نمی‌دهد", () => {
    // فقط برای ready و granted دکمه رندر می‌شود.
    expect(toggle).toContain('support === "ready" || support === "granted"');
    expect(toggle).toContain('support === "ios-needs-install"');
  });

  it("راهنمای iOS نوار پایین را می‌گوید نه بالا", () => {
    // از iOS 15 نوار نشانی سافاری پایین صفحه است.
    expect(toggle).toContain("نوار پایین");
    expect(toggle).not.toContain("بالای صفحه");
  });

  it("userVisibleOnly اجباری است", () => {
    // مرورگرها silent push را رد می‌کنند.
    expect(toggle).toContain("userVisibleOnly: true");
  });

  it("🔴 اعلان تولید می‌شود و RPC واقعاً اجرا می‌شود", () => {
    /*
      تله‌ی شناخته‌شده که دوباره خوردم: سازنده‌ی کوئری Supabase یک
      thenable **تنبل** است. `void supabase.rpc(...)` هیچ درخواستی
      نمی‌فرستد — نه خطا می‌دهد، نه چیزی در تب شبکه می‌آید، فقط
      جدول خالی می‌ماند.

      باید `.then(...)` یا `await` داشته باشد.
    */
    const dash = readCode("app/(app)/dashboard/page.tsx");
    expect(dash).toContain('rpc("generate_business_notifications"');
    expect(dash).not.toMatch(/void supabase\s*\.?\s*rpc\("generate_business_notifications"/);
    const at = dash.indexOf('rpc("generate_business_notifications"');
    expect(dash.slice(at, at + 200)).toContain(".then(");
  });

  it("هیچ کلاس پالت خام یا hex ندارد", () => {
    expect(toggle).not.toMatch(
      /\b(?:bg|text|border)-(?:white|black|slate|rose|emerald|sky|amber|zinc|gray|red|green|blue)(?:\/|-)/
    );
    expect(toggle).not.toMatch(/#[0-9a-fA-F]{6}\b/);
  });
});
