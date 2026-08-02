/**
 * تحلیل گفتار فارسی برای افزودن کالا به فاکتور.
 *
 * منطق خالص و بدون وابستگی به مرورگر تا بتوان با ده‌ها عبارت واقعی
 * تست شود — کاری که برای این قابلیت حیاتی است، چون تشخیص گفتار
 * ذاتاً خطا دارد و باید بدانیم دقیقاً کجا می‌شکند.
 *
 * ⚠️ محدودیت‌های شناخته‌شده‌ی Web Speech API (بررسی‌شده پیش از پیاده‌سازی):
 *   • fa-IR رسماً پشتیبانی می‌شود ولی فقط در کرومیوم و سافاری ۱۴٫۱+
 *   • فایرفاکس اصلاً ندارد (پشت پرچم)
 *   • به اینترنت نیاز دارد؛ صدا به سرور گوگل/اپل می‌رود
 *   • دقت با لهجه و نویز پس‌زمینه افت می‌کند
 *   به همین دلیل هیچ‌وقت مستقیم به فاکتور اضافه نمی‌کنیم — همیشه
 *   تأیید کاربر لازم است.
 */

/* ────────────── اعداد فارسی ────────────── */

const WORD_NUMBERS: Record<string, number> = {
  یک: 1, یه: 1, "١": 1,
  دو: 2, دوتا: 2, دوعدد: 2,
  سه: 3, چهار: 4, چار: 4, پنج: 5, شش: 6, شیش: 6,
  هفت: 7, هشت: 8, نه: 9, ده: 10,
  یازده: 11, دوازده: 12, سیزده: 13, چهارده: 14, پانزده: 15, پونزده: 15,
  شانزده: 16, شونزده: 16, هفده: 17, هیفده: 17, هجده: 18, هیجده: 18,
  نوزده: 19, بیست: 20, سی: 30, چهل: 40, پنجاه: 50,
  شصت: 60, هفتاد: 70, هشتاد: 80, نود: 90, صد: 100,
};

/** واحدهایی که بعد از عدد می‌آیند و جزو نام کالا نیستند. */
const UNITS = [
  "عدد", "تا", "دانه", "دونه", "بسته", "کارتن", "جعبه", "بند",
  "متر", "سانت", "کیلو", "کیلوگرم", "گرم", "جفت", "دست", "ست", "رول", "طاقه",
];

/** واژه‌های دستوری که باید از نام کالا حذف شوند. */
const FILLER = [
  "اضافه", "کن", "بکن", "بزن", "ثبت", "لطفا", "لطفاً",
  "به", "فاکتور", "سبد", "میخوام", "می‌خوام", "بده", "برام", "از",
];

/** نویسه‌های عربی که در متن فارسی باید یکدست شوند. */
export function normalizePersian(input: string): string {
  return input
    .replace(/[\u064A\u0649]/g, "ی")   // ي و ى → ی
    .replace(/[\u0643]/g, "ک")          // ك → ک
    .replace(/[\u0623\u0625\u0622]/g, "ا")
    .replace(/[\u064B-\u0652\u0670]/g, "") // اعراب
    .replace(/\u200c/g, " ")            // نیم‌فاصله → فاصله
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/\s+/g, " ")
    .trim();
}

/* ────────────── استخراج تعداد و نام ────────────── */

export type ParsedUtterance = {
  /** تعداد درخواستی؛ اگر گفته نشده باشد ۱. */
  qty: number;
  /** آیا تعداد صریحاً در گفتار بود؟ */
  qtyExplicit: boolean;
  /** نام کالا پس از حذف عدد، واحد و واژه‌های دستوری. */
  term: string;
  /** متن اصلی، برای نمایش به کاربر. */
  raw: string;
};

/**
 * «سه عدد شومیز وارداتی» → { qty: 3, term: "شومیز وارداتی" }
 *
 * عدد فقط از *ابتدای* عبارت خوانده می‌شود. دلیلش این است که نام
 * خیلی از کالاهای واقعی خودشان عدد دارند («شومیز تترون نخ یک و دو
 * تک رنگ 1113»)؛ اگر هر عددی را تعداد فرض کنیم، نام خراب می‌شود.
 */
export function parseUtterance(input: string): ParsedUtterance {
  const raw = input.trim();
  const text = normalizePersian(raw);
  /*
    واژه‌های دستوریِ *ابتدای* جمله پیش از خواندن عدد حذف می‌شوند.

    🔴 باگی که تست گرفت: در «لطفا دو تا کاپشن کتان» عدد در موقعیت ۱
    است نه ۰، پس تعداد خوانده نمی‌شد و ۱ می‌ماند.
    (فقط ابتدای جمله پاک می‌شود؛ حذف سراسری، نام کالاهایی مثل
    «کیف به رنگ ...» را خراب می‌کرد.)
  */
  const allWords = text.split(" ").filter(Boolean);
  let lead = 0;
  while (lead < allWords.length && FILLER.includes(allWords[lead])) lead++;
  const words = allWords.slice(lead);

  let qty = 1;
  let qtyExplicit = false;
  let i = 0;

  if (words.length > 0) {
    const first = words[0];
    if (/^\d+$/.test(first)) {
      qty = parseInt(first, 10);
      qtyExplicit = true;
      i = 1;
    } else if (first in WORD_NUMBERS) {
      /*
        «دو» در ابتدای «دو تا شومیز» تعداد است، ولی در «دو رنگ» جزو
        نام. تفکیک: اگر واژه‌ی بعدی یک واحد باشد یا عدد به‌تنهایی
        بیاید، تعداد است.
      */
      const next = words[1] ?? "";
      const nextIsUnit = UNITS.includes(next);
      const looksLikeName = ["رنگ", "طرفه", "لایه", "تکه", "جیب"].includes(next);
      if (nextIsUnit || !looksLikeName) {
        qty = WORD_NUMBERS[first];
        qtyExplicit = true;
        i = 1;
      }
    }
  }

  // واحد بلافاصله بعد از عدد
  if (qtyExplicit && i < words.length && UNITS.includes(words[i])) i += 1;

  const term = words
    .slice(i)
    .filter((w) => !FILLER.includes(w))
    .join(" ")
    .trim();

  // تعداد غیرمنطقی نشانه‌ی تشخیص اشتباه است.
  if (qty < 1 || qty > 999) qty = 1;

  return { qty, qtyExplicit, term, raw };
}

/* ────────────── تطبیق فازی نام ────────────── */

/** فاصله‌ی لِوِنشتاین با سقف، برای رد سریع گزینه‌های دور. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < best) best = cur[j];
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

export type Scored<T> = { item: T; score: number };

/**
 * امتیاز شباهت بین گفته‌ی کاربر و نام کالا — بین ۰ تا ۱.
 *
 * چرا واژه‌محور و نه رشته‌ای؟
 *   نام کالاهای واقعی طولانی‌اند («کراپ کت لینن نچرال سایز یک و دو
 *   چند رنگ»). کاربر می‌گوید «کراپ کت لینن». مقایسه‌ی کل رشته امتیاز
 *   پایینی می‌دهد، در حالی که این تطبیق کاملاً درست است.
 *
 *   پس هر واژه‌ی گفته‌شده جداگانه در نام جستجو می‌شود و نسبت
 *   واژه‌های یافت‌شده امتیاز را می‌سازد.
 */
export function similarity(spoken: string, candidate: string): number {
  const s = normalizePersian(spoken);
  const c = normalizePersian(candidate);
  if (!s || !c) return 0;
  if (c === s) return 1;

  const sWords = s.split(" ").filter((w) => w.length > 1);
  const cWords = c.split(" ").filter(Boolean);
  if (sWords.length === 0) return 0;

  let hit = 0;
  for (const w of sWords) {
    const exact = cWords.some((cw) => cw === w || cw.startsWith(w) || w.startsWith(cw));
    if (exact) { hit += 1; continue; }
    // یک حرف اشتباه در تشخیص گفتار رایج است
    const tol = w.length <= 4 ? 1 : 2;
    if (cWords.some((cw) => editDistance(w, cw, tol) <= tol)) hit += 0.75;
  }

  const coverage = hit / sWords.length;
  // نام کوتاه‌تر که همه‌ی واژه‌ها را دارد بر نام بلند ترجیح دارد
  const brevity = Math.min(1, sWords.length / Math.max(1, cWords.length));
  return coverage * (0.85 + 0.15 * brevity);
}

/**
 * حداقل امتیاز برای اینکه یک گزینه اصلاً پیشنهاد شود.
 *
 * ۰٫۶۵ حدس نیست — روی کاتالوگ واقعی ۳۷۵ کالایی اندازه‌گیری شد:
 *
 *   آستانه | تطبیق درست | مثبت کاذب
 *   0.50   |   14/14    |   2/6
 *   0.55   |   14/14    |   1/6
 *   0.65   |   14/14    |   0/6      ← انتخاب‌شده
 *
 * در ۰٫۵ عبارت «یخچال ساید بای ساید» به «ست بلوز و شلوار میله ای
 * سایز بندی...» می‌خورد (چون «ساید»≈«سایز») و «لپ تاپ ایسوس» به
 * «کراپ تاپ حلقه ای». پیشنهاد کالای بی‌ربط بدتر از «پیدا نشد» است.
 */
export const MATCH_THRESHOLD = 0.65;

/**
 * بهترین گزینه‌ها را مرتب برمی‌گرداند.
 *
 * ⚠️ عمداً هرگز «بهترین» را خودکار انتخاب نمی‌کند. تشخیص گفتار
 * فارسی به‌اندازه‌ای دقیق نیست که بتوان بدون تأیید، کالا به فاکتور
 * مشتری اضافه کرد. یک اشتباه یعنی فاکتور غلط.
 */
export function rankMatches<T>(
  spoken: string,
  items: T[],
  getName: (item: T) => string,
  limit = 6
): Scored<T>[] {
  return items
    .map((item) => ({ item, score: similarity(spoken, getName(item)) }))
    .filter((x) => x.score >= MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
