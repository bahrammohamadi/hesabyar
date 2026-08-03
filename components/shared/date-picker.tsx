"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import jalaliday from "jalaliday";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { toEnDigits, toFaDigits } from "@/lib/utils/format";

dayjs.extend(jalaliday);

interface DatePickerProps {
  value: string;
  onChange: (date: string) => void;
  label?: string;
  placeholder?: string;
}

const JALALI_MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
const WEEKDAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

function parseJalaliText(value: string) {
  const normalized = toEnDigits(value).replace(/-/g, "/");
  const match = normalized.match(/^((?:13|14)\d{2})\/(\d{1,2})\/(\d{1,2})$/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) };
}

function gregorianToJalali(value: string) {
  if (!value) return null;
  const parsedJalali = parseJalaliText(value);
  if (parsedJalali) return parsedJalali;
  const parsed = dayjs(value);
  if (!parsed.isValid()) return null;
  // @ts-ignore jalaliday calendar typing is incomplete
  const j = parsed.calendar("jalali");
  return { year: Number(j.format("YYYY")), month: j.month(), day: Number(j.format("D")) };
}

function jalaliToGregorian({ year, month, day }: { year: number; month: number; day: number }) {
  // @ts-ignore jalaliday calendar typing is incomplete
  return (dayjs() as any).calendar("jalali").set("year", year).set("month", month).set("date", day).calendar("gregorian").format("YYYY-MM-DD");
}

function daysInJalaliMonth(year: number, month: number) {
  if (month <= 5) return 31;
  if (month <= 10) return 30;
  // نگه‌داشتن ۳۰ برای سال‌های کبیسه/غیرکبیسه باعث جلوگیری از حذف انتخاب کاربر می‌شود؛ تبدیل dayjs تاریخ نامعتبر را نرمال می‌کند.
  return 30;
}

export function DatePicker({ value, onChange, label, placeholder = "انتخاب تاریخ" }: DatePickerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const initial = gregorianToJalali(value) ?? (() => {
    // @ts-ignore
    const today = (dayjs() as any).calendar("jalali");
    return { year: Number(today.format("YYYY")), month: today.month(), day: Number(today.format("D")) };
  })();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [viewYear, setViewYear] = useState(initial.year);
  const [viewMonth, setViewMonth] = useState(initial.month);

  const selected = gregorianToJalali(value);
  const days = daysInJalaliMonth(viewYear, viewMonth);
  const firstDayOffset = (dayjs(jalaliToGregorian({ year: viewYear, month: viewMonth, day: 1 })).day() + 1) % 7;
  const years = useMemo(() => Array.from({ length: 101 }, (_, index) => viewYear - 50 + index), [viewYear]);
  const display = selected ? `${toFaDigits(selected.year)}/${toFaDigits(String(selected.month + 1).padStart(2, "0"))}/${toFaDigits(String(selected.day).padStart(2, "0"))}` : "";

  useEffect(() => {
    if (open) setDraft(display);
  }, [open, display]);

  /*
    🔴 باگی که کاربر گزارش کرد:
      «روی از تاریخ کلیک می‌کنم، بعد جای خالی صفحه را می‌زنم و
       پنجره‌ی تقویم بسته نمی‌شود؛ یا باید تاریخ انتخاب کنم یا دوباره
       روی همان باکس کلیک کنم.»

    ریشه: این کامپوننت هیچ شنونده‌ای برای کلیکِ بیرون نداشت. تنها سه
    راه بسته‌شدن وجود داشت: انتخاب روز، دکمه‌ی «بستن»، یا toggle شدن
    خود دکمه. این خلاف انتظار استاندارد از هر popover است — به‌ویژه
    در فیلتر بازه که دو تقویم کنار هم‌اند و کاربر مدام بین‌شان
    جابه‌جا می‌شود.

    چرا pointerdown و نه click؟
      اگر روی یک دکمه‌ی دیگر (مثلاً میان‌بر «این ماه») کلیک شود،
      click بعد از mouseup می‌آید؛ pointerdown زودتر تقویم را می‌بندد
      و جابه‌جایی چیدمان، هدفِ کلیک را از زیر انگشت کاربر در نمی‌برد.

    چرا فاز capture؟
      این تقویم داخل پنل کشویی و مودال هم رندر می‌شود؛ آن لایه‌ها
      رویدادها را در فاز حباب متوقف می‌کنند و شنونده‌ی معمولی روی
      document هرگز اجرا نمی‌شد.
  */
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      // کلیک داخل خود تقویم (یا دکمه‌ی بازکننده) نباید ببندد.
      if (rootRef.current?.contains(target)) return;

      setOpen(false);

      /*
        آیا همان کلیک باید به عنصر زیرش هم برسد؟

        🔴 در تست واقعی با Playwright این اتفاق افتاد: تقویمِ «از تاریخ»
        در صفحه‌ی /sales باز بود؛ کلیک روی ناحیه‌ی خالی، روی یک ردیف
        جدول افتاد و پنل فاکتور فروش باز شد. کاربری که فقط می‌خواست
        تقویم را ببندد، ناگهان یک پنجره‌ی ناخواسته می‌گیرد و باید
        ببنددش.

        پس کلیکِ بعدی بلعیده می‌شود — همان قراردادی که PortalMenu
        در همین پروژه دارد (پرده‌ی نامرئی که کلیک اول را می‌خورد).

        ⚠️ اما یک استثنا لازم است: اگر کاربر مستقیم روی دکمه‌ی یک
        تقویم دیگر بزند (مثل جابه‌جایی «از تاریخ» → «تا تاریخ» که در
        فیلتر بازه مدام تکرار می‌شود)، بلعیدن کلیک یعنی باید دوبار
        کلیک کند — دقیقاً همان اصطکاکی که کاربر از آن شکایت داشت.
        این حالت با data-attribute تشخیص داده و مستثنا می‌شود.
      */
      const el = target instanceof Element ? target : (target as any).parentElement;
      if (el?.closest?.("[data-datepicker-trigger]")) return;

      function swallow(clickEvent: MouseEvent) {
        clickEvent.stopPropagation();
        clickEvent.preventDefault();
      }
      document.addEventListener("click", swallow, true);
      /*
        شنونده باید حتماً برداشته شود، حتی اگر هیچ click‌ای نیاید
        (مثلاً کاربر انگشتش را بکشد و pointercancel شود). وگرنه
        کلیکِ بعدیِ کاملاً بی‌ربط کاربر هم بلعیده می‌شود.
      */
      setTimeout(() => document.removeEventListener("click", swallow, true), 0);
    }

    /*
      Escape هم باید ببندد، ولی فقط همین لایه.
      stopPropagation لازم است چون PanelHost و Modal هم روی Escape
      گوش می‌دهند؛ بدون آن یک Escape هم تقویم و هم پنل زیرین را
      می‌بست و کاربر کل فرم نیمه‌کاره را از دست می‌داد.
      (همان الگوی به‌کاررفته در Modal و PortalMenu)
    */
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  function applyTypedDate(text: string) {
    const parsed = parseJalaliText(text);
    if (!parsed) return;
    setViewYear(parsed.year);
    setViewMonth(parsed.month);
    onChange(jalaliToGregorian(parsed));
  }

  function choose(day: number) {
    onChange(jalaliToGregorian({ year: viewYear, month: viewMonth, day }));
    setOpen(false);
  }

  function shiftMonth(delta: number) {
    const nextMonth = viewMonth + delta;
    if (nextMonth < 0) {
      setViewYear((year) => year - 1);
      setViewMonth(11);
    } else if (nextMonth > 11) {
      setViewYear((year) => year + 1);
      setViewMonth(0);
    } else {
      setViewMonth(nextMonth);
    }
  }

  return (
    <div className="relative w-full" ref={rootRef}>
      {label && <label className="label">{label}</label>}
      <button
        type="button"
        /*
          data-datepicker-trigger: به تقویمِ *دیگری* که همین حالا باز
          است می‌گوید «کلیک را نبلع» تا جابه‌جایی بین «از تاریخ» و
          «تا تاریخ» با یک کلیک انجام شود، نه دو کلیک.
        */
        data-datepicker-trigger
        aria-expanded={open}
        className="input flex items-center justify-between text-right"
        onClick={() => setOpen((state) => !state)}
      >
        <span className={display ? "font-medium text-foreground" : "text-muted-foreground"}>{display || placeholder}</span>
        <CalendarDays size={18} className="text-muted-foreground" />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="انتخاب تاریخ"
          className="absolute z-[1500] mt-2 w-full min-w-[280px] rounded-2xl border border-border bg-card p-3 shadow-2xl"
          dir="rtl"
        >
          <div className="mb-3">
            <input
              aria-label="تاریخ را تایپ کنید"
              className="input h-10 min-h-10 text-center text-sm"
              dir="ltr"
              placeholder="۱۴۰۲/۰۱/۰۱"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                applyTypedDate(event.target.value);
              }}
            />
            <div className="mt-1 text-2xs text-muted-foreground">تاریخ را می‌توانید تایپ کنید یا از تقویم انتخاب کنید.</div>
          </div>
          <div className="mb-3 flex items-center justify-between gap-2">
            <button type="button" aria-label="ماه قبل" onClick={() => shiftMonth(-1)} className="rounded-xl p-2 text-muted-foreground hover:bg-muted"><ChevronRight size={18} aria-hidden /></button>
            <div className="flex flex-1 gap-2">
              <select aria-label="ماه" className="input h-10 min-h-10 py-1 text-sm" value={viewMonth} onChange={(event) => setViewMonth(Number(event.target.value))}>
                {JALALI_MONTHS.map((month, index) => <option key={month} value={index}>{month}</option>)}
              </select>
              <select aria-label="سال" className="input h-10 min-h-10 py-1 text-sm" value={viewYear} onChange={(event) => setViewYear(Number(event.target.value))}>
                {years.map((year) => <option key={year} value={year}>{toFaDigits(year)}</option>)}
              </select>
            </div>
            <button type="button" aria-label="ماه بعد" onClick={() => shiftMonth(1)} className="rounded-xl p-2 text-muted-foreground hover:bg-muted"><ChevronLeft size={18} aria-hidden /></button>
          </div>
          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-2xs font-bold text-muted-foreground">
            {WEEKDAYS.map((day) => <div key={day}>{day}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDayOffset }, (_, index) => <div key={`empty-${index}`} className="h-9" />)}
            {Array.from({ length: days }, (_, index) => index + 1).map((day) => {
              const active = selected?.year === viewYear && selected?.month === viewMonth && selected?.day === day;
              return <button key={day} type="button" onClick={() => choose(day)} className={`h-9 rounded-xl text-sm font-bold transition ${active ? "bg-primary text-white" : "text-foreground hover:bg-primary/10 hover:text-primary"}`}>{toFaDigits(day)}</button>;
            })}
          </div>
          <div className="mt-3 flex gap-2 border-t border-border pt-3">
            <button type="button" className="btn-secondary h-10 min-h-10 flex-1 text-xs" onClick={() => { const today = gregorianToJalali(dayjs().format("YYYY-MM-DD")); if (today) { setViewYear(today.year); setViewMonth(today.month); onChange(jalaliToGregorian(today)); } setOpen(false); }}>امروز</button>
            <button type="button" className="btn-secondary h-10 min-h-10 flex-1 text-xs" onClick={() => { onChange(""); setOpen(false); }}>پاک کردن</button>
            <button type="button" className="btn-secondary h-10 min-h-10 flex-1 text-xs" onClick={() => setOpen(false)}>بستن</button>
          </div>
        </div>
      )}
    </div>
  );
}
