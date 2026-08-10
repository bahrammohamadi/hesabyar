"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp } from "lucide-react";
import {
  ChartEmpty, ChartSkeleton, ChartTooltip, activeDot, axisProps,
  chartCursor, chartGradients, compactAxisNumber, gradientId,
  tickInterval, useChartAnimation,
} from "@/src/shared/ui";
import { formatToman, toFaDigits } from "@/lib/utils/format";

export type SalesChartPoint = { day: string; total: number };

/**
 * نمودار روند فروش داشبورد.
 *
 * 🔴 پیش از این، این فایل هیچ‌کدام از قطعات مشترک ChartKit را
 * استفاده نمی‌کرد و نسخه‌ی دست‌ساز خودش را داشت. نتیجه‌ی
 * اندازه‌گیری‌شده روی داده‌ی واقعی:
 *
 *     تیک‌های محور Y →  0k · 850k · 1.7M · 2.55M · 3.4M
 *
 * ارقام لاتین با پسوند انگلیسی، در برنامه‌ای که همه‌جایش فارسی
 * است. تابع `compactAxisNumber` که «۱٫۷ م» می‌سازد از قبل وجود
 * داشت ولی فقط در یک صفحه استفاده می‌شد.
 */
export function DashboardSalesChart({
  isLoading,
  data,
}: {
  isLoading: boolean;
  data: SalesChartPoint[] | undefined;
}) {
  const animate = useChartAnimation();

  /*
    روی موبایل تعداد تیک‌های محور X کمتر می‌شود تا برچسب‌ها روی هم
    نیفتند. matchMedia در useEffect خوانده می‌شود نه هنگام رندر،
    وگرنه سرور و کلاینت نتیجه‌ی متفاوت می‌دهند (hydration mismatch).
  */
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const points = data ?? [];

  /* خلاصه‌ی بالای نمودار — عدد درشت مهم‌تر از خودِ خط است. */
  const total = points.reduce((sum, p) => sum + p.total, 0);
  const peak = points.reduce<SalesChartPoint | null>(
    (best, p) => (best === null || p.total > best.total ? p : best),
    null
  );

  return (
    <div className="rounded-[1.75rem] border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <TrendingUp size={17} strokeWidth={2.2} aria-hidden />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-foreground">روند فروش</h2>
            <p className="text-2xs text-muted-foreground">۳۰ روز اخیر</p>
          </div>
        </div>
        <Link
          href="/reports"
          className="rounded-xl bg-muted px-3 py-1.5 text-2xs font-medium text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
        >
          گزارش کامل
        </Link>
      </div>

      {/*
        خلاصه‌ی عددی پیش از نمودار.
        کاربر معمولاً دنبال «چقدر فروختم» است، نه شکل منحنی؛ خواندن
        عدد از روی نمودار کار اضافه است.
      */}
      {!isLoading && points.length > 0 && (
        <div className="mb-4 flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <div>
            <span className="text-2xs text-muted-foreground">جمع دوره</span>
            <div className="text-lg font-black tabular-nums text-foreground">
              {formatToman(total)}
            </div>
          </div>
          {peak && peak.total > 0 && (
            <div>
              <span className="text-2xs text-muted-foreground">بیشترین روز</span>
              {/*
                🔴 مبلغ و تاریخ باید صریح از هم جدا شوند.
                نسخه‌ی اول فقط `mr-1.5` داشت و چون هر دو عدد فارسی‌اند،
                در چیدمان راست‌به‌چپ به هم می‌چسبیدند و «۳۳۷,۵۰۰۰۵/۰۳»
                خوانده می‌شد — یعنی مبلغ ۳۳۷٬۵۰۰ و تاریخ ۰۵/۰۳ یک عدد
                به نظر می‌رسیدند. (در اسکرین‌شات واقعی دیده شد.)

                حالا با flex و یک جداکنندهٔ «·» فاصله قطعی است.
              */}
              <div className="flex items-baseline gap-1.5 text-sm font-bold tabular-nums text-success-onSoft">
                <span>{formatToman(peak.total, false)}</span>
                <span aria-hidden className="text-muted-foreground">·</span>
                <span className="text-2xs font-medium text-muted-foreground">
                  {toFaDigits(peak.day)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <ChartSkeleton />
      ) : points.length === 0 ? (
        <ChartEmpty
          title="هنوز فروشی ثبت نشده"
          description="پس از ثبت اولین فاکتور، روند فروش اینجا نمایش داده می‌شود."
          icon={<TrendingUp size={22} aria-hidden />}
        />
      ) : (
        <div className="h-56 sm:h-64" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
              {chartGradients(["primary"])}
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="day"
                {...axisProps}
                interval={tickInterval(points.length, isMobile)}
              />
              <YAxis
                {...axisProps}
                tickFormatter={compactAxisNumber}
                width={isMobile ? 52 : 68}
              />
              {/*
                Tooltip مشترک: ارقام فارسی و واحد تومان.
                نسخه‌ی قبلی contentStyle دست‌ساز داشت که در حالت تیره
                هم درست بود ولی با بقیه‌ی نمودارها فرق می‌کرد.
              */}
              <Tooltip content={<ChartTooltip unit="تومان" />} cursor={chartCursor} />
              <Area
                type="monotone"
                dataKey="total"
                name="فروش"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                fill={`url(#${gradientId("primary")})`}
                dot={false}
                activeDot={{ ...activeDot, fill: "hsl(var(--primary))" }}
                isAnimationActive={animate}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
