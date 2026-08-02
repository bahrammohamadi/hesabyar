import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getTrialStatus, TRIAL_TOTAL_DAYS } from "../lib/trial";

const NOW = new Date("2026-08-02T12:00:00Z");
const inDays = (d: number) => new Date(NOW.getTime() + d * 86_400_000).toISOString();
const inHours = (h: number) => new Date(NOW.getTime() + h * 3_600_000).toISOString();

describe("وضعیت دوره‌ی تست", () => {
  it("بدون تاریخ پایان چیزی نشان داده نمی‌شود", () => {
    // سازمان‌های قدیمی و پولی trial_ends_at ندارند.
    expect(getTrialStatus(null, NOW).visible).toBe(false);
    expect(getTrialStatus(undefined, NOW).visible).toBe(false);
    expect(getTrialStatus("", NOW).visible).toBe(false);
  });

  it("تاریخ خراب کل هدر را نمی‌شکند", () => {
    expect(getTrialStatus("not-a-date", NOW).visible).toBe(false);
  });

  it("سه حالت رنگی طبق آستانه‌ها", () => {
    expect(getTrialStatus(inDays(14), NOW).tone).toBe("success");
    expect(getTrialStatus(inDays(8), NOW).tone).toBe("success");
    expect(getTrialStatus(inDays(7), NOW).tone).toBe("warning"); // مرز
    expect(getTrialStatus(inDays(4), NOW).tone).toBe("warning");
    expect(getTrialStatus(inDays(3), NOW).tone).toBe("danger");  // مرز
    expect(getTrialStatus(inDays(1), NOW).tone).toBe("danger");
  });

  it("تست منقضی‌شده حالت expired دارد و روز منفی نمی‌شود", () => {
    const s = getTrialStatus(inDays(-5), NOW);
    expect(s.tone).toBe("expired");
    expect(s.isExpired).toBe(true);
    // اگر منفی برمی‌گشت، «۵- روز باقی مانده» نمایش داده می‌شد.
    expect(s.daysLeft).toBe(0);
    expect(s.visible).toBe(true);
  });

  it("چند ساعت باقی‌مانده «۱ روز» است نه «۰ روز»", () => {
    // ceil لازم است: با floor کاربرِ ۱۰ ساعت مانده «۰ روز» می‌دید
    // و فکر می‌کرد اعتبارش تمام شده.
    const s = getTrialStatus(inHours(10), NOW);
    expect(s.daysLeft).toBe(1);
    expect(s.isExpired).toBe(false);
    expect(s.hoursLeft).toBe(10);
  });

  it("پیشرفت همیشه بین صفر و یک می‌ماند", () => {
    expect(getTrialStatus(inDays(14), NOW).progress).toBeCloseTo(0, 5);
    expect(getTrialStatus(inDays(7), NOW).progress).toBeCloseTo(0.5, 1);
    // بیش از طول دوره یا خیلی منقضی → کلمپ
    expect(getTrialStatus(inDays(-99), NOW).progress).toBe(1);
    expect(getTrialStatus(inDays(99), NOW).progress).toBe(0);
  });

  it("طول دوره با مقدار دیتابیس هم‌خوان است", () => {
    expect(TRIAL_TOTAL_DAYS).toBe(14);
    const sql = readFileSync(
      join(__dirname, "..", "supabase/migrations/0026_instant_activation_trial.sql"),
      "utf8"
    );
    // اگر یکی عوض شود و دیگری نه، شمارنده دروغ می‌گوید.
    expect(sql).toContain("select 14;");
  });
});

describe("کامپوننت شمارنده", () => {
  const src = readFileSync(
    join(__dirname, "..", "components/shared/trial-countdown.tsx"),
    "utf8"
  );
  const shell = readFileSync(
    join(__dirname, "..", "components/shared/app-shell.tsx"),
    "utf8"
  );

  it("در AppShell ثبت شده است", () => {
    expect(shell).toContain("<TrialCountdown />");
  });

  it("فقط توکن معنایی استفاده می‌کند", () => {
    expect(src).not.toMatch(/slate-|rose-|emerald-|#[0-9a-fA-F]{6}/);
  });

  it("ارقام فارسی نمایش می‌دهد", () => {
    expect(src).toContain("toFaDigits");
  });

  it("انیمیشن با prefers-reduced-motion خاموش می‌شود", () => {
    expect(src).toContain("motion-reduce:transition-none");
  });

  it("برای صفحه‌خوان اعلام می‌شود", () => {
    expect(src).toContain('role="status"');
    expect(src).toContain('aria-live="polite"');
  });
});
