import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
/*
  ⚠️ تله‌ی تکراری: ادعاهای تست روی *توضیحات فارسی* گیر می‌کنند نه کد.
  کامنت‌ها قبل از هر جستجو حذف می‌شوند.
*/
const readCode = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^\s*(\/\/|--).*$/gm, "");

const FORMS = [
  "src/shared/panels/InvoiceCreateForm.tsx",
  "src/shared/panels/PurchaseCreateForm.tsx",
];

describe("🔴 دکمه‌ی رفتن به مرحله‌ی پرداخت", () => {
  /*
    باگ گزارش‌شده‌ی کاربر: «توی پنجره ثبت فاکتور فروش جدید بعد از
    انتخاب کالاها دکمه‌ای نداره که بره مرحله بعدی که میشه مرحله پرداخت».

    علت: نوار چسبان پایین `lg:hidden` داشت — یعنی به عرض *پنجره* نگاه
    می‌کرد. روی لپ‌تاپ ۱۲۸۰px پنهان می‌شد، ولی فرم داخل پنل ۵۶۰px است
    و هرگز دوستونی نمی‌شود، پس ستون پرداخت هم دیده نمی‌شد.

    اندازه‌گیری واقعی پیش از اصلاح (یک قلم در سبد):
      ۳۹۰px  → دکمه دیده می‌شود
      ۸۲۰px  → دکمه دیده می‌شود
      ۱۲۸۰px → دکمه پنهان 🔴
      ۱۹۲۰px → دکمه پنهان 🔴
  */
  it("هر دو فرم دکمه‌ی «ادامه به پرداخت» دارند", () => {
    for (const f of FORMS) {
      const code = readCode(f);
      expect(code, f).toContain("ادامه به پرداخت");
      expect(code, f).toContain('setStep("payment")');
    }
  });

  it("🔴 نوار چسبان دیگر lg:hidden ندارد", () => {
    /*
      همان خانواده‌باگی که دو بار دیگر هم گرفتیمش. هر `lg:` داخل این
      فرم غلط است چون فرم هم تمام‌عرض رندر می‌شود هم داخل پنل باریک.

      ⚠️ نسخه‌ی اول این تست ضعیف بود: روی `split("invoice-sticky-bar")`
      تکیه می‌کرد، پس وقتی باگ را عمداً برگرداندم (کلاس را برداشتم و
      `lg:hidden` گذاشتم) اصلاً چیزی برای بررسی پیدا نکرد و سبز ماند.
      حالا اول وجود کلاس تضمین می‌شود، بعد نبودِ lg:hidden.
    */
    for (const f of FORMS) {
      const code = readCode(f);
      expect(code, f).toContain("invoice-sticky-bar sticky bottom-0");
      // هیچ‌جای فرم نباید نوار پایین را با عرض پنجره پنهان کند
      expect(code, f).not.toContain("lg:hidden");
    }
  });

  it("پنهان‌شدن نوار به عرض ظرف بسته است نه پنجره", () => {
    /*
      ⚠️ نسخه‌ی اول این تست هم ضعیف بود: فقط می‌گفت رشته‌ی
      `display: none` جایی داخل بلوک هست — ولی آن بلوک برای
      `.invoice-steps-tabs` هم `display: none` دارد، پس وقتی قاعده‌ی
      نوار را عمداً حذف کردم باز سبز ماند. حالا خودِ جفتِ
      «سلکتور + قاعده» سنجیده می‌شود.
    */
    const css = read("app/globals.css");
    expect(css).toMatch(/\.invoice-sticky-bar\s*\{\s*display:\s*block;/);

    const twoCol = css.slice(css.indexOf("@container invoiceform (min-width: 860px)"));
    const block = twoCol.slice(0, twoCol.indexOf("\n}\n\n"));
    expect(block).toMatch(/\.invoice-sticky-bar\s*\{\s*display:\s*none;\s*\}/);
  });

  it("🔴 در مرحله‌ی پرداخت با شرط رندر پنهان می‌شود نه کلاس hidden", () => {
    /*
      اولین تلاشم کلاس `hidden` بود و کار نکرد:
      `.invoice-sticky-bar{display:block}` و `.hidden` هر دو
      specificity یکسان (۰,۱,۰) دارند، پس آنکه دیرتر در فایل می‌آید
      برنده است — و آن، کلاس ماست. نتیجه: نوار در مرحله‌ی پرداخت
      می‌ماند و روی دکمه‌ی ثبت می‌افتاد (در اسکرین‌شات دیده شد).

      شرط رندر React این تداخل را کلاً حذف می‌کند.
    */
    for (const f of FORMS) {
      const code = readCode(f);
      expect(code, f).toContain('{step !== "payment" && (');
      const bar = code.split("invoice-sticky-bar")[1] ?? "";
      // دیگر روی خودِ نوار کلاس hidden شرطی نیست
      expect(bar.slice(0, 200), f).not.toContain('"hidden"');
    }
  });

  it("دکمه با سبد خالی غیرفعال است", () => {
    // رفتن به پرداخت با صفر قلم، فاکتور بی‌معنا می‌سازد.
    for (const f of FORMS) {
      expect(readCode(f), f).toContain("disabled={cart.length === 0}");
    }
  });

  it("تب‌های مرحله فقط در حالت تک‌ستونی دیده می‌شوند", () => {
    /*
      در حالت دوستونی هر دو مرحله هم‌زمان روی صفحه‌اند، پس تب معنا
      ندارد و نوار چسبان هم لازم نیست — این دو باید با هم هماهنگ
      باشند، وگرنه یکی از حالت‌ها بدون هیچ راه پیشروی می‌ماند.
    */
    const css = read("app/globals.css");
    const twoCol = css.slice(css.indexOf("@container invoiceform (min-width: 860px)"));
    const block = twoCol.slice(0, twoCol.indexOf("\n}\n\n"));
    expect(block).toContain(".invoice-steps-tabs");
    expect(block).toContain(".invoice-step-hidden");
  });
});
