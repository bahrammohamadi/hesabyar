import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
/*
  ⚠️ تله‌ی تکراری: ادعاهای تست روی *توضیحات فارسی* گیر می‌کنند نه کد.
  اینجا مخصوصاً خطرناک است چون توضیحات این فایل‌ها پر از کلماتی مثل
  «مؤدیان» و «اقساط» است — دقیقاً همان چیزهایی که دنبالشان می‌گردیم.
*/
const readCode = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^\s*(\/\/|--).*$/gm, "");

/** همه‌ی فایل‌های صفحات معرفی. */
function marketingFiles(): string[] {
  const out: string[] = [];
  const walk = (rel: string) => {
    for (const e of readdirSync(join(root, rel), { withFileTypes: true })) {
      const p = `${rel}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".tsx") || e.name.endsWith(".ts")) out.push(p);
    }
  };
  walk("app/(marketing)");
  return out;
}

describe("🔴 صفحه‌ی معرفی نباید قابلیتی را وعده بدهد که وجود ندارد", () => {
  /*
    بررسی سایت زنده دو ادعای دروغ پیدا کرد:
      • «فروش اقساطی» در بخش لوازم خانگی — ما فقط نسیه داریم
      • «پنل پیامکی رایگان» در پلن شش‌ماهه — هیچ سرویس پیامکی وصل نیست

    کاربری که به امید یکی از این‌ها ثبت‌نام کند و پیدایش نکند،
    برنمی‌گردد. این تست جلوی برگشتنشان را می‌گیرد.
  */
  const files = marketingFiles();

  /*
    ⚠️ این تست اول خودش اشتباه بود و بخش «صادقانه: چه چیزهایی نداریم»
    را هم ادعا می‌شمرد — یعنی همان جایی که *عمداً* می‌گوییم نداریم.

    قاعده‌ی درست: کلمه ممنوع نیست؛ **ادعا کردنش** ممنوع است. پس فایلی
    که کلمه را در بافت انکار آورده مستثناست.
  */
  const DISCLAIM_MARKERS = ["نداریم", "وجود ندارد", "به‌زودی", "در حال"];

  /**
   * آیا این ادعا در بافت انکار آمده؟
   *
   * ⚠️ نسخه‌ی اول کل فایل را می‌گشت و همین ضعیفش می‌کرد: وقتی
   * «پنل پیامکی رایگان» را عمداً به plans.ts برگرداندم، تست سبز ماند
   * چون جای دیگری از همان فایل کلمه‌ی «حذف شد» بود.
   *
   * حالا فقط **همان خط** بررسی می‌شود. سلب ادعا باید کنار خودِ ادعا
   * باشد، نه سه‌تا پاراگراف پایین‌تر.
   */
  const claimIsDisclaimed = (code: string, keyword: string): boolean => {
    const lines = code.split("\n").filter((l) => l.includes(keyword));
    if (lines.length === 0) return true;
    return lines.every((l) => DISCLAIM_MARKERS.some((m) => l.includes(m)));
  };

  it("«پنل پیامکی» یا «ارسال پیامک انبوه» وعده داده نمی‌شود", () => {
    // تنها چیز موجود، لینک sms: روی شماره‌ی مخاطب است که خودِ گوشی باز می‌کند.
    for (const f of files) {
      const code = readCode(f);
      for (const kw of ["پنل پیامکی", "پیامک انبوه"]) {
        expect(claimIsDisclaimed(code, kw), `${f} «${kw}» را بدون سلب ادعا آورده`).toBe(true);
      }
    }
  });

  it("«فروش اقساطی» وعده داده نمی‌شود", () => {
    // دفترچه‌ی اقساط با سررسید و کارمزد و جریمه‌ی دیرکرد نداریم.
    for (const f of files) {
      const code = readCode(f);
      for (const kw of ["فروش اقساطی", "دفترچه اقساط"]) {
        expect(claimIsDisclaimed(code, kw), `${f} «${kw}» را بدون سلب ادعا آورده`).toBe(true);
      }
    }
  });

  it("🔴 «اتصال به سامانه‌ی مؤدیان» به‌عنوان قابلیت موجود ادعا نمی‌شود", () => {
    /*
      از دی ۱۴۰۴ الزام قانونی است و جریمه‌اش ۱۰٪ کل فروش. اگر کسی به
      امیدش ثبت‌نام کند و نباشد، حق دارد شاکی باشد.

      ذکرش فقط در بخش «هنوز نداریم» یا «به‌زودی» مجاز است — پس اگر
      کلمه آمد، باید یکی از این نشانه‌ها هم در همان فایل باشد.
    */
    for (const f of files) {
      const code = readCode(f);
      if (!code.includes("مودیان") && !code.includes("مؤدیان")) continue;
      const disclaimed =
        code.includes("هنوز نداریم") ||
        code.includes("نداریم") ||
        code.includes("در حال") ||
        code.includes("به‌زودی") ||
        code.includes("notYet");
      expect(disclaimed, `${f} مؤدیان را بدون سلب ادعا آورده`).toBe(true);
    }
  });

  it("«درگاه پرداخت» به‌عنوان قابلیت موجود ادعا نمی‌شود", () => {
    for (const f of files) {
      const code = readCode(f);
      if (!code.includes("درگاه پرداخت")) continue;
      const disclaimed =
        code.includes("نداریم") || code.includes("در حال") || code.includes("به‌زودی");
      expect(disclaimed, `${f} درگاه پرداخت را بدون سلب ادعا آورده`).toBe(true);
    }
  });
});

describe("بخش مزیت‌ها — هر ادعا باید کدِ پشتیبانش موجود باشد", () => {
  const adv = readCode("app/(marketing)/components/MarketingAdvantages.tsx");

  /*
    قاعده: برای هر مزیتی که در صفحه‌ی اول ادعا می‌شود، فایل متناظرش
    باید واقعاً در مخزن باشد. اگر روزی کسی قابلیتی را حذف کند و یادش
    برود متن سایت را عوض کند، این تست می‌گیردش.
  */
  const CLAIMS: { keyword: string; proof: string }[] = [
    { keyword: "نصب روی گوشی", proof: "public/sw.js" },
    { keyword: "صدا", proof: "components/shared/voice-order.tsx" },
    { keyword: "دوربین", proof: "components/shared/barcode-scanner.tsx" },
    { keyword: "اکسل", proof: "app/(app)/settings/backup/page.tsx" },
    { keyword: "ویترین", proof: "app/shop/[slug]/page.tsx" },
  ];

  for (const { keyword, proof } of CLAIMS) {
    it(`ادعای «${keyword}» با ${proof} پشتیبانی می‌شود`, () => {
      expect(adv, "ادعا در صفحه نیست").toContain(keyword);
      expect(existsSync(join(root, proof)), `${proof} وجود ندارد`).toBe(true);
    });
  }

  it("بخش «صادقانه: چه چیزهایی نداریم» وجود دارد", () => {
    /*
      هر رقیبی صفحه‌ی «چرا ما بهتریم» دارد؛ هیچ‌کدام نمی‌گوید چه ندارد.
      همین متمایزمان می‌کند و از ناامیدی بعد از ثبت‌نام جلوگیری می‌کند.
    */
    expect(adv).toContain("صادقانه");
    // و باید دقیقاً همان چیزهایی را نام ببرد که واقعاً نداریم
    for (const gap of ["مؤدیان", "درگاه پرداخت", "اپلیکیشن اندروید", "اقساط"]) {
      expect(adv, `«${gap}» در فهرست کاستی‌ها نیست`).toContain(gap);
    }
  });

  it("ساختار مقایسه‌ای «معمولاً / در ترازو» دارد", () => {
    // فهرست ساده‌ی قابلیت‌ها برای کسی که نرم‌افزار دیگری دارد بی‌معناست.
    expect(adv).toContain("معمولاً:");
    expect(adv).toContain("them:");
    expect(adv).toContain("us:");
  });

  it("در صفحه‌ی اصلی رندر می‌شود", () => {
    const page = readCode("app/(marketing)/page.tsx");
    expect(page).toContain("<MarketingAdvantages />");
  });

  it("پیش از بخش «چطور شروع کنم» می‌آید", () => {
    // اول «چه کاری می‌شود کرد»، بعد «چرا اینجا»، بعد «چطور شروع کنم».
    const page = readCode("app/(marketing)/page.tsx");
    expect(page.indexOf("<MarketingAdvantages />")).toBeLessThan(
      page.indexOf("<HomeExtras />")
    );
  });

  it("هیچ کلاس پالت خام یا hex ندارد", () => {
    expect(adv).not.toMatch(
      /\b(?:bg|text|border)-(?:white|black|slate|rose|emerald|sky|amber|zinc|gray|red|green|blue)(?:\/|-)/
    );
    expect(adv).not.toMatch(/#[0-9a-fA-F]{6}\b/);
  });

  it("هیچ عدد اثبات‌نشده‌ای ادعا نمی‌کند", () => {
    /*
      «۵۰۰۰ کاربر فعال»، «۹۸٪ رضایت»، «۳۰ روز تست رایگان» — هیچ‌کدام
      قابل اثبات نیستند. صفحه عمداً بدون عدد است.
    */
    /*
      ⚠️ نسخه‌ی اول فقط `\d` داشت و ارقام فارسی را نمی‌گرفت. وقتی
      «۵۰ هزار کاربر» را عمداً گذاشتم، سبز ماند. متن سایت *همیشه*
      فارسی است، پس بدون [۰-۹] این ادعا عملاً بی‌اثر بود.
    */
    expect(adv).not.toMatch(/[۰-۹\d]+\s*(?:هزار|میلیون)\s*(?:کاربر|مشتری|فروشگاه)/);
    expect(adv).not.toMatch(/[۰-۹\d]+\s*٪\s*(?:رضایت|رشد)/);
  });
});
