import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("🔴 باگ‌هایی که با بازرسی خودکار پیدا شدند", () => {
  it("صفحه‌ی /inventory/out وجود دارد", () => {
    /*
      سایدبار به /inventory/out لینک می‌داد («خروج کالا») ولی فایلش
      نبود — هر کلیک یک ۴۰۴. خودِ کامپوننت mode="out" را پشتیبانی
      می‌کرد و فقط دو خط کم بود.

      پیش‌واکشی Next.js لینک را در هر صفحه‌ای که سایدبار باز بود
      می‌گرفت، پس یک ۴۰۴ مداوم در کنسول ثبت می‌شد.
    */
    expect(existsSync(join(root, "app/(app)/inventory/out/page.tsx"))).toBe(true);
    expect(read("app/(app)/inventory/out/page.tsx")).toContain('mode="out"');
  });

  it("هر لینک سایدبار یک صفحه‌ی واقعی دارد", () => {
    // این تست همان دسته باگ را برای همیشه می‌گیرد.
    const src = read("components/shared/sidebar.tsx");
    const hrefs = [...src.matchAll(/href:\s*"(\/[a-z0-9/\-[\]]+)"/gi)]
      .map((m) => m[1])
      .filter((h) => !h.includes("?") && !h.includes("["));

    const missing = hrefs.filter((h) => {
      const base = join(root, "app/(app)" + h);
      return !existsSync(join(base, "page.tsx")) && !existsSync(base + ".tsx");
    });
    expect(missing, `صفحه ندارند: ${missing.join(", ")}`).toEqual([]);
  });

  it("کوئری دسته‌بندی از ستون ناموجود استفاده نمی‌کند", () => {
    /*
      `.eq("is_active", true)` روی categories همیشه HTTP 400 می‌داد —
      آن جدول اصلاً چنین ستونی ندارد (برخلاف brands).

      نتیجه: فیلتر دسته‌بندی در انتخابگر کالا همیشه خالی بود و کاربر
      فکر می‌کرد هیچ دسته‌ای تعریف نشده.
    */
    const src = read("components/shared/product-selector.tsx");
    expect(src).not.toMatch(/from\("categories"\)[^;]*is_active/);
  });

  it("نماهای گزارش گمشده بازسازی شده‌اند", () => {
    /*
      مهاجرت ۰۰۰۸ پنج نما را drop و دوباره create می‌کرد. در دیتابیس
      زنده فقط دو تای آخر وجود داشتند — یعنی نیمه‌کاره اجرا شده بود.
      نتیجه: /reports/profit دو بار ۴۰۴ می‌گرفت.
    */
    const mig = read("supabase/migrations/0034_restore_missing_report_views.sql");
    for (const v of ["top_selling_products", "sales_by_category", "low_selling_products"]) {
      expect(mig).toContain(`create or replace view public.${v}`);
    }
  });

  it("گزارش‌ها فاکتورهای تسویه‌شده را حذف نمی‌کنند", () => {
    /*
      تعریف قدیمی فقط status = 'confirmed' را می‌شمرد. اندازه‌گیری:
      ۲ فاکتور از ۲۱ وضعیت 'settled' دارند — یعنی هرچه کسب‌وکار منظم‌تر
      تسویه کند، آمار فروشش کمتر نشان داده می‌شود.

      به‌جای فهرست سفید، وضعیت‌های باطل حذف می‌شوند تا وضعیت تازه‌ی
      احتمالی به‌طور پیش‌فرض در گزارش بیاید.
    */
    const mig = read("supabase/migrations/0034_restore_missing_report_views.sql");
    expect(mig).not.toContain("s.status = 'confirmed'");
    expect(mig).toContain("not in ('cancelled', 'returned', 'reversed', 'draft')");
  });
});

describe("نمای آمار مصرف", () => {
  const mig = read("supabase/migrations/0035_org_usage_stats.sql");

  it("همه‌ی شمارنده‌های لازم را دارد", () => {
    for (const col of [
      "users_count", "products_count", "variants_count", "contacts_count",
      "sales_count", "purchases_count", "transactions_count", "movements_count",
    ]) {
      expect(mig).toContain(col);
    }
  });

  it("فعالیت ۳۰ روز اخیر جدا از کل شمرده می‌شود", () => {
    /*
      سازمانی با ۵۰۰ فاکتور قدیمی و صفر فاکتور ماه اخیر «بزرگ» به نظر
      می‌رسد ولی در واقع رهاشده است.
    */
    expect(mig).toContain("sales_30d");
    expect(mig).toContain("revenue_30d");
    expect(mig).toContain("interval '30 days'");
  });

  it("درآمد ۳۰ روزه فاکتورهای باطل را نمی‌شمارد", () => {
    // شرط قبل از نام مستعار ستون می‌آید، نه بعدش.
    expect(mig).toMatch(/not in \('cancelled'[\s\S]{0,120}as revenue_30d/);
  });

  it("آخرین فعالیت از همه‌ی جدول‌های عملیاتی می‌آید", () => {
    // فقط فروش کافی نیست: کسب‌وکاری ممکن است خرید و انبارگردانی کند.
    expect(mig).toContain("greatest(");
    for (const t of ["sales", "purchases", "transactions", "stock_movements"]) {
      expect(mig).toMatch(new RegExp(`max\\([a-z]+\\.created_at\\)[\\s\\S]{0,80}${t}`));
    }
  });

  it("🔴 نما definer است چون به auth.users دست می‌زند", () => {
    /*
      auth.users به هیچ نقشی SELECT نداده — حتی service_role. با
      security_invoker=true خطای «permission denied for table users»
      می‌گرفتیم. همان درس مهاجرت ۰۰۲۸.
    */
    expect(mig).toContain("auth.users");
    expect(mig).not.toMatch(/v_org_usage[\s\S]{0,200}security_invoker\s*=\s*true/);
    expect(mig).toContain("revoke all on public.v_org_usage from anon, authenticated");
    expect(mig).toContain("grant select on public.v_org_usage to service_role");
  });
});

describe("API و رابط آمار مصرف", () => {
  const route = read("app/api/admin/usage/route.ts");
  const page = read("app/(app)/admin/usage/page.tsx");

  it("مجوز orgs.view لازم است", () => {
    expect(route).toContain('requirePlatformPermission("orgs.view")');
  });

  it("سازمان تازه هرگز «رهاشده» علامت نمی‌خورد", () => {
    // هنوز فرصت شروع نداشته است.
    expect(route).toContain('if (ageDays < 7) return "new"');
  });

  it("سازمانی که اصلاً شروع نکرده از رهاشده جدا می‌شود", () => {
    /*
      دو حالت متفاوت‌اند: یکی هرگز شروع نکرده (مشکل onboarding)، دیگری
      شروع کرده و رها کرده (مشکل نگهداشت). پاسخ پشتیبانی به هرکدام فرق
      دارد.
    */
    expect(route).toContain('return "empty"');
    expect(route).toContain('return "idle"');
  });

  it("صفحه در سایدبار پلتفرم هست", () => {
    expect(read("components/shared/sidebar.tsx")).toContain("/admin/usage");
  });

  it("فیلتر وضعیت و جستجو دارد", () => {
    expect(page).toContain("FilterChip");
    expect(page).toContain('aria-label="جستجوی کسب‌وکار"');
  });

  it("هر وضعیت توضیح دارد", () => {
    // «رهاشده» بدون توضیح یعنی ادمین باید حدس بزند معیار چیست.
    expect(page).toContain("hint:");
    expect(page).toContain("بیش از ۳۰ روز");
  });
});
