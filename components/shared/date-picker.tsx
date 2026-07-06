"use client";

import React from "react";
import dayjs from "dayjs";
import jalaliday from "jalaliday";
import { toEnDigits, toFaDigits } from "@/lib/utils/format";

dayjs.extend(jalaliday);

interface DatePickerProps {
  value: string;
  onChange: (date: string) => void;
  label?: string;
  placeholder?: string;
}

function jalaliToGregorianInput(value: string) {
  const normalized = toEnDigits(value).replace(/[^0-9/]/g, "");
  if (!/^\d{4}\/\d{2}\/\d{2}$/.test(normalized)) return "";
  const [year, month, date] = normalized.split("/").map(Number);
  try {
    // @ts-ignore - jalaliday calendar typing is incomplete
    return (dayjs() as any).calendar("jalali").set("year", year).set("month", month - 1).set("date", date).calendar("gregorian").format("YYYY-MM-DD");
  } catch {
    return "";
  }
}

function toNativeDateValue(value: string) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(toEnDigits(value))) return jalaliToGregorianInput(value);
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("YYYY-MM-DD") : "";
}

function toJalaliDisplay(value: string) {
  if (!value) return "";
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(toEnDigits(value))) return toFaDigits(value);
  const parsed = dayjs(value);
  return parsed.isValid() ? toFaDigits(parsed.calendar("jalali").format("YYYY/MM/DD")) : "";
}

export function DatePicker({ value, onChange, label, placeholder = "YYYY-MM-DD" }: DatePickerProps) {
  const nativeValue = toNativeDateValue(value);
  const jalaliDisplay = toJalaliDisplay(value);

  return (
    <div className="w-full">
      {label && <label className="label">{label}</label>}
      <input
        type="date"
        dir="ltr"
        className="input text-left"
        value={nativeValue}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
      <p className="text-[10px] text-slate-400 mt-1">
        {jalaliDisplay ? `نمایش شمسی: ${jalaliDisplay}` : "برای انتخاب تاریخ، روی آیکون تقویم فیلد کلیک کنید."}
      </p>
    </div>
  );
}
