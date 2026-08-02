import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  normalizePersian,
  parseUtterance,
  rankMatches,
  similarity,
  MATCH_THRESHOLD,
} from "../lib/voice-order";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("یکدست‌سازی متن فارسی", () => {
  it("نویسه‌های عربی را فارسی می‌کند", () => {
    // تشخیص گفتار گاهی ي و ك عربی برمی‌گرداند.
    expect(normalizePersian("كيف")).toBe("کیف");
    expect(normalizePersian("شلوار جين")).toBe("شلوار جین");
  });

  it("نیم‌فاصله و اعراب و ارقام را یکدست می‌کند", () => {
    expect(normalizePersian("می‌خوام")).toBe("می خوام");
    expect(normalizePersian("۳ عدد")).toBe("3 عدد");
  });
});

describe("استخراج تعداد و نام کالا", () => {
  it("عدد حروفی و رقمی را می‌فهمد", () => {
    expect(parseUtterance("سه عدد شومیز").qty).toBe(3);
    expect(parseUtterance("3 عدد شومیز").qty).toBe(3);
    expect(parseUtterance("۳ عدد شومیز").qty).toBe(3);
    expect(parseUtterance("دوازده تا کیف").qty).toBe(12);
  });

  it("واحد را از نام کالا جدا می‌کند", () => {
    for (const u of ["عدد", "تا", "بسته", "کارتن", "جفت", "متر"]) {
      const p = parseUtterance(`دو ${u} شومیز شانتون`);
      expect(p.qty).toBe(2);
      expect(p.term).toBe("شومیز شانتون");
    }
  });

  it("بدون عدد، تعداد یک است", () => {
    const p = parseUtterance("شلوارک لینن");
    expect(p.qty).toBe(1);
    expect(p.qtyExplicit).toBe(false);
    expect(p.term).toBe("شلوارک لینن");
  });

  it("واژه‌های دستوری را حذف می‌کند", () => {
    const p = parseUtterance("لطفا دو تا کاپشن کتان اضافه کن به فاکتور");
    expect(p.qty).toBe(2);
    expect(p.term).toBe("کاپشن کتان");
  });

  it("عدد داخل نام کالا را تعداد نمی‌گیرد", () => {
    /*
      🔴 مهم: نام واقعی کالاها عدد دارند («شلوار نخی یک و دو تک رنگ
      1111»). اگر هر عددی تعداد فرض شود، نام خراب می‌شود.
      عدد فقط از ابتدای عبارت خوانده می‌شود.
    */
    const p = parseUtterance("شومیز تترون نخ یک و دو تک رنگ");
    expect(p.term).toContain("شومیز تترون");
    expect(p.qtyExplicit).toBe(false);
  });

  it("«دو رنگ» را تعداد حساب نمی‌کند", () => {
    const p = parseUtterance("دو رنگ کیف");
    expect(p.qty).toBe(1);
    expect(p.term).toContain("رنگ");
  });

  it("تعداد غیرمنطقی را به یک برمی‌گرداند", () => {
    // تشخیص اشتباه نباید ۹۹۹۹ عدد به فاکتور اضافه کند.
    expect(parseUtterance("9999 عدد شومیز").qty).toBe(1);
    expect(parseUtterance("0 عدد شومیز").qty).toBe(1);
  });
});

describe("تطبیق فازی با کاتالوگ واقعی", () => {
  // کاتالوگ نمونه از داده‌ی واقعی «مزون پوشاک»
  const CATALOG = [
    "شومیز شانتون رنگی",
    "کاپشن کتان",
    "شلوارک لینن",
    "تل عینکی",
    "بافت ریز یقه اسکی",
    "کت ژاکارد و سوزندوزی",
    "شال موهر چارخونه",
    "جوراب ورزشی آلو",
    "شلوار بوت کات آبی تیره",
    "کیف چند رنگ",
    "کراپ کت لینن نچرال سایز یک و دو چند رنگ",
    "شلوار نخی یک و دو تک رنگ 1111",
    "بارونی بلند تیسی آستردار کرم و مشکی",
    "شلوار کرپ فیونا راه راه",
    "شلوار لینن پنبه",
    "شومیز تترون نخ یک و دو تک رنگ 1113",
    "کت مشکی طرح پیچازی",
    "جوراب نیم ساق ساده مردانه",
  ];
  const rank = (t: string) => rankMatches(parseUtterance(t).term, CATALOG, (n) => n, 5);

  it("عبارت کامل، گزینه‌ی درست را اول می‌آورد", () => {
    expect(rank("سه عدد شومیز شانتون رنگی")[0]?.item).toBe("شومیز شانتون رنگی");
    expect(rank("دو تا کاپشن کتان")[0]?.item).toBe("کاپشن کتان");
    expect(rank("پنج تا تل عینکی")[0]?.item).toBe("تل عینکی");
  });

  it("نام ناقص هم پیدا می‌شود", () => {
    // فروشنده اسم کامل را نمی‌گوید.
    expect(rank("کراپ کت لینن")[0]?.item).toContain("کراپ کت لینن");
    expect(rank("بارونی بلند تیسی")[0]?.item).toContain("بارونی بلند تیسی");
  });

  it("یک حرف اشتباه در تشخیص را تحمل می‌کند", () => {
    // «کتون» به‌جای «کتان» — خطای رایج تشخیص گفتار.
    expect(rank("کاپشن کتون")[0]?.item).toBe("کاپشن کتان");
  });

  it("برای گفته‌ی بی‌ربط چیزی پیشنهاد نمی‌دهد", () => {
    /*
      🔴 رگرسیون واقعی: با آستانه‌ی ۰٫۵ عبارت «یخچال ساید بای ساید»
      به «ست بلوز و شلوار ... سایز بندی» می‌خورد (۰٫۵۱) چون
      «ساید»≈«سایز»، و «لپ تاپ ایسوس» به «کراپ تاپ حلقه ای» (۰٫۶۲).
      این در تست با کاتالوگ کوچک دیده نمی‌شد؛ فقط روی ۳۷۵ کالای
      واقعی ظاهر شد. آستانه به ۰٫۶۵ رفت.
    */
    expect(rank("یخچال ساید بای ساید")).toHaveLength(0);
    expect(rank("لپ تاپ ایسوس")).toHaveLength(0);
    expect(rank("ماست پرچرب")).toHaveLength(0);
    expect(rank("گوشی سامسونگ")).toHaveLength(0);
  });

  it("«ساید» نباید با «سایز» یکی گرفته شود", () => {
    const withSize = ["ست بلوز و شلوار میله ای سایز بندی چهار رنگ"];
    const r = rankMatches("یخچال ساید بای ساید", withSize, (n) => n, 3);
    expect(r).toHaveLength(0);
  });

  it("امتیاز زیر آستانه فیلتر می‌شود", () => {
    const all = CATALOG.map((c) => similarity("جوراب", c));
    const passing = all.filter((s) => s >= MATCH_THRESHOLD);
    // «جوراب» باید فقط جوراب‌ها را بیاورد، نه همه را
    expect(passing.length).toBeLessThan(CATALOG.length / 2);
  });

  it("نرخ موفقیت روی مجموعه‌ی واقعی قابل قبول است", () => {
    const cases: [string, string][] = [
      ["سه عدد شومیز شانتون رنگی", "شومیز شانتون رنگی"],
      ["دو تا کاپشن کتان", "کاپشن کتان"],
      ["شلوارک لینن", "شلوارک لینن"],
      ["پنج تا تل عینکی", "تل عینکی"],
      ["بافت ریز یقه اسکی", "بافت ریز یقه اسکی"],
      ["شال موهر چارخونه", "شال موهر چارخونه"],
      ["دو جوراب ورزشی آلو", "جوراب ورزشی آلو"],
      ["شلوار بوت کات آبی تیره", "شلوار بوت کات آبی تیره"],
      ["چهار تا کیف چند رنگ", "کیف چند رنگ"],
      ["کاپشن کتون", "کاپشن کتان"],
    ];
    let top1 = 0;
    for (const [utter, expected] of cases) {
      if (rank(utter)[0]?.item === expected) top1++;
    }
    // سنجش واقعی روی ۳۷۵ کالا: ۹۴٪ رتبه‌ی اول، ۱۰۰٪ در سه گزینه‌ی اول
    expect(top1 / cases.length).toBeGreaterThanOrEqual(0.9);
  });
});

describe("یکپارچگی با فرم فاکتور", () => {
  const voice = read("components/shared/voice-order.tsx");
  const form = read("src/shared/panels/InvoiceCreateForm.tsx");

  it("هرگز خودکار به فاکتور اضافه نمی‌کند", () => {
    /*
      حیاتی‌ترین قید: با ۹۴٪ دقت، از هر ۱۶ بار یک بار گزینه‌ی اول
      اشتباه است. افزودن خودکار یعنی فاکتور غلط برای مشتری.
    */
    expect(voice).toContain("onClick={() => confirm(item)}");
    expect(voice).toContain("کدام کالا؟");
  });

  it("زبان روی fa-IR تنظیم شده", () => {
    expect(voice).toContain('rec.lang = "fa-IR"');
  });

  it("پیشوند وبکیت برای سافاری پشتیبانی می‌شود", () => {
    expect(voice).toContain("webkitSpeechRecognition");
  });

  it("اگر مرورگر پشتیبانی نکند دکمه رندر نمی‌شود", () => {
    // دکمه‌ای که کلیک شود و کار نکند بدتر از نبودنش است.
    expect(form).toContain("voiceReady ? () => setVoiceOpen(true) : undefined");
    expect(voice).toContain("export const isVoiceSupported");
  });

  it("روی لایه‌ی picker می‌نشیند تا پنل را نبندد", () => {
    expect(voice).toContain('zIndex: "var(--z-picker)"');
  });

  it("Escape فقط این لایه را می‌بندد", () => {
    expect(voice).toContain("e.stopPropagation()");
    expect(voice).toContain('window.addEventListener("keydown", onKey, true)');
  });

  it("پیش از تشخیص گفتار، مجوز میکروفون گرفته می‌شود", () => {
    /*
      🔴 باگ گزارش‌شده توسط کاربر روی کروم واقعی:
      «اجازه‌ی دسترسی به میکروفون داده نشد» بدون اینکه هرگز پنجره‌ی
      مجوز نشان داده شود.

      علت: SpeechRecognition.start() خودش پنجره‌ی کروم را باز
      نمی‌کند؛ اگر مجوز از قبل نباشد بی‌صدا not-allowed می‌دهد.
      (تأییدشده: permissions.query = "prompt" و start() نه onstart
      می‌داد نه onerror.)

      getUserMedia همان درخواستی است که پنجره را می‌آورد.
    */
    expect(voice).toContain("navigator.mediaDevices.getUserMedia({ audio: true })");
    // جریان بلافاصله بسته می‌شود تا میکروفون دوبار اشغال نشود
    expect(voice).toContain("probe.getTracks().forEach((t) => t.stop())");
  });

  it("افکت شروع فقط به open وابسته است", () => {
    // وگرنه با رسیدن کاتالوگ، start دوباره اجرا و مجوز دوبار
    // درخواست می‌شد. (اندازه‌گیری‌شده: getUserMedia دو بار)
    expect(voice).toContain("const startRef = useRef(start)");
    expect(voice).toContain("void startRef.current()");
  });

  it("پیام خطا راهنمای عملی می‌دهد نه دستور مبهم", () => {
    expect(voice).toContain("روی قفل کنار نشانی سایت بزنید");
  });

  it("کاتالوگ نیامده با «پیدا نشد» اشتباه گرفته نمی‌شود", () => {
    // گفتن «پیدا نشد» وقتی فهرست خالی است دروغ است.
    expect(voice).toContain("فهرست کالاها هنوز آماده نیست");
  });

  it("خطاهای میکروفون پیام مشخص دارند", () => {
    expect(voice).toContain('"not-allowed"');
    expect(voice).toContain('"no-speech"');
    expect(voice).toContain('"network"');
  });

  it("مجوز میکروفون صریح درخواست می‌شود", () => {
    /*
      🔴 بدون این، SpeechRecognition در حالت مسدود بی‌صدا خطا
      می‌داد و پنجره‌ی مجوز مرورگر هرگز باز نمی‌شد. کاربر فقط
      «اجازه داده نشد» می‌دید بدون راه بازیابی.
    */
    expect(voice).toContain("navigator.mediaDevices.getUserMedia({ audio: true })");
    // استریم باید بلافاصله آزاد شود؛ فقط برای گرفتن مجوز است.
    expect(voice).toContain("s.getTracks().forEach((t) => t.stop())");
  });

  it("وضعیت مجوز پیش از تلاش بررسی می‌شود", () => {
    expect(voice).toContain('name: "microphone" as PermissionName');
    expect(voice).toContain('st?.state === "denied"');
  });

  it("راهنمای بازیابی مسیر دقیق مرورگر را می‌دهد", () => {
    // «از تنظیمات مرورگر فعالش کنید» بی‌فایده بود — کاربر نمی‌داند کجا.
    expect(voice).toContain("آیکون قفل");
    expect(voice).toContain("Settings for This Website");
    expect(voice).toContain("تلاش دوباره");
  });

  it("کاتالوگ از کش مشترک می‌آید، نه کوئری جدید", () => {
    const hook = read("lib/hooks/useAllVariants.ts");
    expect(hook).toContain('queryKey: ["all-variants", orgId]');
  });
});
