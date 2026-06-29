import { describe, it, expect } from "vitest";
import {
  toFaDigits,
  toEnDigits,
  formatToman,
  tomanToRial,
  rialToToman,
  formatNumber,
} from "./format";

describe("toFaDigits", () => {
  it("converts english digits to persian", () => {
    expect(toFaDigits("0123456789")).toBe("۰۱۲۳۴۵۶۷۸۹");
  });

  it("accepts numbers", () => {
    expect(toFaDigits(42)).toBe("۴۲");
  });

  it("leaves non-digit characters untouched", () => {
    expect(toFaDigits("1,500")).toBe("۱,۵۰۰");
  });
});

describe("toEnDigits", () => {
  it("converts persian digits to english", () => {
    expect(toEnDigits("۰۱۲۳۴۵۶۷۸۹")).toBe("0123456789");
  });

  it("converts arabic digits to english", () => {
    expect(toEnDigits("٠١٢٣٤٥٦٧٨٩")).toBe("0123456789");
  });

  it("returns empty string for falsy input", () => {
    expect(toEnDigits("")).toBe("");
  });
});

describe("tomanToRial / rialToToman", () => {
  it("converts toman to rial (x10)", () => {
    expect(tomanToRial(1500)).toBe(15000);
  });

  it("converts rial to toman (/10)", () => {
    expect(rialToToman(15000)).toBe(1500);
  });

  it("is round-trip stable for whole toman amounts", () => {
    expect(rialToToman(tomanToRial(987654))).toBe(987654);
  });

  it("rounds rial-to-toman conversion", () => {
    // 15004 rial -> 1500.4 toman -> rounds to 1500
    expect(rialToToman(15004)).toBe(1500);
    // 15006 rial -> 1500.6 toman -> rounds to 1501
    expect(rialToToman(15006)).toBe(1501);
  });
});

describe("formatToman", () => {
  it("converts rial to toman with persian thousand separators and label", () => {
    expect(formatToman(15000)).toBe("۱,۵۰۰ تومان");
  });

  it("omits the label when withLabel is false", () => {
    expect(formatToman(15000, false)).toBe("۱,۵۰۰");
  });

  it("treats null/undefined as zero", () => {
    expect(formatToman(null)).toBe("۰ تومان");
    expect(formatToman(undefined)).toBe("۰ تومان");
  });

  it("formats large amounts correctly", () => {
    // 12,345,670 rial -> 1,234,567 toman
    expect(formatToman(12345670, false)).toBe("۱,۲۳۴,۵۶۷");
  });
});

describe("formatNumber", () => {
  it("formats numbers with persian thousand separators", () => {
    expect(formatNumber(1234567)).toBe("۱,۲۳۴,۵۶۷");
  });

  it("treats null/undefined as zero", () => {
    expect(formatNumber(null)).toBe("۰");
    expect(formatNumber(undefined)).toBe("۰");
  });
});
