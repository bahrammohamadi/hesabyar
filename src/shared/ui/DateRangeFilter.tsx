"use client";

import { useMemo } from "react";
import dayjs from "dayjs";
import jalaliday from "jalaliday";
import { CalendarRange, X } from "lucide-react";
import { DatePicker } from "@/components/shared/date-picker";
import { Button } from "./Button";
import { cn } from "@/lib/utils/cn";

dayjs.extend(jalaliday);

/**
 * فیلتر بازه‌ی تاریخ با میان‌برهای رایج.
 *
 * چرا میان‌بر لازم است؟ فروشنده معمولاً «امروز» یا «این ماه» را
 * می‌خواهد، نه یک بازه‌ی دلخواه. مجبورکردنش به باز کردن دو تقویم
 * برای پرتکرارترین کار، اصطکاک بی‌مورد است.
 *
 * مقادیر همیشه میلادی `YYYY-MM-DD` هستند (زبان دیتابیس)؛ نمایش با
 * DatePicker موجود شمسی است.
 */

export type { DateRange } from "./date-range-utils";
export { EMPTY_RANGE, withinRange } from "./date-range-utils";
import { EMPTY_RANGE, type DateRange } from "./date-range-utils";

/** ماه جاری شمسی به بازه‌ی میلادی. */
function jalaliMonthRange(offset = 0): DateRange {
  // @ts-ignore jalaliday typing is incomplete
  const j = dayjs().calendar("jalali").add(offset, "month");
  const start = j.startOf("month");
  const end = j.endOf("month");
  return {
    // @ts-ignore
    from: start.calendar("gregory").format("YYYY-MM-DD"),
    // @ts-ignore
    to: end.calendar("gregory").format("YYYY-MM-DD"),
  };
}

const PRESETS: { id: string; label: string; build: () => DateRange }[] = [
  {
    id: "today",
    label: "امروز",
    build: () => {
      const d = dayjs().format("YYYY-MM-DD");
      return { from: d, to: d };
    },
  },
  {
    id: "yesterday",
    label: "دیروز",
    build: () => {
      const d = dayjs().subtract(1, "day").format("YYYY-MM-DD");
      return { from: d, to: d };
    },
  },
  {
    id: "7d",
    label: "۷ روز اخیر",
    build: () => ({
      from: dayjs().subtract(6, "day").format("YYYY-MM-DD"),
      to: dayjs().format("YYYY-MM-DD"),
    }),
  },
  {
    id: "30d",
    label: "۳۰ روز اخیر",
    build: () => ({
      from: dayjs().subtract(29, "day").format("YYYY-MM-DD"),
      to: dayjs().format("YYYY-MM-DD"),
    }),
  },
  { id: "this-month", label: "این ماه", build: () => jalaliMonthRange(0) },
  { id: "last-month", label: "ماه گذشته", build: () => jalaliMonthRange(-1) },
];

export function DateRangeFilter({
  value,
  onChange,
  className,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}) {
  const active = useMemo(() => {
    if (!value.from && !value.to) return "";
    return PRESETS.find((p) => {
      const r = p.build();
      return r.from === value.from && r.to === value.to;
    })?.id ?? "custom";
  }, [value]);

  const hasFilter = Boolean(value.from || value.to);

  return (
    <div className={cn("space-y-2.5", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
          <CalendarRange size={14} aria-hidden />
          بازه‌ی تاریخ
        </span>
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.build())}
            aria-pressed={active === p.id}
            className={cn(
              "min-h-9 rounded-xl px-2.5 text-2xs font-bold transition",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              active === p.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
            )}
          >
            {p.label}
          </button>
        ))}
        {hasFilter && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onChange(EMPTY_RANGE)}
            icon={<X size={13} />}
          >
            حذف فیلتر
          </Button>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 sm:max-w-md">
        <div>
          <label className="mb-1 block text-2xs font-bold text-muted-foreground">از تاریخ</label>
          <DatePicker
            value={value.from}
            onChange={(from) => onChange({ ...value, from })}
            placeholder="ابتدای بازه"
          />
        </div>
        <div>
          <label className="mb-1 block text-2xs font-bold text-muted-foreground">تا تاریخ</label>
          <DatePicker
            value={value.to}
            onChange={(to) => onChange({ ...value, to })}
            placeholder="انتهای بازه"
          />
        </div>
      </div>
    </div>
  );
}
