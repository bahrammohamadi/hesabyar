import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "@e965/xlsx";
import { csvEscape, buildCsv, safeFilename } from "@/lib/export/csv";
import { BACKUP_TABLES, summarize, PAGE_SIZE, MAX_ROWS_PER_TABLE } from "@/lib/export/backup";
import { buildBackupWorkbook, backupFileName } from "@/lib/export/backup-workbook";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const readCode = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*(\/\/|--).*$/gm, "");

describe("🔴 CSV Injection — آسیب‌پذیری واقعی که رفع شد", () => {
  /*
    نسخه‌ی قبلی (کپی‌شده در ۹ فایل) فقط گیومه را دو برابر می‌کرد:
        `"${text.replace(/"/g, '""')}"`

    اکسل هر سلولی را که با = + - @ شروع شود فرمول می‌بیند، حتی داخل
    گیومه. سناریو: کاربر کالایی به نام `=cmd|...` می‌سازد، صاحب
    فروشگاه خروجی می‌گیرد و بازش می‌کند.

    بازتولید شد: csvEscape("=cmd|@ calc!A1") دقیقاً همان رشته را
    برمی‌گرداند و اکسل آن را اجرا می‌کند.
  */
  it.each(["=cmd|' /C calc'!A1", "+1+1", "@SUM(A1)", "\tمتن", "\rمتن"])(
    "مقدار خطرناک «%s» خنثی می‌شود",
    (evil) => {
      const out = csvEscape(evil);
      // آپاستروف پیش از کاراکتر خطرناک قرار می‌گیرد.
      expect(out.startsWith(`"'`)).toBe(true);
    }
  );

  it("منفیِ غیرعددی هم خنثی می‌شود", () => {
    expect(csvEscape("-cmd|calc")).toBe(`"'-cmd|calc"`);
  });

  it("🔴 عدد منفی دست‌نخورده می‌ماند", () => {
    /*
      مهم‌ترین استثنا. اگر همه‌ی مقادیرِ شروع‌شده با «-» را خنثی
      می‌کردیم، تمام مبالغ منفی در اکسل به متن تبدیل می‌شدند و
      جمع‌بستن ستون کار نمی‌کرد — یعنی رفع یک باگ با ساختن باگ بدتر.
    */
    expect(csvEscape("-15000")).toBe(`"-15000"`);
    expect(csvEscape("-0.5")).toBe(`"-0.5"`);
    expect(csvEscape(-15000)).toBe(`"-15000"`);
  });

  it("متن عادی فارسی تغییر نمی‌کند", () => {
    expect(csvEscape("شومیز کتیبه")).toBe(`"شومیز کتیبه"`);
    expect(csvEscape("۱۲۳۴")).toBe(`"۱۲۳۴"`);
  });

  it("گیومه هنوز درست فرار داده می‌شود", () => {
    expect(csvEscape('او گفت "سلام"')).toBe(`"او گفت ""سلام"""`);
  });

  it("null و undefined به رشته‌ی خالی تبدیل می‌شوند", () => {
    expect(csvEscape(null)).toBe(`""`);
    expect(csvEscape(undefined)).toBe(`""`);
    // نه رشته‌ی «null» که در فایل کاربر زشت است.
    expect(csvEscape(null)).not.toContain("null");
  });
});

describe("ساخت CSV", () => {
  it("🔴 BOM دارد وگرنه فارسی در اکسل خراب می‌شود", () => {
    expect(buildCsv([{ a: 1 }]).startsWith("\ufeff")).toBe(true);
  });

  it("جداکننده‌ی سطر CRLF است", () => {
    // با LF تنها، اکسل ویندوز گاهی همه را در یک خط می‌چسباند.
    expect(buildCsv([{ a: 1 }, { a: 2 }])).toContain("\r\n");
  });

  it("سرستون از کلیدهای ردیف اول می‌آید", () => {
    const csv = buildCsv([{ نام: "علی", تلفن: "۰۹۱۲" }]);
    expect(csv).toContain(`"نام","تلفن"`);
  });

  it("ردیف خالی فقط BOM می‌دهد", () => {
    expect(buildCsv([])).toBe("\ufeff");
  });

  it("نام فایل از کاراکتر غیرمجاز پاک می‌شود", () => {
    expect(safeFilename('a/b\\c:d*e?f"g<h>i|j')).not.toMatch(/[\\/:*?"<>|]/);
  });
});

describe("🔴 حذف کد تکراری", () => {
  it("هیچ فایلی csvEscape یا downloadCsv خودش را ندارد", () => {
    /*
      این دو تابع در ۹ فایل کپی شده بودند و هر ۹ نسخه همان
      آسیب‌پذیری را داشتند. اصلاح در یکی، هشت‌تای دیگر را رها می‌کرد.
    */
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(join(root, dir))) {
        const rel = `${dir}/${entry}`;
        if (statSync(join(root, rel)).isDirectory()) walk(rel);
        else if (entry.endsWith(".tsx")) {
          const code = readCode(rel);
          if (/function\s+(csvEscape|downloadCsv)\s*\(/.test(code)) offenders.push(rel);
        }
      }
    };
    walk("app");
    expect(offenders, `کپی محلی در: ${offenders.join(", ")}`).toEqual([]);
  });

  it("همه‌ی مصرف‌کننده‌ها از helper مشترک import می‌کنند", () => {
    const users = [
      "app/(app)/crm/rfm/page.tsx",
      "app/(app)/inventory/as-of/page.tsx",
      "app/(app)/inventory/stock-card/page.tsx",
      "app/(app)/reports/customer-profitability/page.tsx",
      "app/(app)/reports/overview-v2/page.tsx",
      "app/(app)/reports/page.tsx",
      "app/(app)/reports/profitability/page.tsx",
      "app/(app)/reports/sellers/page.tsx",
      "app/(app)/sales/[id]/page.tsx",
    ];
    for (const p of users) {
      expect(readCode(p), p).toContain('from "@/lib/export/download"');
    }
  });

  it("🔴 alert در مسیر خروجی گزارش‌ها نمانده", () => {
    // پنجره‌ی سیستمی انگلیسی وسط رابط فارسی.
    expect(readCode("app/(app)/reports/page.tsx")).not.toMatch(/(^|[^.\w])alert\s*\(/);
  });

  it("🔴 revokeObjectURL بلافاصله صدا زده نمی‌شود", () => {
    /*
      کد قبلی درست بعد از a.click() آدرس را باطل می‌کرد. در فایرفاکس
      و سافاری دانلود هنوز شروع نشده و فایل ناقص ذخیره می‌شود.
    */
    const code = readCode("lib/export/download.ts");
    expect(code).toContain("setTimeout(() => URL.revokeObjectURL(url)");
  });
});

describe("موتور پشتیبان", () => {
  it("جدول‌های اصلی پوشش داده شده‌اند", () => {
    const keys = BACKUP_TABLES.map((t) => t.key);
    for (const k of [
      "products", "variants", "contacts", "sales", "sale_items",
      "transactions", "stock_movements", "accounts", "categories", "brands",
    ]) {
      expect(keys, `جدول ${k} در پشتیبان نیست`).toContain(k);
    }
  });

  it("🔴 هیچ جدولی از select * استفاده نمی‌کند", () => {
    /*
      با `*`، ستون حساسی که فردا اضافه شود خودبه‌خود وارد فایل
      کاربر می‌شد. فهرست صریح یعنی تصمیم آگاهانه.
    */
    for (const t of BACKUP_TABLES) {
      expect(t.columns.length, `${t.key} ستون ندارد`).toBeGreaterThan(0);
      expect(t.columns).not.toContain("*");
    }
  });

  it("همه‌ی جدول‌ها بر اساس سازمان فیلتر می‌شوند", () => {
    // بدون این، پشتیبانِ یک کسب‌وکار داده‌ی بقیه را هم می‌گرفت.
    for (const t of BACKUP_TABLES) {
      expect(t.orgColumn, `${t.key}`).toBe("org_id");
    }
  });

  it("نام شیت‌ها یکتا و در حد مجاز اکسل‌اند", () => {
    const sheets = BACKUP_TABLES.map((t) => t.sheet);
    expect(new Set(sheets).size).toBe(sheets.length);
    for (const s of sheets) {
      expect(s.length, `نام شیت «${s}» بلند است`).toBeLessThanOrEqual(31);
      expect(s).not.toMatch(/[:\\/?*[\]]/);
    }
  });

  it("🔴 صفحه‌بندی دارد — سقف ۱۰۰۰ ردیفِ PostgREST", () => {
    /*
      بدون صفحه‌بندی، پشتیبانِ کسب‌وکاری با ۵۰۰۰ حرکت انبار بی‌صدا
      ناقص می‌شد. برای یک ابزار پشتیبان، این بدترین نوع خرابی است.
    */
    const code = readCode("lib/export/backup.ts");
    expect(code).toContain(".range(from, from + PAGE_SIZE - 1)");
    expect(code).toContain("if (batch.length < PAGE_SIZE) break;");
    expect(PAGE_SIZE).toBe(1000);
    expect(MAX_ROWS_PER_TABLE).toBeGreaterThan(PAGE_SIZE);
  });

  it("خلاصه، ناقص‌بودن را گزارش می‌کند", () => {
    const s = summarize([
      { key: "a", sheet: "الف", rows: [{}, {}], truncated: false },
      { key: "b", sheet: "ب", rows: [{}], truncated: true },
    ]);
    expect(s.total).toBe(3);
    expect(s.truncatedTables).toEqual(["ب"]);
  });
});

describe("فایل اکسل پشتیبان", () => {
  const meta = { orgName: "مزون پوشاک", generatedAt: "۱۴۰۵/۰۵/۱۹", generatedBy: "bahram" };

  it("ساخته می‌شود و شیت فهرست دارد", () => {
    const buf = buildBackupWorkbook(
      [{ key: "products", sheet: "کالاها", rows: [{ id: "1", name: "شومیز" }], truncated: false }],
      meta
    );
    const wb = XLSX.read(buf, { type: "buffer" });
    expect(wb.SheetNames[0]).toBe("فهرست");
    expect(wb.SheetNames).toContain("کالاها");
  });

  it("🔴 فرمول در سلول اکسل هم خنثی می‌شود", () => {
    /*
      همان CSV injection ولی مستقیم در xlsx. اینجا csvEscape کمکی
      نمی‌کند چون سلول باینری است، پس sanitize جدا لازم بود.
    */
    const buf = buildBackupWorkbook(
      [{ key: "products", sheet: "کالاها", rows: [{ id: "1", name: "=cmd|calc" }], truncated: false }],
      meta
    );
    const wb = XLSX.read(buf, { type: "buffer" });
    /*
      ⚠️ ستون با *نام* پیدا می‌شود نه با اندیس ثابت.
      نسخه‌ی اول این تست اندیس ۱ را فرض کرده بود، ولی ستون‌های
      products با id, code, name شروع می‌شوند و «نام» اندیس ۲ است.
      تست شکست و من اول فکر کردم باگ در کد است — نبود.
    */
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets["کالاها"], { header: 1 });
    const nameCol = (rows[0] as string[]).indexOf("نام");
    expect(nameCol).toBeGreaterThanOrEqual(0);
    expect(String(rows[1][nameCol]).startsWith("'")).toBe(true);
  });

  it("عدد به‌صورت عدد می‌ماند نه متن", () => {
    // وگرنه جمع‌بستن ستون مبلغ در اکسل کار نمی‌کند.
    const buf = buildBackupWorkbook(
      [{ key: "sales", sheet: "فاکتور فروش", rows: [{ id: "1", total: 15000 }], truncated: false }],
      meta
    );
    const wb = XLSX.read(buf, { type: "buffer" });
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets["فاکتور فروش"], { header: 1 });
    const totalCol = (rows[0] as string[]).indexOf("جمع کل");
    expect(totalCol).toBeGreaterThanOrEqual(0);
    expect(typeof rows[1][totalCol]).toBe("number");
  });

  it("بولین فارسی می‌شود", () => {
    const buf = buildBackupWorkbook(
      [{ key: "brands", sheet: "برندها", rows: [{ id: "1", name: "زارا", is_active: true }], truncated: false }],
      meta
    );
    const wb = XLSX.read(buf, { type: "buffer" });
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets["برندها"], { header: 1 });
    expect(rows[1]).toContain("بله");
  });

  it("🔴 ناقص‌بودن در فایل اعلام می‌شود", () => {
    /*
      پشتیبانی که ناقص است ولی خودش را کامل نشان می‌دهد، از نبودِ
      پشتیبان خطرناک‌تر است.
    */
    const buf = buildBackupWorkbook(
      [{ key: "sales", sheet: "فاکتور فروش", rows: [{ id: "1" }], truncated: true }],
      meta
    );
    const wb = XLSX.read(buf, { type: "buffer" });
    const text = XLSX.utils.sheet_to_csv(wb.Sheets["فهرست"]);
    expect(text).toContain("هشدار");
    expect(text).toContain("فاکتور فروش");
  });

  it("شیت خالی هم ساخته می‌شود", () => {
    // حذفش باعث می‌شد کاربر فکر کند فراموش شده.
    const buf = buildBackupWorkbook(
      [{ key: "brands", sheet: "برندها", rows: [], truncated: false }],
      meta
    );
    expect(XLSX.read(buf, { type: "buffer" }).SheetNames).toContain("برندها");
  });

  it("نام کسب‌وکار و تاریخ در فهرست هست", () => {
    const buf = buildBackupWorkbook([], meta);
    const wb = XLSX.read(buf, { type: "buffer" });
    const text = XLSX.utils.sheet_to_csv(wb.Sheets["فهرست"]);
    expect(text).toContain("مزون پوشاک");
    expect(text).toContain("۱۴۰۵/۰۵/۱۹");
  });

  it("نام فایل ASCII است", () => {
    /*
      نام فارسی در Content-Disposition بدون کدگذاری RFC 5987 در
      بعضی مرورگرها خراب می‌شود.
    */
    const name = backupFileName("۱۴۰۵/۰۵/۱۹");
    expect(name.endsWith(".xlsx")).toBe(true);
    expect(name).not.toContain("/");
  });
});

describe("روت پشتیبان", () => {
  const route = readCode("app/api/backup/route.ts");

  it("🔴 مجوز settings.manage می‌خواهد", () => {
    /*
      این فایل همه‌چیز را یک‌جا جمع می‌کند: تلفن همه‌ی مشتریان، قیمت
      خرید هر کالا، کل گردش مالی. همان فایلی که یک فروشنده‌ی ناراضی
      موقع رفتن برمی‌دارد.
    */
    expect(route).toContain('requireMember(url.searchParams.get("org_id"), "settings.manage")');
  });

  it("سقف نرخ سخت‌گیرانه دارد", () => {
    expect(route).toContain("limit: 5");
    expect(route).toContain("windowSeconds: 300");
  });

  it("maxDuration بالا برده شده", () => {
    // ده‌ها هزار ردیف از سقف پیش‌فرض ۱۰ ثانیه رد می‌شود.
    expect(route).toContain("export const maxDuration = 60");
  });

  it("🔴 جدول‌ها پشت‌سرهم خوانده می‌شوند نه موازی", () => {
    /*
      Promise.all روی ۱۱ کوئری صفحه‌بندی‌شده، استخر اتصال Supabase را
      اشباع می‌کند و بقیه‌ی کاربران هم کند می‌شوند.
    */
    expect(route).toContain("for (const spec of BACKUP_TABLES)");
    expect(route).not.toContain("Promise.all(BACKUP_TABLES");
  });

  it("🔴 فقط export های مجاز Next دارد", () => {
    /*
      route.ts فقط نام‌های شناخته‌شده را می‌پذیرد؛ هر export دیگر
      next build را می‌شکند ولی tsc تمیز رد می‌شود.
    */
    const ALLOWED = new Set([
      "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS",
      "dynamic", "revalidate", "runtime", "maxDuration",
      "preferredRegion", "fetchCache", "dynamicParams",
    ]);
    for (const m of route.matchAll(/^export\s+(?:async\s+)?(?:function|const)\s+(\w+)/gm)) {
      expect(ALLOWED.has(m[1]), `export غیرمجاز «${m[1]}»`).toBe(true);
    }
  });
});

describe("رابط کاربری پشتیبان", () => {
  const card = readCode("components/shared/backup-card.tsx");

  it("در سایدبار و نوار تب هست", () => {
    expect(readCode("components/shared/sidebar.tsx")).toContain('"/settings/backup"');
    expect(readCode("app/(app)/settings/layout.tsx")).toContain('"/settings/backup"');
  });

  it("در داشبورد تنظیمات کارت دارد", () => {
    expect(readCode("app/(app)/settings/page.tsx")).toContain('"/settings/backup"');
  });

  it("🔴 صادق است که بازگردانی خودکار ندارد", () => {
    // وعده‌ی نداده مهم‌تر از وعده‌ی نگه‌داشته است.
    expect(card).toContain("بازگردانی خودکار");
  });

  it("فایل خالی تشخیص داده می‌شود", () => {
    // بدون این، کاربر فایل صفر بایتی می‌گرفت و ماه‌ها بعد می‌فهمید.
    expect(card).toContain("blob.size === 0");
  });

  it("خطای ۴۰۳ و ۴۲۹ پیام مخصوص دارند", () => {
    expect(card).toContain("res.status === 403");
    expect(card).toContain("res.status === 429");
  });

  it("🔴 json() روی پاسخ موفق خوانده نمی‌شود", () => {
    /*
      پاسخ موفق فایل باینری است؛ json() رویش استثنا می‌دهد. فقط در
      مسیر خطا خوانده می‌شود.
    */
    const idx = card.indexOf("if (!res.ok)");
    const okBranch = card.slice(card.indexOf("const blob = await res.blob()"));
    expect(idx).toBeGreaterThan(-1);
    expect(okBranch).not.toContain("res.json()");
  });

  it("هیچ کلاس پالت خامی ندارد", () => {
    expect(card).not.toMatch(
      /\b(?:bg|text|border)-(?:white|black|slate|rose|emerald|sky|amber|zinc|gray|red|green|blue)(?:\/|-)/
    );
  });
});

describe("🔴 نام فایل در هدر HTTP", () => {
  /*
    باگی که فقط با اجرای واقعی پیدا شد. tsc و next build هر دو تمیز
    رد شدند، ولی درخواست واقعی ۵۰۰ داد:

      TypeError: Cannot convert argument to a ByteString because the
      character at index 37 has a value of 1778 which is greater than 255

    علت: todayJalali() ارقام فارسی برمی‌گرداند («۱۴۰۵/۰۵/۱۹») و آن
    رشته مستقیم در Content-Disposition می‌رفت.
  */
  it("ارقام فارسی به لاتین تبدیل می‌شوند", () => {
    expect(backupFileName("۱۴۰۵/۰۵/۱۹")).toBe("tarazoo-backup-1405-05-19.xlsx");
  });

  it("هیچ نویسه‌ی غیر-ASCII در نام نمی‌ماند", () => {
    for (const input of ["۱۴۰۵/۰۵/۱۹", "۱۴۰۵-۱۲-۲۹", "کاملاً فارسی"]) {
      // eslint-disable-next-line no-control-regex
      expect(backupFileName(input)).toMatch(/^[\x20-\x7E]+$/);
    }
  });

  it("ورودی کاملاً غیر-ASCII هم نام معتبر می‌دهد", () => {
    expect(backupFileName("فارسی")).toBe("tarazoo-backup-export.xlsx");
  });

  it("xlsxResponse خودش هم گارد دارد", () => {
    /*
      گارد در دو لایه: هم تولیدکننده‌ی نام و هم پاسخ‌دهنده. این تابع
      را روت‌های قالب اکسل هم صدا می‌زنند و نباید به هر فراخوان
      اعتماد کند.
    */
    const code = readCode("lib/import/http.ts");
    expect(code).toContain("replace(/[^\\x20-\\x7E]/g");
  });
});
