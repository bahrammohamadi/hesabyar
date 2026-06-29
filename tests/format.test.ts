import { describe, expect, it } from "vitest";
import { formatToman, rialToToman, toEnDigits, toFaDigits, tomanToRial } from "../lib/utils/format";

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
