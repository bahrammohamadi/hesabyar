"use client";

import React from "react";
import dayjs from "dayjs";
import jalaliday from "jalaliday";
import { toFaDigits } from "@/lib/utils/format";

dayjs.extend(jalaliday);

interface DatePickerProps {
  value: string;
  onChange: (date: string) => void;
  label?: string;
  placeholder?: string;
}

export function DatePicker({ value, onChange, label, placeholder = "۱۴۰۲/۰۱/۰۱" }: DatePickerProps) {
  // Convert ISO/Gregorian value to Jalali string for the input
  const jalaliValue = value 
    ? toFaDigits(dayjs(value).calendar("jalali").format("YYYY/MM/DD")) 
    : "";

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value; // Expected format: YYYY/MM/DD (Jalali)
    
    // Simple validation for YYYY/MM/DD
    if (/^\d{4}\/\d{2}\/\d{2}$/.test(input)) {
      // Convert Jalali input back to Gregorian ISO string for the database
      const gDate = dayjs().calendar("jalali").set('year', parseInt(input.split('/')[0])).set('month', parseInt(input.split('/')[1]) - 1).set('date', parseInt(input.split('/')[2])).calendar('gregorian');
      onChange(gDate.toISOString());
    }
  };

  return (
    <div className="w-full">
      {label && <label className="label">{label}</label>}
      <div className="relative">
        <input
          type="text"
          className="input"
          value={jalaliValue}
          onChange={handleInputChange}
          placeholder={placeholder}
        />
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
          📅
        </div>
      </div>
      <p className="text-[10px] text-slate-400 mt-1">فرمت: سال/ماه/روز (شمسی)</p>
    </div>
  );
}
