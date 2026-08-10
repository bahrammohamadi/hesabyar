import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  buildInsertPayload, friendlyError, isValidName,
  MANAGED_TABLES, TABLE_USES_BRANCH,
} from "@/components/shared/managed-list.helpers";
import {
  defaultPermissions, hasAll, togglePermissions, ROLE_LABELS,
} from "@/components/shared/users-access.helpers";
import { uniquePermissions } from "@/lib/access/permission-tree";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

/** توضیحات فارسی حذف می‌شوند تا assert روی *کد* باشد نه کامنت. */
const readCode = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*(\/\/|--).*$/gm, "");

const MIG = "supabase/migrations/0040_categories_per_org.sql";
const migCode = readCode(MIG);

describe("🔴 مهاجرت ۰۰۴۰ — دسته‌بندی کالا", () => {
  /*
    باگ اصلی، اندازه‌گیری‌شده روی دیتابیس زنده پیش از مهاجرت:
      GET  categories?is_active=eq.true
         → 42703: column categories.is_active does not exist
      POST categories {org_id, branch_id, name}
         → PGRST204: Could not find the 'branch_id' column
    یعنی هر چهار عمل کارت «دسته‌بندی کالا» خراب بود و صفحه بی‌صدا
    «موردی ثبت نشده.» نشان می‌داد در حالی که ۱۵ ردیف موجود بود.
  */
  it("هر سه ستون گمشده اضافه می‌شوند", () => {
    for (const col of ["org_id", "branch_id", "is_active"]) {
      expect(migCode, `ستون ${col} اضافه نشده`).toContain(`add column if not exists ${col}`);
    }
  });

  it("🔴 policy نشتی «true» حذف می‌شود", () => {
    /*
      policy قبلی `Public read categories` با شرط true بود: هر
      کاربری دسته‌های همه‌ی کسب‌وکارها را می‌دید. نشت داده بین
      مستأجرها.
    */
    expect(migCode).toContain('drop policy if exists "Public read categories"');
  });

  it("policy تازه به سازمان کاربر محدود است", () => {
    expect(migCode).toContain("using (org_id in (select public.user_org_ids()))");
  });

  it("نوشتن مجوز products.edit می‌خواهد", () => {
    expect(migCode).toContain("public.has_permission('products.edit')");
  });

  it("🔴 هیچ ردیفی حذف نمی‌شود", () => {
    /*
      ۱۵ ردیف یتیمِ پروژه‌ی موزیک با org_id تهی می‌مانند و policy
      پنهانشان می‌کند. حذف، تصمیمی است که پس گرفته نمی‌شود.
    */
    expect(migCode).not.toMatch(/delete\s+from\s+public\.categories/i);
    expect(migCode).not.toMatch(/truncate/i);
  });

  it("ایندکس یکتا از نام تکراری جلوگیری می‌کند", () => {
    expect(migCode).toContain("create unique index if not exists uq_categories_org_name");
    // ردیف‌های یتیم و حذف‌شده نباید در قید بیایند.
    expect(migCode).toContain("where org_id is not null and is_active");
  });

  it("🔴 شناسه‌های صنف با lib/business-types.ts یکی هستند", () => {
    /*
      نسخه‌ی اول این مهاجرت شناسه‌های حدسی داشت ('clothing',
      'restaurant', 'supermarket', 'electronics') که در فهرست واقعی
      اصلاً وجود ندارند — همه‌ی سازمان‌ها به شاخه‌ی else می‌افتادند و
      دسته‌های عمومی می‌گرفتند.
    */
    const types = read("lib/business-types.ts");
    const realIds = [...types.matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(realIds.length).toBeGreaterThan(5);

    const seeded = [...migCode.matchAll(/p_business_type = '([a-z]+)'/g)].map((m) => m[1]);
    expect(seeded.length).toBeGreaterThan(5);
    for (const id of seeded) {
      expect(realIds, `صنف «${id}» در business-types.ts نیست`).toContain(id);
    }
  });

  it("bootstrap_org دسته‌های پیش‌فرض می‌سازد", () => {
    expect(migCode).toContain("perform public.seed_default_categories(v_org, p_business_type)");
  });

  it("🔴 bootstrap_org منطق قبلی‌اش را از دست نداده", () => {
    /*
      این تابع بازنویسی شد. اگر گاردِ «کاربر از قبل عضو جایی است»
      جا می‌افتاد، رفرش‌کردن فرم معارفه دو سازمان می‌ساخت.
    */
    const idx = migCode.indexOf("create or replace function public.bootstrap_org");
    const body = migCode.slice(idx);
    expect(body).toContain("if v_org is not null then");
    expect(body).toContain("'شعبه اصلی'");
    expect(body).toContain("insert into public.memberships");
    expect(body).toContain("interval '14 days'");
  });

  it("فایل بازگشت وجود دارد", () => {
    expect(existsSync(join(root, "supabase/rollbacks/0040_categories_per_org.down.sql"))).toBe(true);
  });
});

describe("🔴 payload جدول‌های متفاوت", () => {
  it("categories هرگز branch_id نمی‌گیرد", () => {
    /*
      همین باعث PGRST204 می‌شد: کد یک payload یکسان برای سه جدولِ
      با ساختار متفاوت می‌فرستاد.
    */
    const payload = buildInsertPayload("categories", "org-1", "branch-1", "شومیز");
    expect(payload).not.toHaveProperty("branch_id");
    expect(payload).toEqual({ org_id: "org-1", name: "شومیز" });
  });

  it("brands و expense_categories شعبه می‌گیرند", () => {
    for (const table of ["brands", "expense_categories"] as const) {
      const payload = buildInsertPayload(table, "org-1", "branch-1", "زارا");
      expect(payload.branch_id).toBe("branch-1");
    }
  });

  it("شعبه‌ی تهی اصلاً به payload اضافه نمی‌شود", () => {
    // کلید با مقدار null هم می‌تواند مشکل‌ساز باشد؛ نبودنش امن‌تر است.
    const payload = buildInsertPayload("brands", "org-1", null, "زارا");
    expect(payload).not.toHaveProperty("branch_id");
  });

  it("نام از فاصله‌ی اضافه پاک می‌شود", () => {
    expect(buildInsertPayload("categories", "o", null, "  شومیز  ").name).toBe("شومیز");
  });

  it("همه‌ی جدول‌ها در نگاشت شعبه تعریف شده‌اند", () => {
    for (const t of MANAGED_TABLES) {
      expect(TABLE_USES_BRANCH[t]).toBeTypeOf("boolean");
    }
  });

  it("نام خالی نامعتبر است", () => {
    expect(isValidName("")).toBe(false);
    expect(isValidName("   ")).toBe(false);
    expect(isValidName(null)).toBe(false);
    expect(isValidName(123)).toBe(false);
    expect(isValidName("شومیز")).toBe(true);
  });
});

describe("🔴 خطاها دیگر بی‌صدا بلعیده نمی‌شوند", () => {
  it("کد ۲۳۵۰۵ پیام «نام تکراری» می‌دهد", () => {
    expect(friendlyError({ code: "23505" })).toContain("قبلاً ثبت شده");
  });

  it("کد ۴۲۵۰۱ پیام دسترسی می‌دهد", () => {
    expect(friendlyError({ code: "42501" })).toContain("اجازه");
  });

  it("کدهای ستون ناشناخته پیام ناهماهنگی نسخه می‌دهند", () => {
    // همان دو کدی که باگ categories تولید می‌کرد.
    for (const code of ["PGRST204", "42703"]) {
      expect(friendlyError({ code })).toContain("هماهنگ نیست");
    }
  });

  it("نبودِ خطا یعنی null", () => {
    expect(friendlyError(null)).toBeNull();
  });

  it("کامپوننت فهرست، خطا را پرتاب و نمایش می‌دهد", () => {
    const code = readCode("components/shared/managed-list.tsx");
    // در queryFn خطا پرتاب می‌شود، نه اینکه آرایه‌ی خالی برگردد.
    expect(code).toContain("if (error) throw new Error(friendlyError(error)");
    // و در UI نمایش داده می‌شود.
    expect(code).toContain("(error as Error).message");
  });

  it("همه‌ی نوشتن‌ها نتیجه را بررسی می‌کنند", () => {
    const code = readCode("components/shared/managed-list.tsx");
    /*
      هر سه عمل نوشتن (افزودن، تغییر نام، حذف) باید نتیجه را در
      { error } بگیرند.

      الگوی خطرناک، *شروع شدنِ یک دستور* با `await supabase` است:
        await supabase.from(t).insert(...);
      یعنی نتیجه دور ریخته می‌شود و خطا بی‌صدا بلعیده. دقیقاً پنج
      بار در نسخه‌ی قبلی این اتفاق افتاده بود.
    */
    expect(code).not.toMatch(/^\s*await supabase/m);
    expect(code.match(/const \{ error \} = await supabase/g)?.length).toBeGreaterThanOrEqual(3);
    expect(code.match(/friendlyError\(error\)/g)?.length).toBeGreaterThanOrEqual(3);
  });
});

describe("🔴 حذف بدون تأیید ممکن نیست", () => {
  it.each([
    ["managed-list", "components/shared/managed-list.tsx"],
    ["accounts-manager", "components/shared/accounts-manager.tsx"],
  ])("%s پیش از حذف تأیید می‌گیرد", (_name, path) => {
    const code = readCode(path);
    expect(code).toContain("await confirm(");
    expect(code).toContain('tone: "danger"');
    // اگر کاربر انصراف داد، هیچ اتفاقی نمی‌افتد.
    expect(code).toContain("if (!ok) return;");
  });

  it("متن تأیید صادق است: «پنهان می‌شود» نه «حذف»", () => {
    /*
      عملیات واقعی is_active=false است و رکوردهای وابسته دست‌نخورده
      می‌مانند. گفتن «برای همیشه حذف می‌شود» وعده‌ی نادرست بود.
    */
    expect(readCode("components/shared/managed-list.tsx")).toContain("پنهان می‌شود");
    expect(readCode("components/shared/accounts-manager.tsx")).toContain("دست‌نخورده می‌مانند");
  });

  it("غیرفعال‌کردن کاربر هم تأیید می‌خواهد", () => {
    expect(readCode("components/shared/users-access.tsx")).toContain("await confirm(");
  });
});

describe("🔴 alert() مرورگر حذف شد", () => {
  it("هیچ alert() در تنظیمات و کامپوننت‌هایش نیست", () => {
    /*
      تنها جای برنامه که alert() داشت: مدیریت کاربران. پنجره‌ی
      سیستمی انگلیسی وسط رابط فارسی، و مسدودکننده.
    */
    for (const p of [
      "app/(app)/settings/page.tsx",
      "app/(app)/settings/users/page.tsx",
      "app/(app)/settings/catalog/page.tsx",
      "app/(app)/settings/accounts/page.tsx",
      "app/(app)/settings/general/page.tsx",
      "components/shared/users-access.tsx",
      "components/shared/managed-list.tsx",
      "components/shared/accounts-manager.tsx",
    ]) {
      expect(readCode(p), `${p} هنوز alert دارد`).not.toMatch(/(^|[^.\w])alert\s*\(/);
    }
  });
});

describe("مرتب‌سازی صفحه‌ی تنظیمات", () => {
  it("🔴 فایل ۶۴۳ خطی شکسته شد", () => {
    const lines = read("app/(app)/settings/page.tsx").split("\n").length;
    expect(lines).toBeLessThan(200);
  });

  it("زیرصفحه‌ها دیگر دو خطیِ وابسته به صفحه‌ی والد نیستند", () => {
    for (const p of [
      "app/(app)/settings/users/page.tsx",
      "app/(app)/settings/catalog/page.tsx",
      "app/(app)/settings/accounts/page.tsx",
    ]) {
      /*
        🔴 readCode نه read: صفحه‌ی users در *توضیح فارسی*‌اش
        می‌نویسد «پیش از این SettingsContent را صدا می‌زد». نسخه‌ی
        اول این تست روی همان کامنت گیر کرد — دقیقاً همان تله‌ای که
        readCode برای دفعش ساخته شده.
      */
      const code = readCode(p);
      expect(code, `${p} هنوز SettingsContent را وارد می‌کند`).not.toContain("SettingsContent");
      expect(code).toContain("PageHeader");
    }
  });

  it("🔴 انتخابگر تم فقط در یک صفحه است", () => {
    /*
      پیش از این هم در /settings/general بود و هم بالای
      /settings/catalog — دو نسخه‌ی جدا از یک کامپوننت.
    */
    const catalog = readCode("app/(app)/settings/catalog/page.tsx");
    expect(catalog).not.toContain("THEMES");
    expect(readCode("app/(app)/settings/general/page.tsx")).toContain("THEMES");
  });

  it("دسته‌بندی هزینه به بخش مالی منتقل شد", () => {
    expect(readCode("app/(app)/settings/accounts/page.tsx")).toContain("expense_categories");
    expect(readCode("app/(app)/settings/catalog/page.tsx")).not.toContain("expense_categories");
  });

  it("حساب کاربری در نوار تب هست", () => {
    // تغییر رمز عبور پرکاربرد است ولی از نوار غایب بود.
    expect(readCode("app/(app)/settings/layout.tsx")).toContain('"/settings/account"');
  });

  it("🔴 هیچ کلاس پالت خام یا رنگ hex نمانده", () => {
    /*
      نسخه‌ی قبلی پنج بار `bg-white/90 shadow-slate-900/[0.04]`
      داشت که در حالت تیره کارت سفید روی پس‌زمینه‌ی تیره می‌داد.
    */
    for (const p of [
      "app/(app)/settings/page.tsx",
      "app/(app)/settings/catalog/page.tsx",
      "app/(app)/settings/accounts/page.tsx",
      "app/(app)/settings/general/page.tsx",
      "app/(app)/settings/users/page.tsx",
      "components/shared/managed-list.tsx",
      "components/shared/accounts-manager.tsx",
      "components/shared/users-access.tsx",
      "components/shared/permission-tree-editor.tsx",
    ]) {
      const code = readCode(p);
      expect(code, `${p}: کلاس پالت خام`).not.toMatch(
        /\b(?:bg|text|border|shadow)-(?:white|black|slate|rose|emerald|sky|amber|zinc|gray|red|green|blue)(?:\/|-)/
      );
      expect(code, `${p}: رنگ hex خام`).not.toMatch(/#[0-9a-fA-F]{6}\b/);
    }
  });

  it("دکمه‌های ویرایش/حذف با hover پنهان نمی‌شوند", () => {
    /*
      نسخه‌ی قبلی opacity-0 group-hover:opacity-100 داشت. روی موبایل
      hover وجود ندارد، پس کاربر اصلاً نمی‌فهمید می‌تواند ویرایش کند.
    */
    for (const p of [
      "components/shared/managed-list.tsx",
      "components/shared/accounts-manager.tsx",
    ]) {
      expect(readCode(p), `${p}`).not.toContain("opacity-0 group-hover:opacity-100");
    }
  });
});

describe("درخت مجوز", () => {
  it("🔴 گروه‌ها پیش‌فرض جمع‌اند", () => {
    /*
      ۵۱ گزینه در ۹ گروه، برای هر کاربر، همه باز. با ۵ کاربر
      ۲۵۵ چک‌باکس روی یک صفحه — همان «شلوغ و پلوغ».
    */
    const code = readCode("components/shared/permission-tree-editor.tsx");
    expect(code).toContain("useState<string | null>(null)");
    expect(code).toContain("openGroup");
    expect(code).toContain("aria-expanded");
  });

  it("هر چک‌باکس برچسب قابل‌خواندن دارد", () => {
    // بدون aria-label صفحه‌خوان فقط «checkbox» می‌گوید.
    const code = readCode("components/shared/permission-tree-editor.tsx");
    expect(code).toContain("aria-label={label}");
  });

  it("درخت هر کاربر تک‌بازشو است", () => {
    const code = readCode("components/shared/users-access.tsx");
    expect(code).toContain("expandedId");
    expect(code).toContain("setExpandedId(open ? null : u.id)");
  });
});

describe("منطق مجوز نقش‌ها", () => {
  it("مدیر کل ستاره می‌گیرد", () => {
    expect(defaultPermissions("owner")).toEqual(["*"]);
  });

  it("مدیر همه‌ی مجوزهای درخت را می‌گیرد", () => {
    expect(defaultPermissions("manager")).toEqual(uniquePermissions());
  });

  it("فروشنده به انبار و گزارش دسترسی ندارد", () => {
    const p = defaultPermissions("cashier");
    expect(p).toContain("sales.create");
    expect(p).not.toContain("inventory.adjust");
    expect(p).not.toContain("reports.view");
  });

  it("نقش ناشناخته هیچ مجوزی نمی‌گیرد", () => {
    // fail closed — نه اینکه به‌طور پیش‌فرض همه‌چیز بدهد.
    expect(defaultPermissions("چیز عجیب")).toEqual([]);
  });

  it("همه‌ی نقش‌ها برچسب فارسی دارند", () => {
    for (const role of ["owner", "manager", "cashier", "inventory", "accountant"]) {
      expect(ROLE_LABELS[role]).toBeTruthy();
    }
  });

  it("ستاره یعنی همه‌چیز", () => {
    expect(hasAll(["*"], ["sales.create", "inventory.adjust"])).toBe(true);
  });

  it("فهرست خالیِ الزامات همیشه برقرار است", () => {
    expect(hasAll([], [])).toBe(true);
  });

  it("🔴 دست‌زدن به تیک‌ها، ستاره را باز می‌کند", () => {
    /*
      بدون این، برداشتن یک تیک از حالت `*` هیچ اثری نداشت: آرایه
      همچنان ["*"] می‌ماند و کاربر فکر می‌کرد دسترسی را گرفته.
    */
    const next = togglePermissions(["*"], ["sales.create"], false);
    expect(next).not.toContain("*");
    expect(next).not.toContain("sales.create");
  });

  it("افزودن و برداشتن درست کار می‌کند", () => {
    expect(togglePermissions([], ["a", "b"], true).sort()).toEqual(["a", "b"]);
    expect(togglePermissions(["a", "b"], ["a"], false)).toEqual(["b"]);
  });

  it("افزودن تکراری چیزی را دو بار اضافه نمی‌کند", () => {
    expect(togglePermissions(["a"], ["a"], true)).toEqual(["a"]);
  });
});
