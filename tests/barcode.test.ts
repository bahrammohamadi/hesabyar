import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkBarcode, hasValidCheckDigit, isIranianEan, normalizeBarcode } from "../lib/barcode";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("رقم کنترل بارکد", () => {
  it("EAN-13 معتبر را می‌پذیرد", () => {
    // نمونه‌های واقعی با رقم کنترل درست
    expect(hasValidCheckDigit("4006381333931")).toBe(true);
    expect(hasValidCheckDigit("9780306406157")).toBe(true);
  });

  it("EAN-8 و UPC-A را هم بررسی می‌کند", () => {
    expect(hasValidCheckDigit("96385074")).toBe(true);   // EAN-8
    expect(hasValidCheckDigit("036000291452")).toBe(true); // UPC-A
  });

  it("یک رقم اشتباه را می‌گیرد", () => {
    // اسکن نوری گاهی یک رقم را غلط می‌خواند؛ همین را باید بگیرد.
    expect(hasValidCheckDigit("4006381333932")).toBe(false);
    expect(hasValidCheckDigit("9780306406158")).toBe(false);
  });

  it("ورودی غیرعددی یا طول نامعتبر را رد می‌کند", () => {
    expect(hasValidCheckDigit("PANEL9B")).toBe(false);
    expect(hasValidCheckDigit("12345")).toBe(false);
    expect(hasValidCheckDigit("")).toBe(false);
  });

  it("پیش‌شماره‌ی ایران را تشخیص می‌دهد", () => {
    // ۶۲۶ = ایران. رقم کنترل هم باید درست باشد.
    expect(isIranianEan("4006381333931")).toBe(false);
    expect(isIranianEan("626000000001")).toBe(false); // ۱۲ رقم، نه ۱۳
  });
});

describe("نرمال‌سازی بارکد", () => {
  it("ارقام فارسی و عربی را لاتین می‌کند", () => {
    expect(normalizeBarcode("۹۹۰۰۰۰۰۰۰۰۰۱")).toBe("990000000001");
    expect(normalizeBarcode("٩٩٠٠٠٠٠٠٠٠٠١")).toBe("990000000001");
  });

  it("فاصله و خط تیره را حذف می‌کند", () => {
    // بارکدخوان سخت‌افزاری گاهی جداکننده می‌فرستد.
    expect(normalizeBarcode("990 000 000 001")).toBe("990000000001");
    expect(normalizeBarcode("990-000-000-001")).toBe("990000000001");
  });

  it("کد داخلی حرفی را خراب نمی‌کند", () => {
    // در داده‌ی واقعی این پروژه «PANEL9B» وجود دارد.
    expect(normalizeBarcode("panel9b")).toBe("PANEL9B");
  });

  it("صفر ابتدایی UPC-A سیزده‌رقمی را برمی‌دارد", () => {
    expect(normalizeBarcode("0036000291452")).toBe("036000291452");
  });

  it("ورودی خالی را امن مدیریت می‌کند", () => {
    expect(normalizeBarcode(null)).toBe("");
    expect(normalizeBarcode(undefined)).toBe("");
    expect(normalizeBarcode("   ")).toBe("");
  });
});

describe("ارزیابی کد برای کاربر", () => {
  it("کد داخلی را نامعتبر اعلام نمی‌کند", () => {
    // فروشگاه‌ها برچسب داخلی با هر فرمتی می‌زنند؛ رد کردنشان اشتباه است.
    const r = checkBarcode("PANEL9B");
    expect(r.isEmpty).toBe(false);
    expect(r.warning).toBeNull();
  });

  it("EAN با رقم کنترل غلط هشدار می‌دهد ولی رد نمی‌کند", () => {
    const r = checkBarcode("4006381333932");
    expect(r.looksLikeEan).toBe(true);
    expect(r.checkDigitOk).toBe(false);
    expect(r.warning).toContain("رقم کنترل");
    // مقدار همچنان برگردانده می‌شود تا کاربر خودش تصمیم بگیرد
    expect(r.value).toBe("4006381333932");
  });

  it("کد خالی را اعلام می‌کند", () => {
    expect(checkBarcode("").warning).toBe("کدی خوانده نشد");
  });
});

describe("یکپارچگی اسکنر با فرم فاکتور", () => {
  const scanner = read("components/shared/barcode-scanner.tsx");
  const form = read("src/shared/panels/InvoiceCreateForm.tsx");
  const bar = read("app/(app)/sales/components/PosPieces.tsx");

  it("اسکنر روی لایه‌ی picker می‌نشیند تا پنل را نبندد", () => {
    // همان درسی که از باگ انتخابگر کالا گرفتیم.
    expect(scanner).toContain('zIndex: "var(--z-picker)"');
  });

  it("Escape فقط اسکنر را می‌بندد، نه پنل زیرین", () => {
    expect(scanner).toContain("e.stopPropagation()");
    expect(scanner).toContain('window.addEventListener("keydown", onKey, true)');
  });

  it("دوربین در پاک‌سازی آزاد می‌شود", () => {
    // بدون stop روی هر track، چراغ دوربین روشن می‌ماند.
    expect(scanner).toContain("getTracks().forEach((t) => t.stop())");
    expect(scanner).toContain("srcObject = null");
  });

  it("ZXing فقط در نبود API بومی بارگذاری می‌شود", () => {
    // import پویا تا کاربر کروم ۲۰۰ کیلوبایت اضافه دانلود نکند.
    expect(scanner).toContain('await import("@zxing/browser")');
    expect(scanner).toContain("if (NativeDetector)");
  });

  it("از اسکن تکراری جلوگیری می‌کند", () => {
    // یک بارکد در هر فریم چند بار خوانده می‌شود.
    expect(scanner).toContain("lastRef.current.code === value");
  });

  it("رد شدن مجوز دوربین راه جایگزین دارد", () => {
    expect(scanner).toContain("NotAllowedError");
    expect(scanner).toContain("ورود دستی کد");
  });

  it("فرم، بارکد پیدانشده را بن‌بست نمی‌کند", () => {
    expect(form).toContain("setScanMiss(code)");
    expect(bar).toContain("جستجوی دستی");
  });
});
