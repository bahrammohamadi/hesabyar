import { createHash, randomInt } from "node:crypto";
import { RESET_CODE_LENGTH } from "./recovery.shared";

/**
 * بازیابی رمز عبور — بخش سروری.
 *
 * ⚠️ این فایل `node:crypto` دارد و **هرگز نباید** از یک کامپوننت
 * کلاینت import شود. هر چیزی که مرورگر لازم دارد در
 * `recovery.shared.ts` است.
 */

export * from "./recovery.shared";

/**
 * تولید کد بازیابی.
 *
 * 🔴 چرا `randomInt` و نه `Math.random()`؟
 *   `Math.random()` از نظر رمزنگاری امن نیست و خروجی‌اش قابل
 *   پیش‌بینی است. برای چیزی که کلید ورود به حساب مالی است، مولد
 *   امن الزامی است.
 *
 * 🔴 چرا ۸ رقم و نه ۶؟
 *   کد ۶ رقمی ۱۰⁶ حالت دارد و با اعتبار ۳۰ دقیقه حدس‌زدنش شدنی
 *   است. ۸ رقم یعنی ۱۰⁸ حالت، به‌علاوه‌ی سقف ۵ تلاش.
 */
export function generateResetCode(): string {
  let code = "";
  for (let i = 0; i < RESET_CODE_LENGTH; i++) {
    code += String(randomInt(0, 10));
  }
  return code;
}

/**
 * هش کد بازیابی.
 *
 * ⚠️ نمک ثابت عمدی است و باید باشد: هنگام **راستی‌آزمایی** فقط کد را
 * داریم و باید همان هش بازتولید شود. نمک تصادفی این را ناممکن
 * می‌کرد مگر با ذخیره‌ی جداگانه‌اش.
 *
 * ⚠️ چرا SHA-256 و نه bcrypt؟ فضای ورودی فقط ۱۰⁸ است و کد ۳۰ دقیقه
 * عمر دارد؛ bcrypt کند است و در مسیر ورود تأخیر می‌سازد. محافظت
 * واقعی از **سقف تلاش** و **انقضا** می‌آید، نه از کندی هش.
 * (اگر روزی کد حروف‌دار و بلندمدت شد، باید bcrypt شود.)
 */
export function hashResetCode(code: string, pepper: string): string {
  return createHash("sha256")
    .update(`${pepper}:${code.trim()}`)
    .digest("hex");
}
