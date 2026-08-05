"use client";

import { cloneElement, forwardRef, isValidElement, useId, type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";
import { HelpTip } from "./HelpTip";
import { toEnglishDigits, toPersianDigits } from "@/src/shared/format";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn("input", className)} {...props} />;
});

export function NumberInput({ value, onValueChange, className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & { value?: number | null; onValueChange?: (value: number | null) => void }) {
  const display = value === null || value === undefined ? "" : toPersianDigits(Math.trunc(value).toLocaleString("en-US"));
  return (
    <input
      inputMode="numeric"
      dir="ltr"
      className={cn("input text-left tabular-nums", className)}
      value={display}
      onChange={(event) => {
        const normalized = toEnglishDigits(event.target.value).replace(/,/g, "").replace(/[^0-9-]/g, "");
        onValueChange?.(normalized === "" || normalized === "-" ? null : Number(normalized));
      }}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn("input", className)} {...props}>{children}</select>;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("input min-h-28 resize-y", className)} {...props} />;
}

/**
 * برچسب + ورودی + راهنما/خطا.
 *
 * 🔴 باگی که axe روی سایت زنده گرفت: عنوان در `<span>` بود، نه
 * `<label>`. یعنی هیچ ورودی‌ای برچسب متصل نداشت و صفحه‌خوان فقط
 * «edit text» می‌گفت. ۷۷ فیلد در ۹ فایل — از فرم کالا و شخص تا
 * پرداخت فاکتور — همگی همین ایراد را داشتند.
 * (axe: `label` و `select-name`، هر دو با شدت critical.)
 *
 * چرا `htmlFor` و نه `<label>` دورِ ورودی؟
 *   دکمه‌ی راهنما («؟») داخل همین برچسب است. با پیچیدن label دور
 *   کل محتوا، کلیک روی آن دکمه به ورودی منتقل می‌شد و منوی راهنما
 *   عملاً باز نمی‌ماند. `htmlFor` این تداخل را ندارد.
 *
 * شناسه از `useId` می‌آید تا در رندر سرور و کلاینت یکی باشد؛ اگر
 * فراخوان خودش `id` داده باشد، همان محترم شمرده می‌شود.
 */
export function Field({ label, required, error, hint, children, className }: { label: string; required?: boolean; error?: string | null; hint?: string; children: ReactNode; className?: string }) {
  const autoId = useId();

  /*
    شناسه فقط به عنصر ورودی داده می‌شود. اگر children یک عنصر معتبر
    نباشد (مثلاً چند عنصر یا متن ساده)، برچسب بدون htmlFor می‌ماند —
    بهتر از تولید ارجاع به شناسه‌ای که وجود ندارد.
  */
  const child = isValidElement(children)
    ? (children as ReactElement<{ id?: string; "aria-describedby"?: string }>)
    : null;
  const controlId = child?.props?.id ?? (child ? autoId : undefined);

  const hintId = hint && controlId ? `${controlId}-hint` : undefined;
  const errorId = error && controlId ? `${controlId}-error` : undefined;
  /*
    راهنما و خطا با aria-describedby به ورودی وصل می‌شوند، وگرنه
    صفحه‌خوان متن خطا را هرگز اعلام نمی‌کند و کاربر نمی‌فهمد چرا فرم
    ثبت نشد. ترتیب مهم است: خطا پیش از راهنما خوانده شود.
  */
  const described = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  /*
    یک بار clone، نه دو بار — هر clone یک شیء تازه می‌سازد و
    cloneElement تودرتو باعث می‌شد prop مرحله‌ی اول بازنویسی شود.
    هیچ عنصر پوششی اضافه نمی‌شود: یک <div> اضافه، شبکه‌ها و
    container queryهای موجود را می‌شکند.
  */
  const content =
    child && (!child.props.id || described)
      ? cloneElement(child, {
          id: controlId,
          ...(described
            ? { "aria-describedby": [child.props["aria-describedby"], described].filter(Boolean).join(" ") }
            : {}),
        })
      : children;

  return (
    <div className={cn("block space-y-1.5", className)}>
      <label
        htmlFor={controlId}
        className="flex items-center gap-1.5 text-sm font-bold text-foreground"
      >
        <span>{label} {required && <span className="text-destructive">*</span>}</span>
        {/* روی موبایل جای متن راهنما نیست؛ فقط آنجا دکمه نشان داده می‌شود. */}
        <HelpTip text={hint} className="sm:hidden" />
      </label>
      {content}
      {error ? <span id={errorId} className="block text-xs leading-5 text-destructive">{error}</span> : hint ? <span id={hintId} className="hidden text-xs leading-5 text-muted-foreground sm:block">{hint}</span> : null}
    </div>
  );
}
