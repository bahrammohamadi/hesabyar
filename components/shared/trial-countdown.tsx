"use client";

import Link from "next/link";
import { Sparkles, AlertTriangle, Clock } from "lucide-react";
import { useOrg } from "@/lib/hooks/useOrg";
import { getTrialStatus, type TrialTone } from "@/lib/trial";
import { toFaDigits } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/**
 * شمارنده‌ی دوره‌ی تست رایگان.
 *
 * فقط وقتی سازمان `trial_ends_at` دارد رندر می‌شود؛ برای سازمان‌های
 * قدیمی یا پولی (که این ستون خالی است) هیچ‌چیز نشان داده نمی‌شود —
 * همان الگوی DemoBanner.
 *
 * چرا حلقه‌ی SVG و نه نوار افقی ساده؟
 *   در هدر فضای عمودی کم است. حلقه در ۳۲px هم خوانا می‌ماند و روی
 *   موبایل بدون متن هم معنا دارد.
 */

const TONE: Record<TrialTone, { ring: string; text: string; bg: string; border: string }> = {
  success: {
    ring: "stroke-success", text: "text-success-onSoft",
    bg: "bg-success-soft", border: "border-success/25",
  },
  warning: {
    ring: "stroke-warning", text: "text-warning-onSoft",
    bg: "bg-warning-soft", border: "border-warning/30",
  },
  danger: {
    ring: "stroke-destructive", text: "text-destructive-text",
    bg: "bg-destructive/10", border: "border-destructive/30",
  },
  expired: {
    ring: "stroke-destructive", text: "text-destructive-text",
    bg: "bg-destructive/10", border: "border-destructive/40",
  },
};

/** حلقه‌ی پیشرفت. اندازه ثابت است تا در هدر جابه‌جایی ایجاد نکند. */
function ProgressRing({ progress, tone, label }: { progress: number; tone: TrialTone; label: string }) {
  const size = 34;
  const stroke = 3.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  // باقی‌مانده را پر نشان می‌دهیم (نه سپری‌شده) — حس «اعتبار» می‌دهد.
  const remaining = 1 - progress;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0 -rotate-90"
      role="img"
      aria-label={label}
    >
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" strokeWidth={stroke}
        className="stroke-foreground/10"
      />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - remaining)}
        className={cn(TONE[tone].ring, "transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none")}
      />
    </svg>
  );
}

export function TrialCountdown() {
  const { trialEndsAt, loading } = useOrg();
  const status = getTrialStatus(trialEndsAt);

  if (loading || !status.visible) return null;

  const { daysLeft, hoursLeft, totalDays, progress, tone, isExpired } = status;
  const t = TONE[tone];

  // روز آخر: ساعت دقیق‌تر و فوری‌تر از «۱ روز» است.
  const isLastDay = !isExpired && daysLeft <= 1;

  const headline = isExpired
    ? "دوره‌ی آزمایشی به پایان رسید"
    : isLastDay
    ? `تنها ${toFaDigits(hoursLeft)} ساعت از دوره‌ی آزمایشی باقی مانده`
    : `${toFaDigits(daysLeft)} روز از ${toFaDigits(totalDays)} روز باقی مانده`;

  const Icon = isExpired ? AlertTriangle : isLastDay ? Clock : Sparkles;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("border-b px-3 py-2 sm:px-5", t.bg, t.border)}
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="relative shrink-0">
            <ProgressRing progress={progress} tone={tone} label={headline} />
            {/* عدد داخل حلقه — روی موبایل تنها نشانه‌ی کمّی است */}
            {!isExpired && (
              <span
                aria-hidden
                className={cn(
                  "absolute inset-0 flex items-center justify-center text-2xs font-extrabold tabular-nums",
                  t.text
                )}
              >
                {toFaDigits(isLastDay ? hoursLeft : daysLeft)}
              </span>
            )}
          </div>

          <div className="min-w-0">
            <p className={cn("truncate text-xs font-extrabold sm:text-sm", t.text)}>
              <Icon size={13} className="ml-1 inline-block shrink-0 align-middle" aria-hidden />
              {headline}
            </p>
            {/*
              توضیح فقط روی صفحه‌های بزرگ‌تر؛ موبایل باید فشرده بماند.

              ⚠️ اینجا opacity-80 بود و کنتراست را از ۴.۵ به ۳.۶۹ می‌آورد
              (سنجش axe-core). شفافیت روی متنی که از قبل توکنِ دقیقاً
              کالیبره‌شده دارد، آن کالیبراسیون را خنثی می‌کند. حذف شد.
            */}
            <p className={cn("hidden truncate text-2xs sm:block", t.text)}>
              {isExpired
                ? "برای ادامه‌ی کار، یکی از پلن‌ها را فعال کنید."
                : "پس از پایان دوره، برای ادامه‌ی کار نیاز به فعال‌سازی پلن دارید."}
            </p>
          </div>
        </div>

        <Link
          href="/pricing"
          className={cn(
            "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-2xs font-extrabold transition sm:min-h-10 sm:px-4 sm:text-xs",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            isExpired || tone === "danger"
              ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
        >
          <Sparkles size={13} aria-hidden className="hidden sm:inline" />
          {isExpired ? "فعال‌سازی پلن" : "ارتقا"}
        </Link>
      </div>
    </div>
  );
}
