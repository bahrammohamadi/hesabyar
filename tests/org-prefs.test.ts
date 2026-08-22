import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CURRENCIES,
  DEFAULT_PREFS,
  effectiveBusinessType,
  industryProfile,
  INDUSTRY_PROFILES,
  isCurrencyCode,
  parsePrefs,
  showsField,
} from "@/lib/org-prefs";
import {
  currencyLabel,
  displayToRial,
  formatMoney,
  moneyFieldLabel,
  rialToDisplay,
} from "@/lib/utils/money";
import { BUSINESS_TYPES } from "@/lib/business-types";
import { formatToman } from "@/lib/utils/format";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
/*
  ⚠️ تله‌ی تکراری: ادعاهای تست روی *توضیحات فارسی* گیر می‌کنند نه کد.
*/
const readCode = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^\s*(\/\/|--).*$/gm, "");

describe("واحد پول", () => {
  /*
    🔴 مهم‌ترین ادعای این فایل: دیتابیس همیشه ریال است.
    اگر ضریب تومان عوض شود، هر مبلغ در برنامه ده برابر غلط می‌شود.
  */
  it("ضریب تبدیل درست است", () => {
    expect(CURRENCIES.toman.divisor).toBe(10);
    expect(CURRENCIES.rial.divisor).toBe(1);
  });

  it("ریال به نمایش درست تبدیل می‌شود", () => {
    expect(rialToDisplay(1_000_000, "toman")).toBe(100_000);
    expect(rialToDisplay(1_000_000, "rial")).toBe(1_000_000);
  });

  /*
    🔴 قرینه بودن حیاتی است. اگر این دو از هم جدا بیفتند، مبلغی که
    کاربر می‌بیند با آنچه ذخیره می‌شود فرق می‌کند — و چون هر دو
    «درست به‌نظر می‌رسند»، کسی متوجه نمی‌شود.
  */
  it("رفت و برگشت مقدار را عوض نمی‌کند", () => {
    for (const c of ["toman", "rial"] as const) {
      for (const rial of [0, 10, 1_000, 1_000_000, 987_650]) {
        expect(displayToRial(rialToDisplay(rial, c), c)).toBe(rial);
      }
    }
  });

  it("قالب‌بندی برچسب درست می‌گذارد", () => {
    expect(formatMoney(1_000_000, "toman")).toContain("تومان");
    expect(formatMoney(1_000_000, "rial")).toContain("ریال");
    expect(formatMoney(1_000_000, "toman", false)).not.toContain("تومان");
  });

  /*
    🔴 سازگاری با ۱۲۷ نقطه‌ای که هنوز formatToman را صدا می‌زنند.
    اگر رفتار پیش‌فرض عوض می‌شد، همه‌ی آن‌ها بی‌صدا خراب می‌شدند.
  */
  it("رفتار پیش‌فرض دقیقاً مثل formatToman قدیمی است", () => {
    for (const rial of [0, 1_234_560, 999, 10]) {
      expect(formatMoney(rial)).toBe(formatToman(rial));
      expect(formatMoney(rial, "toman", false)).toBe(formatToman(rial, false));
    }
  });

  it("برچسب فیلد با واحد ساخته می‌شود", () => {
    expect(moneyFieldLabel("قیمت فروش", "toman")).toBe("قیمت فروش (تومان)");
    expect(moneyFieldLabel("قیمت فروش", "rial")).toBe("قیمت فروش (ریال)");
    expect(currencyLabel("rial")).toBe("ریال");
  });

  it("ورودی تهی صفر می‌شود نه NaN", () => {
    expect(rialToDisplay(null)).toBe(0);
    expect(rialToDisplay(undefined)).toBe(0);
    expect(displayToRial(null)).toBe(0);
    expect(formatMoney(null)).toContain("۰");
  });

  it("تشخیص کد واحد معتبر", () => {
    expect(isCurrencyCode("toman")).toBe(true);
    expect(isCurrencyCode("rial")).toBe(true);
    expect(isCurrencyCode("dollar")).toBe(false);
    expect(isCurrencyCode(null)).toBe(false);
  });
});

describe("خواندن امن ترجیحات", () => {
  /*
    این داده از دیتابیس می‌آید و ممکن است دستی ویرایش شده باشد.
    یک مقدار خراب نباید کل پنل را از کار بیندازد.
  */
  it("مقدار نامعتبر به پیش‌فرض برمی‌گردد", () => {
    expect(parsePrefs({ currency: "dollar" }).currency).toBe("toman");
    expect(parsePrefs(null).currency).toBe("toman");
    expect(parsePrefs(undefined)).toEqual(DEFAULT_PREFS);
    expect(parsePrefs("not an object").currency).toBe("toman");
  });

  it("مقدار معتبر خوانده می‌شود", () => {
    expect(parsePrefs({ currency: "rial" }).currency).toBe("rial");
    expect(parsePrefs({ businessType: "cafe" }).businessType).toBe("cafe");
  });

  /*
    ⚠️ فقط `false` صریح خاموش می‌کند. مقدار غایب یعنی روشن —
    وگرنه سازمان‌های موجود که این کلید را ندارند ناگهان شخصی‌سازی
    را از دست می‌دادند.
  */
  it("شخصی‌سازی فقط با false صریح خاموش می‌شود", () => {
    expect(parsePrefs({}).industryUi).toBe(true);
    expect(parsePrefs({ industryUi: false }).industryUi).toBe(false);
    expect(parsePrefs({ industryUi: "no" }).industryUi).toBe(true);
  });

  it("رشته‌ی خالی صنف، تهی حساب می‌شود", () => {
    expect(parsePrefs({ businessType: "" }).businessType).toBeNull();
  });
});

describe("صنف مؤثر", () => {
  it("ترجیح صریح بر صنف ثبت‌شده مقدم است", () => {
    const p = parsePrefs({ businessType: "cafe" });
    expect(effectiveBusinessType(p, "apparel")).toBe("cafe");
  });

  it("بدون ترجیح، صنف ثبت‌نام استفاده می‌شود", () => {
    expect(effectiveBusinessType(parsePrefs({}), "apparel")).toBe("apparel");
  });

  /*
    🔴 خاموش‌بودن شخصی‌سازی باید **همه چیز** را عمومی کند، حتی اگر
    صنف صریح انتخاب شده باشد. وگرنه چک‌باکس دروغ می‌گوید.
  */
  it("خاموش‌بودن شخصی‌سازی صنف را تهی می‌کند", () => {
    const p = parsePrefs({ businessType: "cafe", industryUi: false });
    expect(effectiveBusinessType(p, "apparel")).toBeNull();
  });
});

describe("پروفایل صنفی", () => {
  it("هر صنف ثبت‌شده پروفایل دارد", () => {
    for (const t of BUSINESS_TYPES) {
      expect(INDUSTRY_PROFILES[t.id], `پروفایل ${t.id} نیست`).toBeTruthy();
    }
  });

  it("صنف ناشناخته به پروفایل عمومی برمی‌گردد", () => {
    const p = industryProfile("چیز-عجیب");
    expect(p.productWord).toBe("کالا");
    expect(p.hiddenFields).toEqual([]);
  });

  it("صنف تهی هم خطا نمی‌دهد", () => {
    expect(industryProfile(null).productWord).toBe("کالا");
    expect(industryProfile(undefined).hiddenFields).toEqual([]);
  });

  /*
    🔴 سوپرمارکت و طلا باید وزنی باشند. پیش‌فرض شمارشی یعنی کاربر
    هر بار دستی عوضش کند — و همان یک بار که یادش برود، کالای وزنی
    شمارشی ثبت می‌شود و دیگر «۱٫۵ کیلو» نمی‌پذیرد.
  */
  it("صنف‌های وزنی پیش‌فرض درست دارند", () => {
    expect(industryProfile("grocery").defaultUnit).toBe("weight");
    expect(industryProfile("jewelry").defaultUnit).toBe("weight");
    expect(industryProfile("apparel").defaultUnit).toBe("count");
  });

  it("واژه‌ی کالا با صنف عوض می‌شود", () => {
    expect(industryProfile("cafe").productWord).toBe("آیتم منو");
    expect(industryProfile("jewelry").productWord).toBe("مصنوع");
    expect(industryProfile("apparel").productWord).toBe("کالا");
  });

  it("فیلدهای بی‌ربط پنهان می‌شوند", () => {
    // رنگ و سایز برای قهوه بی‌معنی است
    expect(showsField("cafe", "color")).toBe(false);
    expect(showsField("cafe", "size")).toBe(false);
    // ولی برای پوشاک ضروری است
    expect(showsField("apparel", "color")).toBe(true);
    expect(showsField("apparel", "size")).toBe(true);
  });

  it("صنف ناشناخته هیچ فیلدی را پنهان نمی‌کند", () => {
    for (const f of ["color", "size", "season", "material"] as const) {
      expect(showsField(null, f)).toBe(true);
      expect(showsField("چیز-عجیب", f)).toBe(true);
    }
  });

  /*
    هر صنف باید حداقل یک واحد پیشنهادی داشته باشد، وگرنه کشویی
    واحد برای آن صنف خالی می‌ماند — بدتر از کادر متنی ساده.
  */
  it("هر صنف واحد پیشنهادی دارد", () => {
    for (const t of BUSINESS_TYPES) {
      const units = INDUSTRY_PROFILES[t.id]?.suggested.unit ?? [];
      expect(units.length, `صنف ${t.id} واحد پیشنهادی ندارد`).toBeGreaterThan(0);
    }
  });

  /*
    اگر صنفی فیلدی را پنهان می‌کند، نباید برای همان فیلد پیشنهاد
    هم داشته باشد — تناقض یعنی یکی از دو جا اشتباه است.
  */
  it("فیلد پنهان پیشنهاد ندارد", () => {
    for (const [id, p] of Object.entries(INDUSTRY_PROFILES)) {
      for (const hidden of p.hiddenFields) {
        expect(p.suggested[hidden], `${id}: فیلد ${hidden} هم پنهان است هم پیشنهاد دارد`).toBeUndefined();
      }
    }
  });
});

describe("مرز سرور و کلاینت", () => {
  /*
    ⚠️ این فایل‌ها از کامپوننت کلاینت خوانده می‌شوند. همان درسی که
    با node:crypto گرفتیم و فقط `next build` گرفتش.
  */
  it("ترجیحات و پول هیچ وابستگی به node ندارند", () => {
    for (const f of ["lib/org-prefs.ts", "lib/utils/money.ts", "lib/hooks/useOrgPrefs.ts"]) {
      const code = readCode(f);
      expect(code, f).not.toMatch(/from "node:/);
      expect(code, f).not.toMatch(/require\(/);
    }
  });

  it("کدهای پشتیبان سروری است و از کلاینت خوانده نمی‌شود", () => {
    expect(readCode("lib/security/backup-codes.ts")).toMatch(/from "node:crypto"/);
    expect(readCode("components/shared/backup-codes.tsx")).not.toMatch(
      /from "@\/lib\/security\/backup-codes"/
    );
  });
});

describe("اعمال در رابط کاربری", () => {
  const pos = readCode("app/(app)/sales/components/PosPieces.tsx");
  const invoice = readCode("src/shared/panels/InvoiceCreateForm.tsx");
  const panel = readCode("src/shared/panels/ProductPanel.tsx");

  /*
    🔴 اگر `formatToman` در این فایل‌ها بماند، سازمان ریالی همچنان
    «تومان» می‌بیند و هر عدد یک‌دهم واقعیت است — بدون هیچ نشانه‌ای
    که چیزی اشتباه است.
  */
  it("سبد و فاکتور دیگر formatToman سخت‌کد ندارند", () => {
    expect(pos).not.toMatch(/\bformatToman\(/);
    expect(invoice).not.toMatch(/\bformatToman\(/);
  });

  it("سبد و فاکتور از واحد سازمان استفاده می‌کنند", () => {
    expect(pos).toMatch(/useOrgPrefs\(\)/);
    expect(invoice).toMatch(/orgPrefs\.money\(/);
  });

  /*
    برچسب «(تومان)» کنار کادر ورودی خطرناک‌تر از نمایش است: کاربر
    ریالی عدد را ده برابر وارد می‌کند.
  */
  it("برچسب کادرهای مبلغ از واحد سازمان می‌آید", () => {
    expect(invoice).not.toMatch(/label="[^"]*\(تومان\)"/);
    expect(invoice).toMatch(/orgPrefs\.moneyLabel\(/);
  });

  it("واژه‌ی «تومان» کنار قیمت سطر سخت‌کد نیست", () => {
    expect(pos).not.toMatch(/, false\)\} تومان/);
  });

  /*
    فیلدهای بی‌ربط به صنف باید پنهان شوند — ولی مقدارشان از دست
    نرود.
  */
  it("فرم کالا فیلدهای صنفی را شرطی نشان می‌دهد", () => {
    expect(panel).toMatch(/orgPrefs\.shows\("season"\)/);
    expect(panel).toMatch(/orgPrefs\.shows\("material"\)/);
  });

  it("رنگ و سایز و فصل و جنس کشویی شده‌اند", () => {
    for (const kind of ["color", "size", "season", "material"]) {
      expect(panel, `کشویی ${kind} نیست`).toMatch(new RegExp(`OptionCombo kind="${kind}"`));
    }
  });

  /*
    🔴 سوپرمارکت و طلا وزنی‌اند. بدون این، کاربر هر بار دستی عوض
    می‌کند و همان یک بار که یادش برود، کالای وزنی شمارشی ثبت
    می‌شود.
  */
  it("واحد پیش‌فرض کالای تازه از صنف می‌آید", () => {
    expect(panel).toMatch(/unit: orgPrefs\.profile\.defaultUnit/);
  });

  /*
    داده‌ی موجود این فیلدها متن آزاد است. `select` سفت یعنی هر
    مقداری که در فهرست نیست از فرم ناپدید و با ذخیره پاک می‌شود.
  */
  it("کشویی تایپ آزاد را هم می‌پذیرد", () => {
    const combo = readCode("components/shared/option-combo.tsx");
    expect(combo).toMatch(/<datalist/);
    expect(combo).not.toMatch(/<select/);
  });

  it("صفحه‌ی تنظیمات در منو هست", () => {
    expect(readCode("components/shared/sidebar.tsx")).toMatch(/\/settings\/preferences/);
  });
});

describe("🔴 باگی که فقط تست مرورگر گرفت", () => {
  /*
    اولین بار که واحد را روی «ریال» گذاشتم و سبد فروش را باز کردم،
    همچنان «تومان» می‌گفت. علتش این بود که `formatToman` را عوض
    کرده بودم ولی **واژه‌ی «تومان» سخت‌کد** در کلید تعویض
    واحد/درصد و سرستون جدول باقی مانده بود.

    ⚠️ تست‌های رشته‌ای قبلی این را نگرفتند چون فقط دنبال
    `formatToman(` بودند، نه دنبال خود واژه.
  */
  it("هیچ «تومان» سخت‌کدی در کد سبد نمانده", () => {
    const code = readCode("app/(app)/sales/components/PosPieces.tsx");
    const lines = code.split("\n").filter((l) => l.includes("تومان"));
    expect(lines, `هنوز سخت‌کد است:\n${lines.join("\n")}`).toHaveLength(0);
  });

  it("کلید تعویض واحد از واژه‌ی سازمان استفاده می‌کند", () => {
    const code = readCode("app/(app)/sales/components/PosPieces.tsx");
    expect(code).toMatch(/isPercent \? <Percent size=\{15\} aria-hidden \/> : unitWord/);
  });
});

describe("🔴 قواعد hook در مهاجرت خودکار", () => {
  /*
    مهاجرت ۳۰ فایل با اسکریپت انجام شد و دو بار hook را جای اشتباه
    گذاشت:

      • `formatMoney` در src/shared/format — تابع خالص است و از
        داخل شرط و حلقه صدا زده می‌شود
      • `describe` در صفحه‌ی فعالیت‌ها — داخل map صدا زده می‌شود

    هیچ‌کدام را tsc نگرفت (از نظر نوع درست‌اند) و هیچ‌کدام را
    next build نگرفت. فقط بازرسی خودکار پیدایشان کرد.

    این تست همان بازرسی را دائمی می‌کند.
  */
  const walk = (dir: string): string[] => {
    const { readdirSync } = require("node:fs") as typeof import("node:fs");
    const out: string[] = [];
    for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) out.push(...walk(rel));
      else if (e.name.endsWith(".tsx")) out.push(rel);
    }
    return out;
  };

  it("هر تابعی که money یا unitWord دارد، hook هم دارد", () => {
    const files = [...walk("app"), ...walk("components"), ...walk("src")];
    const offenders: string[] = [];

    for (const f of files) {
      const code = readCode(f);
      if (!/\bunitWord\b|\bmoney\(/.test(code)) continue;

      const starts = [...code.matchAll(/\n(?:export )?(?:default )?function (\w+)\s*\(/g)].map(
        (m) => ({ pos: m.index!, name: m[1] })
      );
      for (let i = 0; i < starts.length; i++) {
        const end = i + 1 < starts.length ? starts[i + 1].pos : code.length;
        const body = code.slice(starts[i].pos, end);
        if (!/\bunitWord\b|\bmoney\(/.test(body)) continue;
        if (body.includes("useOrgPrefs()")) continue;
        /*
          استثنای عمدی: تابعی که `money` را به‌عنوان **پارامتر**
          می‌گیرد درست است — همان راه‌حل جایی است که hook ممنوع
          است.
        */
        if (/function \w+\([^)]*money:/s.test(body)) continue;
        offenders.push(`${f}::${starts[i].name}`);
      }
    }

    expect(offenders, `hook ندارند:\n${offenders.join("\n")}`).toHaveLength(0);
  });

  /*
    `formatMoney` نباید hook داشته باشد — تابع خالص است.
  */
  it("تابع خالص formatMoney hook ندارد", () => {
    const fmt = readCode("src/shared/format/index.tsx");
    const fn = fmt.slice(fmt.indexOf("export function formatMoney"));
    const body = fn.slice(0, fn.indexOf("\nexport function", 10));
    expect(body).not.toMatch(/useOrgPrefs\(\)/);
  });

  /*
    ولی کامپوننت `<Money>` باید داشته باشد — همین باعث می‌شود هر
    جای برنامه که از آن استفاده می‌کند خودکار واحد سازمان را
    بگیرد.
  */
  it("کامپوننت Money واحد سازمان را می‌گیرد", () => {
    const fmt = readCode("src/shared/format/index.tsx");
    const fn = fmt.slice(fmt.indexOf("export function Money"));
    expect(fn).toMatch(/useOrgPrefs\(\)/);
  });
});
