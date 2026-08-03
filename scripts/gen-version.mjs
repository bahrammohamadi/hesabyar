/**
 * تولید lib/version.generated.ts پیش از بیلد.
 *
 * چرا فایل تولیدی و نه process.env؟
 *   بلوک `env` در next.config فقط رخدادهای *لفظی* process.env.X را
 *   در کد جایگزین می‌کند. وقتی مقدار از یک ماژول مشترک با الگوی
 *   `process.env.X ?? "پیش‌فرض"` خوانده می‌شود، بسته‌بند آن را به یک
 *   ارجاع زمان‌اجرا تبدیل می‌کند و روی سرور مقدار پیش‌فرض برمی‌گردد.
 *   (بازتولیدشده: API نسخه‌ی «1.0/dev» می‌داد در حالی که بیلد 1.223
 *   بود؛ در باندل به‌جای عدد، `version:u.Gx` دیده می‌شد.)
 *
 *   فایل تولیدی مقدار را به‌صورت ثابت متنی می‌نویسد، پس هم سرور و هم
 *   کلاینت همان عدد را می‌بینند.
 */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

function sh(cmd, fallback = "") {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return fallback;
  }
}

const sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || sh("git rev-parse --short HEAD", "dev");
const count = sh("git rev-list --count HEAD", "");
const version = count ? `1.${count}` : sha !== "dev" ? `1.0-${sha}` : "1.0";

const out = `// این فایل خودکار ساخته می‌شود — دستی ویرایشش نکنید.
// منبع: scripts/gen-version.mjs (پیش از هر بیلد اجرا می‌شود)
export const APP_VERSION = ${JSON.stringify(version)};
export const APP_SHA = ${JSON.stringify(sha)};
export const APP_BUILT_AT = ${JSON.stringify(new Date().toISOString())};
`;

writeFileSync(new URL("../lib/version.generated.ts", import.meta.url), out);
console.log(`version → ${version} (${sha})`);

/*
  ⚠️ فایل تولیدی در گیت commit می‌شود (gitignore نشده).

  دلیل: اگر روزی prebuild اجرا نشود — مثلاً بیلد از یک آرشیو بدون
  npm scripts — نبودِ فایل کل بیلد را می‌شکند. با commit کردن، بدترین
  حالت یک نسخه‌ی کمی قدیمی است، نه بیلد شکسته.
*/
