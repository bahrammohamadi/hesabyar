import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  EVENT_META,
  eventMeta,
  isNoteworthy,
  maskIp,
  summarize,
  type LoginEvent,
} from "@/lib/security/login-history";

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

const NOW = new Date("2026-08-19T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString();

describe("برچسب رویدادها", () => {
  it("هر پنج نوع رویداد برچسب فارسی دارد", () => {
    for (const k of ["success", "failure", "throttled", "reset", "mfa_failure"] as const) {
      expect(EVENT_META[k].label.length).toBeGreaterThan(2);
      expect(EVENT_META[k].tone).toBeTruthy();
    }
  });

  /*
    نوع ناشناس نباید صفحه را بشکند: اگر روزی رویداد جدیدی به
    دیتابیس اضافه شود و اینجا فراموش شود، باید همان نام خام نشان
    داده شود نه undefined.
  */
  it("رویداد ناشناس خطا نمی‌دهد", () => {
    expect(eventMeta("something_new").label).toBe("something_new");
    expect(eventMeta("something_new").tone).toBe("info");
  });
});

describe("تشخیص رویداد قابل‌توجه", () => {
  it("تلاش ناموفق و مسدودی قابل‌توجه‌اند", () => {
    expect(isNoteworthy("failure")).toBe(true);
    expect(isNoteworthy("throttled")).toBe(true);
    expect(isNoteworthy("mfa_failure")).toBe(true);
  });

  /*
    🔴 مهم‌ترین قضاوت این فایل: ورود موفق هشدار **نیست**.

    کاربر روی گوشی و لپ‌تاپ و تبلت وارد می‌شود. اگر هر بار علامت
    قرمز ببیند، خیلی زود یاد می‌گیرد نادیده‌اش بگیرد — و آن‌وقت
    هشدار واقعی هم گم می‌شود.
  */
  it("ورود موفق و بازیابی هشدار نیستند", () => {
    expect(isNoteworthy("success")).toBe(false);
    expect(isNoteworthy("reset")).toBe(false);
  });
});

describe("خلاصه‌ی وضعیت", () => {
  const events: LoginEvent[] = [
    { event: "success", ip: "1.2.3.4", user_agent: null, created_at: hoursAgo(1) },
    { event: "failure", ip: "9.9.9.9", user_agent: null, created_at: hoursAgo(2) },
    { event: "failure", ip: "9.9.9.9", user_agent: null, created_at: hoursAgo(3) },
    { event: "success", ip: "5.6.7.8", user_agent: null, created_at: hoursAgo(30) },
    // خارج از پنجره‌ی ۲۴ ساعت
    { event: "failure", ip: "9.9.9.9", user_agent: null, created_at: hoursAgo(50) },
  ];

  /*
    🔴 چرا فقط ۲۴ ساعت؟ کاربری که سه ماه پیش رمزش را اشتباه زده
    مهم نیست. با شمردن کل تاریخچه، عدد همیشه بزرگ می‌ماند و
    بی‌معنا می‌شود.
  */
  it("فقط تلاش‌های ناموفق ۲۴ ساعت اخیر شمرده می‌شوند", () => {
    expect(summarize(events, NOW).recentFailures).toBe(2);
  });

  it("آخرین ورود موفق پیدا می‌شود", () => {
    expect(summarize(events, NOW).lastSuccessAt).toBe(hoursAgo(1));
  });

  it("نشانی‌های متفاوتِ ورود موفق شمرده می‌شوند", () => {
    // فقط ۱.۲.۳.۴ و ۵.۶.۷.۸ — نشانی تلاش ناموفق حساب نمی‌شود.
    expect(summarize(events, NOW).distinctIps).toBe(2);
  });

  it("فهرست خالی خطا نمی‌دهد", () => {
    const s = summarize([], NOW);
    expect(s.total).toBe(0);
    expect(s.recentFailures).toBe(0);
    expect(s.lastSuccessAt).toBeNull();
  });

  it("تاریخ خراب باعث خطا نمی‌شود", () => {
    const bad: LoginEvent[] = [
      { event: "failure", ip: null, user_agent: null, created_at: "قطعا-تاریخ-نیست" },
    ];
    expect(() => summarize(bad, NOW)).not.toThrow();
    expect(summarize(bad, NOW).recentFailures).toBe(0);
  });
});

describe("پوشاندن نشانی اینترنتی", () => {
  it("بخش پایانی IPv4 پوشانده می‌شود", () => {
    expect(maskIp("192.168.10.55")).toBe("192.168.10.···");
  });

  /*
    بدون پشتیبانی IPv6، آدرس‌های جدید خام نمایش داده می‌شدند —
    یعنی دقیقاً همان چیزی که می‌خواستیم بپوشانیم.
  */
  it("IPv6 هم پوشانده می‌شود", () => {
    const masked = maskIp("2001:0db8:85a3:0000:0000:8a2e:0370:7334");
    expect(masked).toBe("2001:0db8:···");
    expect(masked).not.toContain("7334");
  });

  it("نشانی خالی «نامشخص» می‌شود", () => {
    expect(maskIp(null)).toBe("نامشخص");
    expect(maskIp("")).toBe("نامشخص");
    expect(maskIp(undefined)).toBe("نامشخص");
  });

  it("ورودی نامعتبر دست‌نخورده برمی‌گردد نه خطا", () => {
    expect(maskIp("unknown")).toBe("unknown");
  });
});

describe("اتصال به رابط کاربری", () => {
  const api = readCode("app/api/account/login-history/route.ts");
  const ui = readCode("components/shared/login-history.tsx");
  const page = readCode("app/(app)/settings/account/page.tsx");
  const lib = readCode("lib/security/login-history.ts");

  /*
    🔴 کلاینت درخواست‌محور، نه service_role.
    تابع با auth.uid() فیلتر می‌کند؛ با کلید سرویس آن تهی است و
    تابع چیزی برنمی‌گرداند. این خودش یک لایه‌ی محافظت است.
  */
  it("سابقه با کلاینت کاربر خوانده می‌شود نه کلید سرویس", () => {
    expect(api).toMatch(/rpc\("my_login_history"/);
    expect(api).not.toMatch(/serviceClient\(\)/);
  });

  it("خطای دیتابیس بررسی می‌شود", () => {
    expect(api).toMatch(/if \(error\) \{[\s\S]{0,120}safeError/);
  });

  /*
    رشته‌ی خام User-Agent به کلاینت فرستاده نمی‌شود؛ فقط برچسب
    کوتاه که خواناست.
  */
  it("رشته‌ی خام User-Agent به کلاینت نمی‌رود", () => {
    expect(api).toMatch(/parseUserAgent/);
    expect(api).not.toMatch(/user_agent: e\.user_agent/);
  });

  it("محدودیت نرخ دارد", () => {
    expect(api).toMatch(/hit\(`login-history:/);
  });

  /*
    ⚠️ این فایل از کامپوننت کلاینت خوانده می‌شود، پس نباید هیچ
    وابستگی به node داشته باشد. همان درسی که با node:crypto گرفتیم.
  */
  it("منطق سابقه هیچ وابستگی به node ندارد", () => {
    expect(lib).not.toMatch(/from "node:/);
    expect(lib).not.toMatch(/require\(/);
  });

  it("کارت سابقه در صفحه‌ی حساب هست", () => {
    expect(page).toMatch(/<LoginHistory \/>/);
    expect(page).toMatch(/سابقه‌ی ورود/);
  });

  /*
    خانواده‌باگ تکرارشونده: `${توکن۱} · ${توکن۲}` در RTL اعداد را
    به هم می‌چسباند. راه‌حل: span جدا با جداکننده‌ی aria-hidden.
  */
  it("تاریخ و نشانی span جدا دارند", () => {
    expect(ui).toMatch(/aria-hidden="true">·</);
    expect(ui).toMatch(/tabular-nums">\{toJalali\(e\.created_at, true\)\}/);
  });

  it("نشانی پوشانده نمایش داده می‌شود نه خام", () => {
    expect(ui).toMatch(/maskIp\(e\.ip\)/);
    expect(ui).not.toMatch(/>\{e\.ip\}</);
  });
});

describe("🔴 باگ‌هایی که فقط اسکرین‌شات گرفت", () => {
  const sessions = readCode("components/shared/active-sessions.tsx");

  /*
    نشانی اینترنتی **خام** نمایش داده می‌شد: 31.171.101.138
    کارت «سابقه‌ی ورود» از همان اول می‌پوشاند ولی «دستگاه‌های
    واردشده» — که قدیمی‌تر است — جا مانده بود.

    ⚠️ در DOM هم خام بود، ولی هیچ تستی این را نمی‌پرسید. با نگاه
    کردن به تصویر پیدا شد.
  */
  it("نشانی نشست‌های فعال هم پوشانده می‌شود", () => {
    expect(sessions).toMatch(/maskIp\(s\.ip\)/);
    expect(sessions).not.toMatch(/\{s\.ip\}<\/span>/);
  });

  /*
    الگوی ` · ${توکن}` داخل یک رشته — همان خانواده‌باگ تکرارشونده:
    در RTL بازچینش می‌شود و اعداد به هم می‌چسبند.
  */
  it("تاریخ و نشانی نشست span جدا دارند", () => {
    expect(sessions).toMatch(/aria-hidden="true">·</);
    expect(sessions).not.toMatch(/> · \{s\.ip\}/);
  });

  /*
    هر دو کارت باید از یک تابع پوشاندن استفاده کنند، وگرنه دوباره
    از هم جدا می‌افتند.
  */
  it("هر دو کارت از همان تابع پوشاندن استفاده می‌کنند", () => {
    expect(sessions).toMatch(/from "@\/lib\/security\/login-history"/);
  });
});
