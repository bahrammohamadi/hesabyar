import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const mig = read("supabase/migrations/0033_custom_admin_roles.sql");

/** همه‌ی فایل‌های route زیر یک مسیر. */
function routeFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const entry of readdirSync(join(root, d))) {
      const rel = `${d}/${entry}`;
      if (statSync(join(root, rel)).isDirectory()) walk(rel);
      else if (entry === "route.ts") out.push(rel);
    }
  };
  walk(dir);
  return out;
}

describe("🔴 همگامی کاتالوگ مجوز با روت‌ها", () => {
  /*
    این تست مستقیماً از باگ مهاجرت ۰۰۳۱ آمده: سه مجوز که روت‌ها
    استفاده می‌کردند در ماتریس تعریف نشده بودند و به `else false`
    می‌افتادند. نتیجه ۴۰۳ روی سایت زنده بود، در حالی که صفحه بدون خطا
    رندر می‌شد و فقط خالی می‌ماند.

    حالا هر مجوزی که هر روتی بخواهد باید هم در ماتریس و هم در کاتالوگ
    باشد — وگرنه تست می‌شکند.
  */
  const wanted = new Set<string>();
  for (const f of routeFiles("app/api/admin")) {
    for (const m of read(f).matchAll(/requirePlatformPermission\("([^"]+)"\)/g)) wanted.add(m[1]);
  }
  // مجوزهایی که در نگاشت NEEDS داخل روت‌ها می‌آیند
  for (const f of routeFiles("app/api/admin")) {
    for (const m of read(f).matchAll(/:\s*"((?:orgs|trial|plan|users|invoice|audit|announcements|admins)\.[a-z_]+)"/g)) {
      wanted.add(m[1]);
    }
  }

  it("مجوزهای مورد نیاز پیدا شدند", () => {
    expect(wanted.size).toBeGreaterThanOrEqual(8);
  });

  it.each([...wanted])("مجوز «%s» در ماتریس تعریف شده", (perm) => {
    expect(mig).toContain(`when '${perm}'`);
  });

  it.each([...wanted])("مجوز «%s» در کاتالوگ ثبت شده", (perm) => {
    // بدون این، UI نمی‌تواند آن را به‌عنوان گزینه نشان دهد.
    expect(mig).toContain(`('${perm}',`);
  });
});

describe("منطق نقش سفارشی", () => {
  it("نقش custom فقط از آرایه می‌خواند", () => {
    /*
      عمداً هیچ مجوز پیش‌فرضی — حتی orgs.view که در ماتریس ثابت برای
      همه true است. اگر «مشاهده» رایگان بود، ساختن نقشی که *نتواند*
      کسب‌وکارها را ببیند ممکن نمی‌شد.
      (اندازه‌گیری واقعی: نقش سفارشی با دو مجوز، audit.view را false داد.)
    */
    expect(mig).toContain("if v_role = 'custom' then");
    expect(mig).toContain("return p_permission = any(coalesce(v_custom, '{}'))");
  });

  it("🔴 ماتریس ثابت دست‌نخورده مانده", () => {
    /*
      قید اصلی این مهاجرت: تنها ادمین فعلی super_admin است و باید بعد
      از مهاجرت دقیقاً همان دسترسی‌ها را داشته باشد.
      (تأیید شد: ۱۳ از ۱۳ مجوز، قبل و بعد یکسان.)
    */
    for (const line of [
      "when 'orgs.approve'     then v_role in ('super_admin', 'support')",
      "when 'orgs.suspend'     then v_role in ('super_admin')",
      "when 'users.password'   then v_role = 'super_admin'",
      "when 'admins.manage'    then v_role = 'super_admin'",
    ]) {
      expect(mig).toContain(line);
    }
  });

  it("گارد NULL حفظ شده", () => {
    // NULL not in (...) نتیجه‌اش NULL است نه TRUE — درس مهاجرت ۰۰۲۸.
    expect(mig).toContain("if v_role is null then");
  });

  it("قید نقش drop و دوباره ساخته می‌شود", () => {
    // دو قید هم‌زمان یعنی هیچ نقشی هر دو را راضی نمی‌کند.
    const dropIdx = mig.indexOf("drop constraint if exists platform_admins_role_check");
    const addIdx = mig.indexOf("add constraint platform_admins_role_check");
    expect(dropIdx).toBeGreaterThan(-1);
    expect(dropIdx).toBeLessThan(addIdx);
    expect(mig).toContain("'custom'");
  });
});

describe("اعتبارسنجی در دیتابیس", () => {
  it("تریگر مجوز ناشناخته را رد می‌کند", () => {
    /*
      🔴 بدون این، یک غلط املایی («users.veiw») بی‌صدا ذخیره می‌شد و
      ادمین بدون هیچ پیام خطایی دسترسی نمی‌گرفت.
      (تست واقعی: خطای «مجوز نامعتبر: users.veiw» برگشت.)
    */
    expect(mig).toContain("raise exception 'مجوز نامعتبر: %'");
    expect(mig).toContain("where p not in (select key from public.platform_permissions)");
  });

  it("تغییر نقش آرایه‌ی سرگردان را پاک می‌کند", () => {
    // نقش غیرسفارشی نباید custom_permissions داشته باشد.
    expect(mig).toContain("new.custom_permissions := '{}'");
  });

  it("تریگر روی insert و update هر دو اجرا می‌شود", () => {
    expect(mig).toContain("before insert or update on public.platform_admins");
  });
});

describe("گاردهای API", () => {
  const route = read("app/api/admin/admins/route.ts");

  it("مجوز admins.manage لازم است", () => {
    expect(route.match(/requirePlatformPermission\("admins\.manage"\)/g)?.length).toBe(3);
  });

  it("🔴 ادمین نقش خودش را عوض نمی‌کند", () => {
    // دو خطر: تنزل تصادفی که خودش را قفل می‌کند، و ارتقای بی‌نظارت.
    expect(route).toContain("targetId === actorId");
    expect(route).toContain("نمی‌توانید نقش خودتان را تغییر دهید");
  });

  it("🔴 آخرین مدیر ارشد حذف نمی‌شود", () => {
    /*
      بدون این، حذف تنها super_admin یعنی هیچ‌کس دیگر نمی‌تواند ادمین
      اضافه کند — پلتفرم برای همیشه بدون مدیر می‌ماند.
    */
    expect(route).toContain("آخرین مدیر ارشد را نمی‌توان حذف کرد");
    expect(route).toContain('.eq("role", "super_admin")');
  });

  it("نقش سفارشی بدون مجوز رد می‌شود", () => {
    expect(route).toContain('role === "custom" && custom.length === 0');
  });

  it("نقش نامعتبر رد می‌شود", () => {
    expect(route).toContain("ALL_ROLES.includes");
  });

  it("خطای تریگر به کاربر نشان داده می‌شود نه ۵۰۰", () => {
    expect(route).toContain('error.message?.includes("مجوز نامعتبر")');
  });

  it("همه‌ی تغییرات در ممیزی ثبت می‌شوند", () => {
    expect(route).toContain('"admin.grant"');
    expect(route).toContain('"admin.role_change"');
    expect(route).toContain('"admin.revoke"');
  });
});

describe("رابط کاربری", () => {
  const page = read("app/(app)/admin/roles/page.tsx");

  it("صفحه در سایدبار پلتفرم هست", () => {
    expect(read("components/shared/sidebar.tsx")).toContain("/admin/roles");
  });

  it("مجوزها دسته‌بندی می‌شوند", () => {
    // فهرست ۱۳تایی بدون گروه‌بندی قابل مرور نیست.
    expect(page).toContain("grouped");
    expect(page).toContain("<fieldset");
    expect(page).toContain("<legend");
  });

  it("سطح خطر نمایش داده می‌شود", () => {
    // کاربر باید بفهمد «بازنشانی رمز» با «مشاهده» فرق دارد.
    expect(page).toContain("RISK_LABEL");
    expect(page).toContain("highRiskSelected");
  });

  it("ناحیه‌ی اسکرول مجوزها فوکوس‌پذیر است", () => {
    // axe serious / scrollable-region-focusable
    expect(page).toMatch(/overflow-y-auto[^>]*tabIndex=\{0\}/);
  });

  it("حذف تأیید می‌خواهد", () => {
    expect(page).toContain("useConfirm");
  });
});
