/**
 * منطق دوره‌ی تست رایگان.
 *
 * عمداً یک تابع خالص جدا از کامپوننت است تا بتوان حالت‌های مرزی
 * (روز آخر، منقضی‌شده، تاریخ خراب) را بدون رندر تست کرد.
 */

/** طول پیش‌فرض دوره — باید با `trial_period_days()` در دیتابیس یکی باشد. */
export const TRIAL_TOTAL_DAYS = 14;

/** آستانه‌ها بر حسب روز باقی‌مانده. */
const WARNING_AT = 7;
const DANGER_AT = 3;

export type TrialTone = "success" | "warning" | "danger" | "expired";

export type TrialStatus = {
  /** روز کامل باقی‌مانده؛ برای تست منقضی‌شده صفر است، نه منفی. */
  daysLeft: number;
  /** ساعت باقی‌مانده — در روز آخر به‌جای «۰ روز» استفاده می‌شود. */
  hoursLeft: number;
  totalDays: number;
  /** نسبت سپری‌شده، بین ۰ و ۱ — برای حلقه‌ی پیشرفت. */
  progress: number;
  tone: TrialTone;
  isExpired: boolean;
  /** آیا باید به کاربر نشان داده شود؟ */
  visible: boolean;
};

/**
 * وضعیت تست را از تاریخ پایان محاسبه می‌کند.
 *
 * `now` تزریق‌پذیر است تا تست به ساعت سیستم وابسته نباشد.
 */
export function getTrialStatus(
  trialEndsAt: string | Date | null | undefined,
  now: Date = new Date(),
  totalDays: number = TRIAL_TOTAL_DAYS
): TrialStatus {
  const hidden: TrialStatus = {
    daysLeft: 0, hoursLeft: 0, totalDays,
    progress: 0, tone: "success", isExpired: false, visible: false,
  };

  if (!trialEndsAt) return hidden;

  const end = trialEndsAt instanceof Date ? trialEndsAt : new Date(trialEndsAt);
  // تاریخ خراب نباید کل هدر را بشکند.
  if (Number.isNaN(end.getTime())) return hidden;

  const msLeft = end.getTime() - now.getTime();
  const isExpired = msLeft <= 0;

  /*
    ceil استفاده می‌شود نه floor: اگر ۱۰ ساعت مانده، کاربر باید
    «۱ روز» ببیند نه «۰ روز». صفر فقط یعنی واقعاً تمام شده.
  */
  const daysLeft = isExpired ? 0 : Math.ceil(msLeft / 86_400_000);
  const hoursLeft = isExpired ? 0 : Math.max(1, Math.ceil(msLeft / 3_600_000));

  const elapsed = totalDays - daysLeft;
  const progress = Math.min(1, Math.max(0, elapsed / totalDays));

  let tone: TrialTone;
  if (isExpired) tone = "expired";
  else if (daysLeft <= DANGER_AT) tone = "danger";
  else if (daysLeft <= WARNING_AT) tone = "warning";
  else tone = "success";

  return { daysLeft, hoursLeft, totalDays, progress, tone, isExpired, visible: true };
}
