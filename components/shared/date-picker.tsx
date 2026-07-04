"use client";

import React, { useEffect, useState } from "react";
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

function toJalaliInput(value: string) {
  return value ? toFaDigits(dayjs(value).calendar("jalali").format("YYYY/MM/DD")) : "";
}

export function DatePicker({ value, onChange, label, placeholder = "۱۴۰۲/۰۱/۰۱" }: DatePickerProps) {
  const [draft, setDraft] = useState(() => toJalaliInput(value));

  useEffect(() => {
    setDraft(toJalaliInput(value));
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextDraft = e.target.value;
    setDraft(nextDraft);

    const normalized = toEnDigits(nextDraft).replace(/[^0-9/]/g, "");
    if (!normalized.trim()) {
      onChange("");
      return;
    }

    if (/^\d{4}\/\d{2}\/\d{2}$/.test(normalized)) {
      const [year, month, date] = normalized.split("/").map(Number);
      // @ts-ignore - jalaliday calendar typing is incomplete
      const gDate = (dayjs() as any)
        .calendar("jalali")
        .set("year", year)
        .set("month", month - 1)
        .set("date", date)
        .calendar("gregorian");
      onChange(gDate.toISOString());
    }
  };

  return (
    <div className="w-full">
      {label && <label className="label">{label}</label>}
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          dir="ltr"
          className="input text-left pr-10"
          value={draft}
          onChange={handleInputChange}
          placeholder={placeholder}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
          📅
        </div>
      </div>
      <p className="text-[10px] text-slate-400 mt-1">فرمت: سال/ماه/روز (شمسی)</p>
    </div>
  );
}
