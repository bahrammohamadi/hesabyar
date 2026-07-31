import { describe, expect, it } from "vitest";
import { boundedInt, isUuid, safeDate } from "../lib/security/api-guard";
import { hit } from "../lib/security/rate-limit";

describe("input validation guards", () => {
  it("accepts a valid uuid and rejects injection-ish strings", () => {
    expect(isUuid("ec60535d-6372-428a-92fe-06f1eb63f4b7")).toBe(true);
    expect(isUuid("' OR 1=1 --")).toBe(false);
    expect(isUuid("../../etc/passwd")).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid(null)).toBe(false);
    expect(isUuid(12345)).toBe(false);
  });

  it("clamps out-of-range and non-numeric limits", () => {
    expect(boundedInt("50", 1, 200, 100)).toBe(50);
    // مقدار بزرگ برای خالی‌کردن دیتابیس → به سقف محدود می‌شود
    expect(boundedInt("999999", 1, 200, 100)).toBe(200);
    expect(boundedInt("-5", 1, 200, 100)).toBe(1);
    expect(boundedInt("abc", 1, 200, 100)).toBe(100);
    expect(boundedInt(null, 1, 200, 100)).toBe(100);
    expect(boundedInt("NaN", 1, 200, 100)).toBe(100);
    expect(boundedInt(Infinity, 1, 200, 100)).toBe(100);
  });

  it("rejects invalid dates instead of producing Invalid Date", () => {
    expect(safeDate("2026-07-31T00:00:00")).toContain("2026-07-31");
    expect(safeDate("not-a-date")).toBeNull();
    expect(safeDate("")).toBeNull();
    expect(safeDate(null)).toBeNull();
    // ورودی بسیار بلند رد می‌شود (جلوگیری از پردازش سنگین)
    expect(safeDate("2026-01-01".repeat(20))).toBeNull();
  });
});

describe("rate limiter", () => {
  it("allows requests under the limit and blocks past it", () => {
    const key = `test-under-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      expect(hit(key, { limit: 5, windowSeconds: 60 }).allowed).toBe(true);
    }
    const blocked = hit(key, { limit: 5, windowSeconds: 60 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("keeps separate counters per key so one IP cannot lock out another", () => {
    const a = `test-a-${Math.random()}`;
    const b = `test-b-${Math.random()}`;
    for (let i = 0; i < 3; i++) hit(a, { limit: 3, windowSeconds: 60 });
    expect(hit(a, { limit: 3, windowSeconds: 60 }).allowed).toBe(false);
    // کلید دیگر نباید تحت تأثیر باشد
    expect(hit(b, { limit: 3, windowSeconds: 60 }).allowed).toBe(true);
  });

  it("reports decreasing remaining quota", () => {
    const key = `test-remaining-${Math.random()}`;
    expect(hit(key, { limit: 3, windowSeconds: 60 }).remaining).toBe(2);
    expect(hit(key, { limit: 3, windowSeconds: 60 }).remaining).toBe(1);
    expect(hit(key, { limit: 3, windowSeconds: 60 }).remaining).toBe(0);
  });
});
