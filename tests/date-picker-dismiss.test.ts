import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { nextDay, rangeBounds, hasRange, withinRange, EMPTY_RANGE } from "../src/shared/ui/date-range-utils";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("بستن تقویم با کلیک بیرون", () => {
  const src = read("components/shared/date-picker.tsx");

  /*
    باگ گزارش‌شده‌ی کاربر:
      «روی از تاریخ کلیک می‌کنم، جای خالی صفحه را می‌زنم و پنجره
       بسته نمی‌شود؛ یا باید تاریخ انتخاب کنم یا دوباره روی باکس بزنم.»
    این تست‌ها ضمانت می‌کنند رفتار برنگردد.
  */

  it("شنونده‌ی کلیکِ بیرون دارد", () => {
    expect(src).toContain('addEventListener("pointerdown"');
  });

  it("از pointerdown استفاده می‌کند نه click", () => {
    /*
      اگر click بود، روی میان‌برهایی مثل «این ماه» ترتیب رویدادها
      باعث می‌شد اول کلیک روی دکمه ثبت شود و بعد تقویم بسته شود؛
      pointerdown زودتر می‌آید و چیدمان پیش از mouseup ثابت می‌شود.
    */
    expect(src).not.toContain('addEventListener("click", onPointerDown');
  });

  it("در فاز capture گوش می‌دهد", () => {
    // پنل و مودال رویدادها را در فاز حباب متوقف می‌کنند.
    expect(src).toMatch(/addEventListener\("pointerdown", onPointerDown, true\)/);
  });

  it("کلیک داخل خود تقویم آن را نمی‌بندد", () => {
    expect(src).toContain("rootRef.current?.contains(target)");
    expect(src).toContain("ref={rootRef}");
  });

  it("Escape می‌بندد ولی رویداد را بالاتر نمی‌فرستد", () => {
    // وگرنه یک Escape هم تقویم و هم پنل فروش زیرش را می‌بست.
    expect(src).toContain('event.key !== "Escape"');
    expect(src).toContain("event.stopPropagation()");
  });

  it("شنونده‌ها هنگام بسته‌شدن پاک می‌شوند", () => {
    expect(src).toContain('removeEventListener("pointerdown", onPointerDown, true)');
    expect(src).toContain('removeEventListener("keydown", onKeyDown, true)');
  });

  it("کلیکِ بستن به عنصر زیرش نمی‌رسد", () => {
    /*
      🔴 در تست واقعی با Playwright دیده شد: تقویمِ «از تاریخ» در
      /sales باز بود، کلیک روی ناحیه‌ی خالی روی یک ردیف جدول افتاد و
      پنل فاکتور فروش باز شد. کاربر فقط می‌خواست تقویم را ببندد.
    */
    expect(src).toContain("function swallow");
    expect(src).toContain('addEventListener("click", swallow, true)');
  });

  it("شنونده‌ی بلعنده نشت نمی‌کند", () => {
    // بدون این، کلیکِ بعدیِ کاملاً بی‌ربط کاربر هم بلعیده می‌شد.
    expect(src).toContain('removeEventListener("click", swallow, true)');
  });

  it("جابه‌جایی به تقویم دیگر یک کلیک است نه دو کلیک", () => {
    // در فیلتر بازه، کاربر مدام بین «از تاریخ» و «تا تاریخ» می‌رود.
    expect(src).toContain('closest?.("[data-datepicker-trigger]")');
    expect(src).toContain("data-datepicker-trigger");
  });

  it("popover نقش dialog و نام دارد", () => {
    expect(src).toContain('role="dialog"');
    expect(src).toContain('aria-label="انتخاب تاریخ"');
  });

  it("دکمه‌ی بازکننده وضعیتش را اعلام می‌کند", () => {
    expect(src).toContain("aria-expanded={open}");
  });

  it("دکمه‌های ماه قبل/بعد نام دسترس‌پذیر دارند", () => {
    // axe این را critical/button-name گزارش می‌کرد.
    expect(src).toContain('aria-label="ماه قبل"');
    expect(src).toContain('aria-label="ماه بعد"');
    expect(src).toContain('aria-label="تاریخ را تایپ کنید"');
  });

  it("وقتی تقویم بسته است اصلاً شنونده‌ای ثبت نمی‌شود", () => {
    // useEffect باید زودهنگام برگردد؛ ده‌ها DatePicker در یک صفحه ممکن است باشد.
    expect(src).toMatch(/if \(!open\) return;[\s\S]{0,400}onPointerDown/);
  });
});

describe("کران‌های بازه روی ستون timestamptz", () => {
  /*
    🔴 باگ واقعی که با کوئری روی دیتابیس زنده پیدا شد:
      `sales.date` از نوع `timestamp with time zone` است، نه `date`.
      هر ۲۰ فاکتور موجود ساعت ۰۸:۳۰ ثبت شده‌اند.
      شمارش واقعی برای بازه‌ی «۲۸ تیر تا ۲۸ تیر»:
        lte  → ۰ ردیف   (غلط)
        lt+1 → ۱ ردیف   (درست)
  */

  it("nextDay روز بعد را می‌دهد", () => {
    expect(nextDay("2026-08-03")).toBe("2026-08-04");
  });

  it("nextDay از مرز ماه رد می‌شود", () => {
    expect(nextDay("2026-07-31")).toBe("2026-08-01");
  });

  it("nextDay از مرز سال رد می‌شود", () => {
    expect(nextDay("2026-12-31")).toBe("2027-01-01");
  });

  it("nextDay سال کبیسه را می‌فهمد", () => {
    expect(nextDay("2028-02-28")).toBe("2028-02-29");
    expect(nextDay("2027-02-28")).toBe("2027-03-01");
  });

  it("کران بالا lt است نه lte", () => {
    const b = rangeBounds({ from: "2026-07-28", to: "2026-07-28" });
    expect(b.gte).toBe("2026-07-28");
    expect(b.lt).toBe("2026-07-29");
  });

  it("بازه‌ی خالی هیچ کرانی نمی‌سازد", () => {
    expect(rangeBounds(EMPTY_RANGE)).toEqual({});
  });

  it("فقط شروع یا فقط پایان هم درست کار می‌کند", () => {
    expect(rangeBounds({ from: "2026-01-01", to: "" })).toEqual({ gte: "2026-01-01" });
    expect(rangeBounds({ from: "", to: "2026-01-01" })).toEqual({ lt: "2026-01-02" });
  });

  it("رکورد ساعت‌دارِ روز پایانی داخل بازه می‌ماند", () => {
    // همان سناریوی واقعی: فاکتور ۲۸ تیر ساعت ۰۸:۳۰
    const b = rangeBounds({ from: "2026-07-28", to: "2026-07-28" });
    const stamp = "2026-07-28T08:30:00+00:00";
    expect(stamp >= b.gte!).toBe(true);
    expect(stamp < b.lt!).toBe(true);
  });

  it("hasRange فقط وقتی فیلتری هست true می‌دهد", () => {
    expect(hasRange(EMPTY_RANGE)).toBe(false);
    expect(hasRange({ from: "2026-01-01", to: "" })).toBe(true);
    expect(hasRange({ from: "", to: "2026-01-01" })).toBe(true);
  });

  it("withinRange با timestamp کامل هم درست است", () => {
    const r = { from: "2026-07-28", to: "2026-07-28" };
    expect(withinRange("2026-07-28T08:30:00+00:00", r)).toBe(true);
    expect(withinRange("2026-07-29T00:00:00+00:00", r)).toBe(false);
  });
});

describe("گسترش فیلتر بازه به بخش‌های دیگر", () => {
  const pages: [string, string][] = [
    ["انبار", "components/shared/inventory-operation-page.tsx"],
    ["مالی", "components/shared/finance-operation-page.tsx"],
    ["چک‌ها", "app/(app)/checks/page.tsx"],
    ["فعالیت‌ها", "app/(app)/activity/page.tsx"],
    ["مرجوعی فروش", "app/(app)/sales/returns/page.tsx"],
    ["مرجوعی خرید", "app/(app)/purchases/returns/page.tsx"],
  ];

  it.each(pages)("%s فیلتر بازه دارد", (_label, path) => {
    expect(read(path)).toContain("<DateRangeFilter");
  });

  it("فروش و خرید دیگر از lte استفاده نمی‌کنند", () => {
    for (const p of ["app/(app)/sales/page.tsx", "app/(app)/purchases/page.tsx"]) {
      const src = read(p);
      expect(src).toContain('applyRange(base, "date", range)');
      expect(src).not.toContain('.lte("date"');
    }
  });

  it("صفحاتی که limit دارند فیلتر را سمت سرور می‌زنند", () => {
    /*
      فیلتر محلی روی فهرستی که limit دارد غلط است: فقط همان ردیف‌های
      آخر را می‌بیند و بازه‌های قدیمی خالی درمی‌آیند.
    */
    expect(read("components/shared/inventory-operation-page.tsx")).toContain('applyRange(q, "created_at", range)');
    expect(read("components/shared/finance-operation-page.tsx")).toContain('applyRange(q, "date", range)');
  });

  it("بازه در کلید کش react-query هست", () => {
    for (const p of [
      "components/shared/inventory-operation-page.tsx",
      "components/shared/finance-operation-page.tsx",
      "app/(app)/activity/page.tsx",
    ]) {
      expect(read(p)).toMatch(/queryKey: \[[^\]]*range\.from, range\.to\]/);
    }
  });

  it("سقف نتایج با فعال‌شدن فیلتر بالا می‌رود", () => {
    for (const p of [
      "app/(app)/sales/page.tsx",
      "app/(app)/purchases/page.tsx",
      "components/shared/inventory-operation-page.tsx",
      "components/shared/finance-operation-page.tsx",
    ]) {
      expect(read(p)).toMatch(/limit\(hasRange\(range\) \? \d+ : \d+\)/);
    }
  });

  it("API فعالیت‌ها ورودی تاریخ را اعتبارسنجی می‌کند", () => {
    const src = read("app/api/activity/route.ts");
    // مقدار مستقیم وارد فیلتر PostgREST می‌شود؛ فقط شکل دقیق ISO مجاز است.
    expect(src).toContain("/^\\d{4}-\\d{2}-\\d{2}$/");
    expect(src).toContain('q.lt("created_at", next)');
    expect(src).not.toContain('lte("created_at"');
  });

  it("چک‌ها روی سررسید فیلتر می‌شوند نه تاریخ ثبت", () => {
    const src = read("app/(app)/checks/page.tsx");
    expect(src).toContain("withinRange(c.due_date, range)");
    expect(src).toContain("بازه بر اساس تاریخ سررسید");
  });
});
