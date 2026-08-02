"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
export { compactAxisNumber, tickInterval } from "./chart-utils";

/**
 * قطعات مشترک نمودارها.
 *
 * چرا متمرکز شد؟
 *   نمودار داشبورد از قبل گرادیان، نقطه‌ی فعال، خط راهنما و حالت خالی
 *   داشت؛ نمودارهای گزارش‌ها هیچ‌کدام را نداشتند. به‌جای کپی‌کردن آن
 *   جزئیات در پنج جا، اینجا یک‌بار تعریف می‌شود.
 *
 * همه‌ی رنگ‌ها از توکن معنایی می‌آیند تا حالت تاریک خودکار درست بماند.
 */

/* ── گرادیان زیر خط ───────────────────────────────────────────── */

export type GradientTone = "primary" | "success" | "warning" | "destructive";

const TONE_VAR: Record<GradientTone, string> = {
  primary: "--primary",
  success: "--success",
  warning: "--warning",
  destructive: "--destructive",
};

export const gradientId = (tone: GradientTone) => `chart-grad-${tone}`;

/**
 * تعریف گرادیان‌ها.
 *
 * ⚠️ چرا تابع ساده و نه کامپوننت؟
 *   Recharts فرزندان خود را بررسی می‌کند و فقط عناصری را رندر می‌کند
 *   که می‌شناسد. یک کامپوننت سفارشی که <defs> برمی‌گرداند نادیده
 *   گرفته می‌شد: خصیصه‌ی fill مقدار url(#chart-grad-primary) داشت
 *   ولی هیچ linearGradient در DOM ساخته نمی‌شد، پس ناحیه بی‌رنگ
 *   می‌ماند. (تأییدشده: querySelectorAll('linearGradient') آرایه‌ی
 *   خالی برمی‌گرداند.)
 *
 *   با فراخوانی مستقیم، <defs> به‌صورت المنت واقعی در درخت قرار
 *   می‌گیرد و Recharts آن را عبور می‌دهد.
 *
 * کاربرد: {chartGradients(["primary"])}
 */
export function chartGradients(tones: GradientTone[] = ["primary"]) {
  return (
    <defs>
      {tones.map((tone) => (
        <linearGradient key={tone} id={gradientId(tone)} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={`hsl(var(${TONE_VAR[tone]}))`} stopOpacity={0.28} />
          <stop offset="100%" stopColor={`hsl(var(${TONE_VAR[tone]}))`} stopOpacity={0.02} />
        </linearGradient>
      ))}
    </defs>
  );
}

/* ── پیکربندی مشترک محورها ────────────────────────────────────── */

/** ظاهر یکدست تیک‌ها. اندازه زیر ۱۲px نمی‌رود (کف مقیاس تایپوگرافی). */
export const axisTick = { fontSize: 12, fill: "hsl(var(--muted-foreground))" } as const;

export const axisProps = {
  tick: axisTick,
  axisLine: false,
  tickLine: false,
  stroke: "hsl(var(--border))",
} as const;

/**
 * خط راهنمای عمودی هنگام hover.
 * بدون آن، تطبیق نقطه با محور X روی نمودارهای شلوغ سخت است.
 */
export const chartCursor = {
  stroke: "hsl(var(--primary))",
  strokeWidth: 1,
  strokeDasharray: "4 3",
  strokeOpacity: 0.55,
} as const;

/** نقطه‌ی فعال هنگام hover — حلقه‌ی سفید دور نقطه تا روی خط گم نشود. */
export const activeDot = {
  r: 5,
  strokeWidth: 2,
  stroke: "hsl(var(--card))",
} as const;

/* ── حالت‌های بارگذاری و خالی ─────────────────────────────────── */

/**
 * اسکلت بارگذاری نمودار.
 *
 * چرا اسپینر کافی نبود؟ اسپینر ارتفاع نمی‌گیرد و با آمدن نمودار،
 * محتوای زیرش می‌پرد (CLS). اسکلت دقیقاً همان ارتفاع نهایی را دارد.
 */
export function ChartSkeleton({ className }: { className?: string }) {
  // ارتفاع میله‌ها ثابت است تا رندر سرور و کلاینت یکی باشد.
  const bars = [45, 70, 35, 85, 55, 75, 40, 65, 50, 80, 60, 90];
  return (
    <div
      className={cn("flex h-56 items-end gap-1.5 px-2 pb-6 sm:h-64", className)}
      role="status"
      aria-label="در حال بارگذاری نمودار"
    >
      {bars.map((h, i) => (
        <div
          key={i}
          className="flex-1 animate-pulse rounded-t-md bg-muted motion-reduce:animate-none"
          style={{ height: `${h}%`, animationDelay: `${i * 60}ms` }}
        />
      ))}
    </div>
  );
}

/** حالت خالی طراحی‌شده — به‌جای نمودار سفید و گیج‌کننده. */
export function ChartEmpty({
  title = "داده‌ای برای نمایش نیست",
  description,
  icon,
  className,
}: {
  title?: string;
  description?: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex h-56 flex-col items-center justify-center gap-2 text-center sm:h-64", className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        {icon ?? <BarChart3 size={22} aria-hidden />}
      </div>
      <p className="text-sm font-bold text-foreground">{title}</p>
      {description && <p className="max-w-xs text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}


/**
 * آیا کاربر کاهش حرکت را خواسته است؟
 *
 * بلوک سراسری prefers-reduced-motion در globals.css فقط انیمیشن CSS را
 * خنثی می‌کند. Recharts انیمیشن را در جاوااسکریپت اجرا می‌کند، پس باید
 * صریح خاموش شود — وگرنه وعده‌ی دسترس‌پذیری نصفه می‌ماند.
 *
 * خروجی را به prop `isAnimationActive` بدهید.
 */
export function useChartAnimation(): boolean {
  const [enabled, setEnabled] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setEnabled(!mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return enabled;
}
