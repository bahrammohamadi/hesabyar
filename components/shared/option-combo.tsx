"use client";

import { useId } from "react";
import { useOptionList, type OptionKind } from "@/lib/hooks/useOptionList";

/**
 * کشویی با امکان تایپ آزاد.
 *
 * 🔴 چرا `datalist` و نه `select`؟
 *
 *   داده‌ی موجود این فیلدها **متن آزاد** است. اگر به `select` سفت
 *   تبدیل می‌کردیم، هر مقداری که در فهرست نیست از فرم ناپدید
 *   می‌شد — کاربر کالایی با رنگ «یشمی» را باز می‌کرد، فیلد خالی
 *   نشان داده می‌شد، و با ذخیره‌ی ساده آن مقدار **پاک** می‌شد.
 *
 *   با `datalist` هم پیشنهاد می‌دهیم و هم مقدار دلخواه را نگه
 *   می‌داریم. دقیقاً همان الگویی که سپیدار برای «واحد سنجش» دارد:
 *   فهرست قابل‌تعریف، ولی نه قفل.
 *
 * ⚠️ `datalist` روی همه‌ی مرورگرهای مدرن پشتیبانی می‌شود و به
 * جاوااسکریپت اضافه نیاز ندارد — روی موبایل هم به‌صورت بومی
 * رندر می‌شود.
 */
export function OptionCombo({
  kind,
  value,
  onChange,
  placeholder,
  className = "input",
  ariaLabel,
}: {
  kind: OptionKind;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const listId = useId();
  const { options } = useOptionList(kind);

  return (
    <>
      <input
        className={className}
        list={listId}
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id={listId}>
        {options.map((opt) => (
          <option key={opt} value={opt} />
        ))}
      </datalist>
    </>
  );
}
