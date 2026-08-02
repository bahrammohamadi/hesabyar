import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compactAxisNumber, tickInterval } from "../src/shared/ui/chart-utils";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

/**
 * باگ: باز کردن انتخابگر کالا از داخل فرم فاکتور، پنل میزبان را
 * می‌بست و کل فاکتور نیمه‌کاره از بین می‌رفت.
 *
 * سه علت مستقل داشت که هر سه باید بسته بمانند.
 */
describe("لایه‌بندی پنل و انتخابگر", () => {
  it("۱) هوک بستن پنل‌ها استثنای owned دارد", () => {
    const hook = read("lib/hooks/useDismissPanels.ts");
    expect(hook).toContain("owned = false");
    expect(hook).toContain("if (owned) return;");
  });

  it("۲) Modal پرچم ownedByPanel را به هوک پاس می‌دهد", () => {
    const modal = read("src/shared/ui/Modal.tsx");
    expect(modal).toContain("ownedByPanel = false");
    expect(modal).toContain("useDismissPanels(open, ownedByPanel)");
  });

  it("۳) مودالِ متعلق به پنل روی لایه‌ی picker می‌نشیند", () => {
    // --z-modal (۱۰۰۰) زیر --z-panel (۱۱۰۰) است؛ انتخابگر باید بالاتر برود.
    const modal = read("src/shared/ui/Modal.tsx");
    expect(modal).toContain('ownedByPanel ? "var(--z-picker)" : "var(--z-modal)"');
  });

  it("۴) PanelHost لایه‌ی picker را inert نمی‌کند", () => {
    /*
      علت اصلی که دیرتر پیدا شد: MutationObserver هر گره‌ی تازه‌ی body
      را inert می‌کرد، از جمله portal انتخابگر. مودال دیده می‌شد ولی
      کلیک‌ناپذیر بود و کلیک به پرده‌ی پنل می‌رسید.
    */
    const host = read("src/core/panel-manager/PanelHost.tsx");
    expect(host).toContain('zIndex.includes("--z-picker")');
  });

  it("۵) Escape فقط بالاترین لایه را می‌بندد", () => {
    // پیش‌تر PanelHost و Modal هر دو روی window گوش می‌دادند، پس یک
    // Escape هم انتخابگر و هم پنل زیرین را می‌بست.
    const modal = read("src/shared/ui/Modal.tsx");
    expect(modal).toContain("event.stopPropagation()");
    expect(modal).toContain('window.addEventListener("keydown", onKey, true)');

    const menu = read("components/shared/portal-menu.tsx");
    expect(menu).toContain("event.stopPropagation()");
    expect(menu).toContain('window.addEventListener("keydown", onKey, true)');
  });

  it("۶) فرم فاکتور انتخابگرهایش را owned علامت می‌زند", () => {
    const form = read("src/shared/panels/InvoiceCreateForm.tsx");
    expect(form).toContain("insidePanel = true");
    expect(form).toContain("ownedByPanel={insidePanel}");
    // هر دو انتخابگر: کالا و مشتری
    expect(form.match(/ownedByPanel=\{insidePanel\}/g)?.length).toBe(2);
  });

  it("۷) صفحه‌های مستقل رفتار قبلی را حفظ می‌کنند", () => {
    // در صفحه‌ی کامل (نه پنل)، بستن پنل‌ها رفتار درستی است.
    for (const p of ["app/(app)/purchases/page.tsx", "app/(app)/inventory/stock-card/page.tsx"]) {
      expect(read(p)).not.toContain("ownedByPanel");
    }
  });
});

describe("ابزار مشترک نمودار", () => {
  it("عدد محور را فشرده و فارسی می‌کند", () => {
    expect(compactAxisNumber(1_500_000)).toContain("م");
    expect(compactAxisNumber(2_000)).toContain("هـ");
    // هیچ رقم لاتینی نباید بماند
    expect(compactAxisNumber(1_500_000)).not.toMatch(/[0-9]/);
    expect(compactAxisNumber(0)).toBe("۰");
  });

  it("عدد منفی را هم درست فشرده می‌کند", () => {
    // Math.abs لازم بود؛ بدون آن زیان‌ها از شاخه رد می‌شدند.
    expect(compactAxisNumber(-2_500_000)).toContain("م");
  });

  it("تعداد تیک روی موبایل کمتر است", () => {
    // با ۳۰ نقطه روی موبایل، برچسب‌ها روی هم می‌افتادند.
    expect(tickInterval(30, true)).toBeGreaterThan(tickInterval(30, false));
    // داده‌ی کم نیازی به حذف تیک ندارد
    expect(tickInterval(3, true)).toBe(0);
  });

  it("نمودارها اسکلت و حالت خالی دارند", () => {
    const page = read("app/(app)/reports/overview-v2/page.tsx");
    expect(page).toContain("<ChartSkeleton />");
    expect(page).toContain("<ChartEmpty");
    expect(page).toContain("chartGradients");
  });

  it("انیمیشن نمودار با prefers-reduced-motion خاموش می‌شود", () => {
    // بلوک سراسری CSS فقط انیمیشن CSS را می‌گیرد؛ Recharts در JS
    // انیمیت می‌کند و باید صریح خاموش شود.
    const kit = read("src/shared/ui/ChartKit.tsx");
    expect(kit).toContain("prefers-reduced-motion: reduce");
    const page = read("app/(app)/reports/overview-v2/page.tsx");
    expect(page.match(/isAnimationActive=\{animate\}/g)?.length).toBe(3);
  });
});
