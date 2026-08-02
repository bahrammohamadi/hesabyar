import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

const sidebar = read("components/shared/sidebar.tsx");
const bottomNav = read("components/shared/bottom-nav.tsx");
const adminLayout = read("app/(app)/admin/layout.tsx");
const migration = read("supabase/migrations/0025_platform_admin_grant_helper.sql");

/**
 * این تست‌ها نگهبان رگرسیون‌اند، نه جایگزین تست واقعی مرورگر.
 *
 * سه اشتباهی که به‌راحتی در آینده تکرار می‌شوند و اینجا گرفته می‌شوند:
 *   ۱. کسی آیتم /admin را داخل NAV ببرد → به همه‌ی کاربران نشان داده شود.
 *   ۲. گارد سمت سرور حذف شود و فقط پنهان‌سازی در UI بماند.
 *   ۳. به توابع grant/revoke دسترسی authenticated داده شود → ارتقای سطح دسترسی.
 */

describe("ناوبری پنل سوپرادمین", () => {
  it("لینک ادمین پشت شرط is_platform_admin است", () => {
    expect(sidebar).toContain("usePlatformAdmin");
    expect(sidebar).toContain("{isPlatformAdmin && (");
    expect(sidebar).toContain("/admin/organizations");
  });

  it("آیتم ادمین بیرون از NAV تعریف شده است", () => {
    // NAV بر پایه‌ی مجوز سازمانی فیلتر می‌شود و can(null) برابر true است؛
    // اگر /admin داخل NAV باشد به همه نشان داده می‌شود.
    const navBlock = sidebar
      .slice(sidebar.indexOf("export const NAV = ["), sidebar.indexOf("const ADMIN_NAV"))
      // کامنت‌ها کنار گذاشته می‌شوند؛ فقط href واقعی مهم است، وگرنه
      // متن توضیحی که واژه‌ی «/admin» دارد تست را الکی قرمز می‌کند.
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*(\/\/|\*).*$/gm, "");
    expect(navBlock).not.toContain('href: "/admin');
    expect(sidebar).toContain("const ADMIN_NAV");
  });

  it("نوار پایین موبایل آیتم ادمین را نمی‌سازد", () => {
    // BottomNav فقط روی NAV حلقه می‌زند، نه ADMIN_NAV.
    expect(bottomNav).not.toContain("ADMIN_NAV");
    expect(bottomNav).not.toContain("/admin");
  });
});

describe("گارد سمت سرور /admin", () => {
  it("با RPC بررسی می‌کند و در صورت خطا هم می‌بندد (fail closed)", () => {
    expect(adminLayout).toContain('supabase.rpc("is_platform_admin")');
    expect(adminLayout).toContain("if (error || !isAdmin) notFound()");
  });

  it("به‌جای redirect از notFound استفاده می‌کند تا وجود پنل لو نرود", () => {
    expect(adminLayout).toContain("notFound");
    expect(adminLayout).not.toContain("redirect(");
  });
});

describe("migration 0025 — ابزار اعطای دسترسی", () => {
  it("هیچ seed خودکاری ندارد", () => {
    // خواسته‌ی صریح: هیچ ایمیلی نباید خودکار سوپرادمین شود.
    expect(migration).not.toMatch(/insert\s+into\s+public\.platform_admins\s*\(user_id[\s\S]*?select\s+id\s+from\s+auth\.users/i);
    expect(migration).not.toContain("where email = 'bahram@hesabyar.app'");
  });

  it("اجرای توابع را از anon و authenticated می‌گیرد", () => {
    expect(migration).toContain(
      "revoke all on function public.grant_platform_admin(uuid, text, text)  from public, anon, authenticated"
    );
    expect(migration).toContain(
      "revoke all on function public.revoke_platform_admin(uuid)             from public, anon, authenticated"
    );
  });

  it("توابع security definer نیستند تا RLS دور زده نشود", () => {
    const grantFn = migration.slice(
      migration.indexOf("create or replace function public.grant_platform_admin"),
      migration.indexOf("comment on function public.grant_platform_admin")
    );
    expect(grantFn).not.toContain("security definer");
  });

  it("ستون‌های خروجی پیشوند دارند تا با on conflict تداخل نکنند", () => {
    // باگ واقعی: خروجی به نام user_id باعث خطای
    // «column reference "user_id" is ambiguous» در INSERT می‌شد.
    expect(migration).toContain("admin_user_id    uuid");
    expect(migration).not.toMatch(/returns table \(\s*user_id uuid/);
  });

  it("از حذف آخرین سوپرادمین جلوگیری می‌کند", () => {
    expect(migration).toContain("حذف آخرین سوپرادمین مجاز نیست");
    expect(migration).toContain("if v_remaining <= 1 then");
  });

  it("قبل از ساخت، امضای قبلی را drop می‌کند (تغییر نوع خروجی)", () => {
    const dropIdx = migration.indexOf("drop function if exists public.grant_platform_admin(uuid, text, text)");
    const createIdx = migration.indexOf("create or replace function public.grant_platform_admin");
    expect(dropIdx).toBeGreaterThan(-1);
    expect(dropIdx).toBeLessThan(createIdx);
  });
});
