import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

/** همه‌ی فایل‌های tsx/ts زیر مسیرهای رابط کاربری. */
function uiFiles(): string[] {
  const out: string[] = [];
  const skip = new Set(["node_modules", ".next", "tests"]);
  const walk = (d: string) => {
    for (const entry of readdirSync(join(root, d))) {
      if (skip.has(entry)) continue;
      const rel = `${d}/${entry}`;
      if (statSync(join(root, rel)).isDirectory()) walk(rel);
      else if (entry.endsWith(".tsx") || entry.endsWith(".ts")) out.push(rel);
    }
  };
  for (const dir of ["app", "components", "src", "lib"]) walk(dir);
  return out;
}

describe("نام‌گذاری: انبارگردانی به‌جای تعدیل", () => {
  /*
    changelog.ts مستثناست: یادداشت انتشار عمداً نام قدیمی را ذکر
    می‌کند («"تعدیل موجودی" به نام صحیح "انبارگردانی" تغییر کرد») تا
    کاربر بفهمد چه چیزی عوض شده. بدون این استثنا، تست خودِ توضیحِ
    تغییر را ممنوع می‌کرد.
  */
  const files = uiFiles().filter((f) => f !== "lib/changelog.ts");

  it("«تعدیل انبار» در هیچ فایلی نمانده", () => {
    const found = files.filter((f) => read(f).includes("تعدیل انبار"));
    expect(found, `در این فایل‌ها مانده: ${found.join(", ")}`).toEqual([]);
  });

  it("«تعدیل موجودی» به‌عنوان برچسب UI نمانده", () => {
    /*
      کلمه‌ی «تعدیل» داخل جمله‌های توضیحی مجاز است («دلیل این تعدیل در
      تاریخچه ثبت می‌شود») — چیزی که حذف شد، عنوان‌ها و برچسب‌های
      کلیک‌شدنی بود.
    */
    const found = files.filter((f) => read(f).includes("تعدیل موجودی"));
    expect(found, `در این فایل‌ها مانده: ${found.join(", ")}`).toEqual([]);
  });

  it("سایدبار و داشبورد «انبارگردانی» دارند", () => {
    expect(read("components/shared/sidebar.tsx")).toContain('label: "انبارگردانی"');
    expect(read("app/(app)/dashboard/components/DashboardQuickActions.tsx")).toContain('label="انبارگردانی"');
  });

  it("عنوان صفحه و گزارش فعالیت هم عوض شده", () => {
    expect(read("components/shared/inventory-operation-page.tsx")).toContain('adjust: "انبارگردانی"');
    expect(read("app/(app)/activity/page.tsx")).toContain('stock_adjust: "انبارگردانی"');
  });

  it("زیرعنوان توضیح می‌دهد که عدد ورودی «موجودی واقعی» است", () => {
    /*
      یک سوءتفاهم رایج: کاربر فکر می‌کند باید *مقدار تغییر* را وارد کند
      نه موجودی شمرده‌شده. نتیجه‌اش موجودی کاملاً غلط است.
    */
    expect(read("components/shared/inventory-operation-page.tsx")).toContain("شمارش فیزیکی");
  });

  it("مسیر و کلید مجوز عوض نشده", () => {
    // تغییر نام فقط نمایشی است؛ دست‌زدن به مسیر یعنی شکستن لینک‌های
    // ذخیره‌شده و مجوزهای ثبت‌شده در دیتابیس.
    expect(read("components/shared/sidebar.tsx")).toContain('href: "/inventory/adjust"');
    expect(read("lib/access/permission-tree.ts")).toContain('key: "inventory.adjust"');
  });
});

describe("هدر: نام شخص و کسب‌وکار", () => {
  const header = read("components/shared/header.tsx");

  it("نام کسب‌وکار زیر نام شخص نمایش داده می‌شود", () => {
    /*
      قبلاً هر دو خط یک چیز بودند: نام کاربری و همان نام کاربری بدون
      دامنه — اطلاعات تکراری.
    */
    expect(header).toContain("orgName");
    expect(header).toContain("useOrg");
  });

  it("هر دو منبع نام کامل بررسی می‌شوند", () => {
    /*
      بررسی روی داده‌ی واقعی نشان داد نام در دو جای متفاوت است:
        user_metadata.name            → کاربرانی که مدیر ساخته
        organizations.owner_full_name → ثبت‌نام‌های /onboarding
      هیچ کاربری هر دو را ندارد و حساب‌های قدیمی هیچ‌کدام را.
    */
    expect(header).toContain("user_metadata?.name");
    expect(header).toContain("owner_full_name");
  });

  it("نام کاربری فقط جایگزین نهایی است", () => {
    expect(header).toContain("?? displayUsername(currentUser?.email)");
  });

  it("🔴 نام مالک با owner_id فیلتر می‌شود", () => {
    /*
      باگی که در تست دیده شد: کوئری بدون فیلتر و با limit(1) بود. RLS
      برای کاربر سوپرادمین چند سازمان برمی‌گرداند و «اولین» ردیف لزوماً
      سازمان خودش نیست.

      نتیجه: با حساب bahram وارد می‌شدیم و هدر نام «یزدانی» — مالک یک
      کسب‌وکار کاملاً دیگر — را نشان می‌داد. نشت نام بین سازمان‌ها.
    */
    expect(header).toContain('.eq("owner_id", user.id)');
  });

  it("نام سازمان از همان کوئری موجود می‌آید نه کوئری دوم", () => {
    // هدر نباید یک رفت‌وبرگشت اضافه به سرور تحمیل کند.
    const useOrg = read("lib/hooks/useOrg.ts");
    expect(useOrg).toContain('.select("name, is_demo, trial_ends_at")');
    expect(useOrg).toContain("orgName");
  });
});
