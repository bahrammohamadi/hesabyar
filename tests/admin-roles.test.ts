import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const sql = read("supabase/migrations/0027_admin_roles_audit.sql");
const guard = read("lib/security/api-guard.ts");

describe("نقش‌های ادمین پلتفرم", () => {
  it("چهار سطح دسترسی تعریف شده", () => {
    expect(sql).toContain("check (role in ('super_admin', 'support', 'finance', 'readonly'))");
  });

  it("نقش قبلی admin به super_admin نگاشت می‌شود", () => {
    /*
      🔴 بدون این، حساب فعلی مالک محصول با قید جدید نامعتبر می‌شد و
      دسترسی‌اش را از دست می‌داد. قید قدیمی هم باید اول برداشته شود
      وگرنه خود UPDATE رد می‌شد.
    */
    expect(sql).toContain("drop constraint if exists platform_admins_role_check");
    expect(sql).toContain("update public.platform_admins set role = 'super_admin' where role = 'admin'");
    const dropIdx = sql.indexOf("drop constraint if exists platform_admins_role_check");
    const updIdx = sql.indexOf("update public.platform_admins set role = 'super_admin'");
    expect(dropIdx).toBeLessThan(updIdx);
  });

  it("ماتریس مجوز در دیتابیس متمرکز است", () => {
    // تک‌منبع حقیقت تا هر روت تفسیر خودش را نداشته باشد.
    expect(sql).toContain("function public.platform_admin_can");
    for (const perm of [
      "orgs.view", "orgs.approve", "orgs.suspend",
      "trial.extend", "plan.change", "invoice.modify", "admins.manage",
    ]) {
      expect(sql).toContain(`'${perm}'`);
    }
  });

  it("support اجازه‌ی تعلیق و تغییر فاکتور ندارد", () => {
    expect(sql).toContain("when 'orgs.suspend'     then v_role in ('super_admin')");
    expect(sql).toContain("when 'invoice.modify'   then v_role in ('super_admin')");
  });

  it("مدیریت ادمین‌ها فقط super_admin", () => {
    expect(sql).toContain("when 'admins.manage'    then v_role = 'super_admin'");
  });
});

describe("لاگ ممیزی پلتفرم", () => {
  it("جدول جدا از audit_logs سازمانی است", () => {
    // قاطی‌کردنشان هر دو گزارش را خراب می‌کرد.
    expect(sql).toContain("create table if not exists public.platform_audit_logs");
    expect(sql).toContain("actor_id");
    expect(sql).toContain("actor_role");
  });

  it("رکورد ممیزی تغییرناپذیر است جز ip", () => {
    expect(sql).toContain("function public.guard_audit_immutable");
    expect(sql).toContain("رکورد ممیزی تغییرناپذیر است");
    expect(sql).toContain("create trigger trg_audit_immutable");
  });

  it("نمای ممیزی security_invoker ندارد", () => {
    /*
      🔴 با invoker، نما با مجوز فراخوان اجرا می‌شد و service_role
      حق خواندن auth.users نداشت:
        ERROR 42501: permission denied for table users
      این فقط در تست واقعی از سمت روت API دیده شد؛ همان کوئری در
      SQL Editor (نقش postgres) بی‌مشکل بود.
    */
    const view = sql.slice(
      sql.indexOf("create or replace view public.v_platform_audit"),
      sql.indexOf("-- بخش ۴")
    );
    expect(view).not.toContain("security_invoker");
    // در عوض دسترسی صریح محدود شده
    expect(sql).toContain("revoke all on public.v_platform_audit from anon, authenticated");
  });

  it("همه‌ی عملیات مدیریتی لاگ می‌شوند", () => {
    for (const action of ["org.approve", "org.reject", "org.suspend", "org.reactivate", "trial.extend"]) {
      expect(sql).toContain(`'${action}'`);
    }
  });

  it("RPCها مجوز ریزدانه را چک می‌کنند نه فقط ادمین‌بودن", () => {
    expect(sql).toContain("platform_admin_can('orgs.approve', v_actor)");
    expect(sql).toContain("platform_admin_can('orgs.suspend', v_actor)");
    expect(sql).toContain("platform_admin_can('trial.extend', v_actor)");
  });
});

describe("گارد روت‌های API", () => {
  it("requirePlatformPermission با fail-closed", () => {
    expect(guard).toContain("export async function requirePlatformPermission");
    // خطای RPC هم باید یعنی «مجاز نیست»
    expect(guard).toContain("if (error || allowed !== true) return { response: forbidden() }");
  });

  it("IP از x-forwarded-for خوانده می‌شود", () => {
    // پشت پراکسی Vercel آدرس واقعی آنجاست.
    expect(guard).toContain('request.headers.get("x-forwarded-for")');
  });

  it("هر عمل به مجوز صریح نگاشت شده", () => {
    const route = read("app/api/admin/organizations/[id]/route.ts");
    expect(route).toContain("const NEEDS: Record<string, string>");
    expect(route).toContain('suspend: "orgs.suspend"');
    expect(route).toContain('extend_trial: "trial.extend"');
    // عمل ناشناخته نباید از گارد رد شود
    expect(route).toContain('if (!permission)');
  });

  it("رکورد ممیزی تکراری ساخته نمی‌شود", () => {
    /*
      نسخه‌ی اول برای ثبت IP یک رکورد دوم می‌ساخت؛ گزارش برای هر
      عمل دو ردیف نشان می‌داد (یکی بدون هدف و بدون برچسب فارسی).
    */
    const route = read("app/api/admin/organizations/[id]/route.ts");
    expect(route).not.toContain("`${action}.request`");
    expect(route).toContain('.update({ ip })');
  });
});

describe("رابط کاربری پنل ادمین", () => {
  it("ماتریس مجوز سمت کلاینت با دیتابیس هم‌خوان است", () => {
    const page = read("app/(app)/admin/organizations/[id]/page.tsx");
    expect(page).toContain('"orgs.suspend": ["super_admin"]');
    expect(page).toContain('"orgs.approve": ["super_admin", "support"]');
    expect(page).toContain('"trial.extend": ["super_admin", "support", "finance"]');
  });

  it("زیربخش‌های پنل ادمین ثبت شده‌اند", () => {
    const layout = read("app/(app)/admin/layout.tsx");
    expect(layout).toContain("/admin/organizations");
    expect(layout).toContain("/admin/audit");
  });

  it("صفحه‌ی گزارش فقط‌خواندنی است", () => {
    const page = read("app/(app)/admin/audit/page.tsx");
    expect(page).not.toContain("method: \"POST\"");
    expect(page).not.toContain("method: \"DELETE\"");
  });
});
