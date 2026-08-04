/**
 * قواعد رمز عبور — منبع واحد حقیقت.
 *
 * چرا جدا؟ سه جای مختلف رمز را بررسی می‌کنند (ثبت‌نام، ساخت کاربر
 * توسط مدیر، تغییر رمز) و پیش از این هرکدام قاعده‌ی خودش را داشت:
 *   app/register        → حداقل ۶ کاراکتر
 *   app/api/admin/users → حداقل ۸ کاراکتر + فهرست ضعیف
 *   تغییر رمز           → اصلاً وجود نداشت
 *
 * یعنی کاربری که خودش ثبت‌نام می‌کرد می‌توانست «123456» بگذارد ولی
 * همان رمز را مدیر نمی‌توانست برایش تعیین کند. حالا یک قاعده.
 */

export const MIN_PASSWORD_LENGTH = 8;
/** سقف bcrypt؛ فراتر از آن بی‌صدا بریده می‌شود. */
export const MAX_PASSWORD_LENGTH = 72;

/**
 * رمزهای پرتکرار.
 *
 * فهرست کوتاه و عمدی است: هدف گرفتن حدس‌های آشکار است، نه جایگزینی
 * یک بررسی کامل مثل haveibeenpwned. آوردن ۱۰ هزار رمز به باندل
 * کلاینت ارزشش را ندارد.
 *
 * ⚠️ شامل «12345678» است که رمز فعلی حساب‌های تست پروژه نیست ولی
 * «123456» هست — آن زیر حداقل طول می‌افتد و همان‌جا رد می‌شود.
 */
const COMMON_PASSWORDS = new Set([
  "12345678",
  "123456789",
  "1234567890",
  "password",
  "password1",
  "qwertyui",
  "qwerty123",
  "11111111",
  "00000000",
  "abcd1234",
  "iloveyou",
  "admin123",
  "welcome1",
  "letmein1",
  "monkey12",
  "trustno1",
]);

export type PasswordIssue =
  | "too_short"
  | "too_long"
  | "common"
  | "only_digits"
  | "same_as_current";

export const PASSWORD_MESSAGES: Record<PasswordIssue, string> = {
  too_short: `رمز عبور باید حداقل ${MIN_PASSWORD_LENGTH} کاراکتر باشد.`,
  too_long: `رمز عبور نباید بیشتر از ${MAX_PASSWORD_LENGTH} کاراکتر باشد.`,
  common: "این رمز عبور بسیار پرتکرار است. رمز دیگری انتخاب کنید.",
  only_digits: "رمز عبور نباید فقط عدد باشد؛ حداقل یک حرف اضافه کنید.",
  same_as_current: "رمز جدید نباید با رمز فعلی یکسان باشد.",
};

/**
 * اعتبارسنجی رمز.
 *
 * @param password رمز پیشنهادی
 * @param currentPassword رمز فعلی، اگر در دسترس باشد (فقط در تغییر رمز توسط خود کاربر)
 * @returns فهرست ایرادها؛ خالی یعنی قابل قبول
 */
export function validatePassword(password: string, currentPassword?: string): PasswordIssue[] {
  const issues: PasswordIssue[] = [];

  if (password.length < MIN_PASSWORD_LENGTH) issues.push("too_short");
  if (password.length > MAX_PASSWORD_LENGTH) issues.push("too_long");
  if (COMMON_PASSWORDS.has(password.toLowerCase())) issues.push("common");

  /*
    فقط عدد بودن.

    چرا این قاعده: شماره‌ی موبایل و کد ملی پرتکرارترین انتخاب کاربران
    ایرانی است و هر دو دقیقاً ۱۰ و ۱۱ رقم‌اند — یعنی از حداقل طول رد
    می‌شوند ولی حدس‌زدنشان ساده است.
  */
  if (password.length > 0 && /^\d+$/.test(password)) issues.push("only_digits");

  if (currentPassword && password === currentPassword) issues.push("same_as_current");

  return issues;
}

/** اولین پیام خطا، یا null اگر رمز قابل قبول باشد. */
export function firstPasswordError(password: string, currentPassword?: string): string | null {
  const issues = validatePassword(password, currentPassword);
  return issues.length > 0 ? PASSWORD_MESSAGES[issues[0]] : null;
}

/**
 * سنجش کیفیت برای نوار نمایشی — صفر تا چهار.
 *
 * عمداً ساده و بدون کتابخانه: این فقط بازخورد بصری است و ملاک
 * پذیرش نیست. ملاک پذیرش `validatePassword` است.
 */
export function passwordStrength(password: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  if (!password) return { score: 0, label: "" };

  let score = 0;
  if (password.length >= MIN_PASSWORD_LENGTH) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password) && /[^\w\s]/.test(password)) score++;

  // رمزهای رد شده هرگز «قوی» نشان داده نمی‌شوند.
  if (validatePassword(password).length > 0) score = Math.min(score, 1) as 0 | 1;

  const labels = ["بسیار ضعیف", "ضعیف", "متوسط", "خوب", "قوی"];
  return { score: score as 0 | 1 | 2 | 3 | 4, label: labels[score] };
}
