import { describe, expect, it } from "vitest";
import { formatMoney } from "@/lib/utils/money";
import { parsePrefs } from "@/lib/org-prefs";

/*
  آزمون همان زنجیره‌ای که صفحه‌ی فروشگاه اجرا می‌کند:
    settings.value → parsePrefs → currency → formatMoney
*/
describe("زنجیره‌ی واحد پول فروشگاه", () => {
  const price = 9_800_000; // ریال، مثل داده‌ی واقعی

  it("سازمان ریالی، ریال نشان می‌دهد", () => {
    const currency = parsePrefs({ currency: "rial" }).currency;
    const out = formatMoney(price, currency);
    expect(out).toContain("ریال");
    expect(out).not.toContain("تومان");
    expect(out).toContain("۹,۸۰۰,۰۰۰");
  });

  it("سازمان تومانی، تومان نشان می‌دهد", () => {
    const currency = parsePrefs({ currency: "toman" }).currency;
    const out = formatMoney(price, currency);
    expect(out).toContain("تومان");
    expect(out).toContain("۹۸۰,۰۰۰");
  });

  it("نبود تنظیمات به تومان برمی‌گردد (رفتار قبلی)", () => {
    const currency = parsePrefs(null).currency;
    expect(formatMoney(price, currency)).toContain("تومان");
  });
});
