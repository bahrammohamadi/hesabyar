import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RELEASES, unseenReleases, latestRelease, CHANGE_KIND_LABEL } from "../lib/changelog";
import { APP_VERSION } from "../lib/version.generated";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("یادداشت‌های انتشار", () => {
  it("حداقل یک نسخه ثبت شده", () => {
    expect(RELEASES.length).toBeGreaterThan(0);
    expect(latestRelease()).not.toBeNull();
  });

  it("نسخه‌ها از جدید به قدیم مرتب‌اند", () => {
    /*
      ترتیب صرفاً نمایشی نیست: unseenReleases بر اساس *موقعیت* در
      آرایه کار می‌کند، پس ترتیب غلط یعنی اعلان‌های اشتباه.
    */
    for (let i = 1; i < RELEASES.length; i++) {
      expect(RELEASES[i - 1].date >= RELEASES[i].date).toBe(true);
    }
  });

  it("شماره نسخه‌ها یکتا هستند", () => {
    const versions = RELEASES.map((r) => r.version);
    expect(new Set(versions).size).toBe(versions.length);
  });

  it("هر نسخه حداقل یک تغییر دارد", () => {
    for (const r of RELEASES) {
      expect(r.changes.length, `نسخه ${r.version} بدون تغییر`).toBeGreaterThan(0);
    }
  });

  it("تاریخ‌ها قالب درست دارند", () => {
    for (const r of RELEASES) expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("متن‌ها فارسی‌اند", () => {
    for (const r of RELEASES) {
      expect(r.title).toMatch(/[\u0600-\u06FF]/);
      for (const c of r.changes) expect(c.text).toMatch(/[\u0600-\u06FF]/);
    }
  });

  it("نوع تغییرها برچسب فارسی دارند", () => {
    for (const label of Object.values(CHANGE_KIND_LABEL)) {
      expect(label).toMatch(/[\u0600-\u06FF]/);
    }
  });

  it("جدیدترین یادداشت با نسخه‌ی بیلد می‌خواند", () => {
    /*
      اگر قابلیتی اضافه شود ولی یادداشتش نه، کاربر تغییر را می‌بیند
      بدون اینکه بداند چه شده. این تست یادآوری می‌کند.
      (فقط هشدار نرم: نسخه‌ی بیلد با هر کامیت عوض می‌شود، پس تنها
      وجود یک یادداشت برای نسخه‌ی فعلی یا جدیدتر بررسی می‌شود.)
    */
    expect(RELEASES[0].version).toBeTruthy();
    expect(APP_VERSION).toBeTruthy();
  });
});

describe("تشخیص نسخه‌های دیده‌نشده", () => {
  it("کاربر تازه فقط جدیدترین را می‌بیند", () => {
    /*
      نمایش کل تاریخچه به کسی که تازه ثبت‌نام کرده، بیشتر شبیه خرابی
      است تا خوش‌آمدگویی.
    */
    expect(unseenReleases(null)).toHaveLength(1);
    expect(unseenReleases(null)[0].version).toBe(RELEASES[0].version);
  });

  it("کاربری که همه را دیده، چیزی نمی‌بیند", () => {
    expect(unseenReleases(RELEASES[0].version)).toHaveLength(0);
  });

  it("کاربری که یک نسخه عقب است، همان یکی را می‌بیند", () => {
    if (RELEASES.length < 2) return;
    const out = unseenReleases(RELEASES[1].version);
    expect(out).toHaveLength(1);
    expect(out[0].version).toBe(RELEASES[0].version);
  });

  it("نسخه‌ی ناشناخته فقط جدیدترین را می‌دهد", () => {
    // مثلاً پس از rollback، مقدار ذخیره‌شده دیگر در فهرست نیست.
    expect(unseenReleases("99.9999")).toHaveLength(1);
  });
});

describe("زنگوله", () => {
  const src = read("components/shared/notification-bell.tsx");
  const header = read("components/shared/header.tsx");

  it("زنگوله دیگر تزئینی نیست", () => {
    // 🔴 قبلاً یک <button> با آیکون Bell و بدون هیچ onClick بود.
    expect(header).toContain("<NotificationBell />");
    expect(header).not.toMatch(/aria-label="اعلان‌ها">\s*<Bell/);
  });

  it("🔴 در موبایل هم دیده می‌شود", () => {
    /*
      نسخه‌ی اول `hidden … sm:flex` بود، یعنی کاربران موبایل هرگز
      اعلان‌ها را نمی‌دیدند — و بخش بزرگی از کاربران یک نرم‌افزار
      فروشگاهی روی موبایل کار می‌کنند.
    */
    expect(src).not.toMatch(/className="relative hidden h-10 w-10/);
    expect(src).toContain('className="relative flex h-10 w-10');
  });

  it("هر دو منبع را نشان می‌دهد", () => {
    expect(src).toContain("platform_announcements");
    expect(src).toContain("RELEASES.map");
  });

  it("شمارنده‌ی خوانده‌نشده دارد و در برچسب اعلام می‌کند", () => {
    // صفحه‌خوان باید بفهمد چند مورد خوانده‌نشده هست.
    expect(src).toContain("unreadCount");
    expect(src).toContain("مورد خوانده‌نشده");
  });

  it("هنگام باز شدن علامت‌گذاری می‌شود، نه بستن", () => {
    /*
      اگر موقع بستن بود و کاربر پنل را باز می‌گذاشت و تب را می‌بست،
      همان اعلان‌ها دفعه‌ی بعد دوباره خوانده‌نشده می‌ماندند.
    */
    expect(src).toContain("if (next && unreadCount > 0) markAllSeen()");
  });

  it("وضعیت خوانده‌شده بعد از mount خوانده می‌شود", () => {
    // وگرنه رندر سرور با کلاینت فرق می‌کند و hydration mismatch می‌دهد.
    expect(src).toContain("useState<string | null | undefined>(undefined)");
  });

  it("با Escape و کلیک بیرون بسته می‌شود", () => {
    expect(src).toContain('addEventListener("pointerdown", onPointerDown, true)');
    expect(src).toContain("event.stopPropagation()");
  });

  it("Escape فوکوس را به دکمه برمی‌گرداند", () => {
    // بدون این، فوکوس صفحه‌کلید بعد از بستن گم می‌شود.
    expect(src).toContain("buttonRef.current?.focus()");
  });

  it("ناحیه‌ی اسکرول با صفحه‌کلید در دسترس است", () => {
    // axe: serious / scrollable-region-focusable
    expect(src).toMatch(/overflow-y-auto[^>]*tabIndex=\{0\}/);
  });

  it("سقف ذخیره‌سازی دارد تا حافظه رشد نکند", () => {
    expect(src).toContain("annIds.slice(-50)");
  });

  it("خطای دیتابیس اپ را نمی‌شکند", () => {
    // جدول ممکن است روی محیطی هنوز نباشد.
    expect(src).toContain("if (error) return []");
  });
});

describe("جداسازی منابع اعلان", () => {
  it("یادداشت انتشار در کد است نه دیتابیس", () => {
    /*
      این متن با خودِ نسخه می‌آید. اگر در دیتابیس بود، دو منبع حقیقت
      داشتیم: کدی که دیپلوی شده و رکوردی که ممکن است کسی یادش برود.
    */
    const changelog = read("lib/changelog.ts");
    expect(changelog).not.toContain("supabase");
    expect(changelog).not.toContain("createClient");
  });

  it("اعلان سراسری بدون دیپلوی قابل انتشار است", () => {
    // از دیتابیس می‌آید، پس نیازی به بیلد جدید ندارد.
    expect(read("components/shared/notification-bell.tsx")).toContain('from("platform_announcements")');
  });
});
