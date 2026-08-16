import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
/*
  ⚠️ تله‌ی تکراری: ادعاهای تست روی *توضیحات فارسی* گیر می‌کنند نه کد.
  اینجا مخصوصاً خطرناک است چون توضیحات پر از کلمه‌ی «alert» است.
*/
const readCode = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^\s*(\/\/|--).*$/gm, "");

describe("🔴 هیچ alert() بومی در برنامه نمانده", () => {
  /*
    `alert()` با بقیه‌ی برنامه هیچ شباهتی ندارد: راست‌به‌چپ نیست،
    فونت وزیرمتن ندارد، و روی موبایل کل صفحه را قفل می‌کند.

    دو صفحه‌ی سفارش فروش و مرجوعی فروش عمداً دست‌نخورده مانده بودند و
    پنج مورد داشتند. این تست جلوی برگشتنشان را می‌گیرد.
  */
  function walk(rel: string, out: string[] = []): string[] {
    for (const e of readdirSync(join(root, rel), { withFileTypes: true })) {
      const p = `${rel}/${e.name}`;
      if (e.isDirectory()) {
        if (["node_modules", ".next", "dist"].includes(e.name)) continue;
        walk(p, out);
      } else if (e.name.endsWith(".tsx")) {
        out.push(p);
      }
    }
    return out;
  }

  it("در هیچ فایل tsx فراخوانی alert نیست", () => {
    const offenders: string[] = [];
    for (const f of [...walk("app"), ...walk("components"), ...walk("src")]) {
      const code = readCode(f);
      // `alert(` با پیشوند حرفی (مثل `useAlert(`) شمرده نشود.
      if (/(?<![\w.])alert\s*\(/.test(code)) offenders.push(f);
    }
    expect(offenders, `فایل‌های دارای alert: ${offenders.join(", ")}`).toEqual([]);
  });

  it("صفحه‌های سفارش و مرجوعی از useToast استفاده می‌کنند", () => {
    for (const f of ["app/(app)/sales/orders/page.tsx", "app/(app)/sales/returns/page.tsx"]) {
      const code = readCode(f);
      expect(code, f).toContain("useToast");
      expect(code, f).toContain("toast({");
    }
  });

  it("پیام خطا توضیح جدا دارد نه رشته‌ی چسبیده", () => {
    /*
      `alert("خطا: " + err.message)` همه‌چیز را در یک خط می‌ریخت.
      عنوان و توضیح جدا، هم خواناتر است و هم پیام فنی را از پیام
      کاربرپسند تفکیک می‌کند.
    */
    const orders = readCode("app/(app)/sales/orders/page.tsx");
    expect(orders).toContain("description: (err as Error).message");
  });
});

describe("سطح قیمت پیش‌فرض مشتری", () => {
  const form = readCode("src/shared/panels/InvoiceCreateForm.tsx");
  const panel = readCode("src/shared/panels/ContactPanel.tsx");
  const service = readCode("src/core/services/contact-service.ts");

  it("در پرونده‌ی مشتری قابل تنظیم است", () => {
    expect(panel).toContain("priceListId");
    expect(panel).toContain("price_list_id");
  });

  it("در meta ذخیره می‌شود نه ستون جدید", () => {
    // contacts.meta از قبل برای wallet_credit استفاده می‌شود؛ همان الگو.
    expect(service).toContain('setMeta("price_list_id", input.price_list_id)');
  });

  it("رشته‌ی خالی ذخیره نمی‌شود", () => {
    // کلید بی‌مصرف در meta فقط حجم اضافه است.
    expect(panel).toContain("form.priceListId || undefined");
  });

  it("هنگام انتخاب مشتری در فاکتور اعمال می‌شود", () => {
    expect(form).toContain("customer-default-price-list");
    expect(form).toContain("setPriceListId(");
  });

  it("🔴 انتخاب دستی کاربر را بازنویسی نمی‌کند", () => {
    /*
      اگر کاربر خودش لیستی انتخاب کرده، سیستم نباید رویش بنویسد.
      «هوشمندی» که روی دست کاربر بزند، بدترین نوع است.

      شرط `current === ""` یعنی فقط وقتی چیزی انتخاب نشده.
    */
    expect(form).toContain('current === "" ? customerPriceList : current');
  });

  it("مقدار نامعتبر در meta نادیده گرفته می‌شود", () => {
    // meta آزاد است؛ عدد یا آبجکت نباید به‌جای شناسه استفاده شود.
    expect(form).toContain('typeof id === "string" && id.length > 0');
  });

  it("انتخابگر گزینه‌ی «قیمت عادی» دارد", () => {
    // بدون آن، نمی‌شد لیست قیمت را برداشت.
    expect(panel).toContain("قیمت عادی");
  });
});
