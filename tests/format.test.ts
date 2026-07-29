import { describe, expect, it } from "vitest";
import { displayUsername, formatToman, rialToToman, toEnDigits, toFaDigits, tomanToRial } from "../lib/utils/format";

describe("money and digit helpers", () => {
  it("converts toman to rial using integer math", () => {
    expect(tomanToRial(1250)).toBe(12500);
  });

  it("converts rial to toman using rounding", () => {
    expect(rialToToman(12505)).toBe(1251);
  });

  it("formats rial as toman with Persian digits", () => {
    expect(formatToman(125000)).toContain("۱۲,۵۰۰");
  });

  it("normalizes Persian and Arabic digits", () => {
    expect(toEnDigits("۱۲۳٤٥")).toBe("12345");
    expect(toFaDigits("123")).toBe("۱۲۳");
  });
});

describe("displayUsername", () => {
  it("دامنه داخلی را حذف می‌کند", () => {
    expect(displayUsername("09111558263@hesabyar.app")).toBe("09111558263");
    expect(displayUsername("bahram@hesabyar.app")).toBe("bahram");
  });

  it("ایمیل واقعی را دست‌نخورده نگه می‌دارد", () => {
    expect(displayUsername("info@example.com")).toBe("info@example.com");
  });

  it("مقدار خالی را امن مدیریت می‌کند", () => {
    expect(displayUsername(null)).toBe("");
    expect(displayUsername(undefined)).toBe("");
    expect(displayUsername("")).toBe("");
  });
});
