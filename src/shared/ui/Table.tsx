"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type Column<T> = {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  align?: "right" | "center" | "left";
  className?: string;
  /**
   * نقش ستون در نمای کارتی موبایل.
   *
   *  title    → عنوان بزرگ کارت (معمولاً نام یا شماره سند)
   *  subtitle → خط دوم زیر عنوان
   *  amount   → مقدار برجسته در سمت چپ سربرگ کارت
   *  action   → دکمه‌ی عملیات، در گوشه‌ی کارت
   *  meta     → پیش‌فرض؛ به‌صورت «برچسب: مقدار» در بدنه می‌آید
   *  hidden   → روی موبایل اصلاً نمایش داده نمی‌شود
   */
  mobile?: "title" | "subtitle" | "amount" | "action" | "meta" | "hidden";
};

/**
 * جدول داده با نمای کارتی خودکار روی موبایل.
 *
 * چرا لازم بود:
 *   جدول فروش روی صفحه‌ی ۳۹۰px عرضی ۷۶۷px داشت و داخل ظرف ۳۶۶px
 *   می‌نشست. یعنی کاربر فقط ۳ ستون از ۷ ستون را می‌دید و برای دیدن
 *   «مبلغ» و «وضعیت» باید افقی اسکرول می‌کرد — در حالی که این‌ها
 *   مهم‌ترین اطلاعات هر فاکتورند.
 *
 *   اسکرول افقی روی موبایل الگوی شناخته‌شده‌ی بدی است: کاربر نمی‌داند
 *   ستون پنهانی وجود دارد. تبدیل به کارت، همه‌ی داده را بدون اسکرول
 *   افقی نشان می‌دهد.
 *
 * سازگاری رو به عقب: اگر هیچ ستونی `mobile` نداشته باشد، اولین ستون
 * عنوان و آخرین ستون مقدار در نظر گرفته می‌شود، پس جدول‌های موجود
 * بدون تغییر کد بهتر می‌شوند.
 */
export function DataTable<T>({
  columns,
  rows,
  keyExtractor,
  empty,
  className,
  getRowProps,
  disableMobileCards = false,
}: {
  columns: Column<T>[];
  rows: T[];
  keyExtractor: (row: T, index: number) => string;
  empty?: ReactNode;
  className?: string;
  getRowProps?: (row: T, index: number) => HTMLAttributes<HTMLTableRowElement>;
  /** برای جدول‌هایی که واقعاً باید ماتریسی بمانند (مثل گزارش‌های مقایسه‌ای). */
  disableMobileCards?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        {empty ?? "داده‌ای برای نمایش وجود ندارد."}
      </div>
    );
  }

  // نقش‌ها را یک‌بار حساب می‌کنیم تا در حلقه‌ی ردیف‌ها تکرار نشود.
  const titleCol = columns.find((c) => c.mobile === "title") ?? columns[0];
  const subtitleCol = columns.find((c) => c.mobile === "subtitle");
  const amountCol =
    columns.find((c) => c.mobile === "amount") ??
    (columns.length > 1 ? columns[columns.length - 1] : undefined);
  const actionCol = columns.find((c) => c.mobile === "action");
  const metaCols = columns.filter(
    (c) =>
      c !== titleCol &&
      c !== subtitleCol &&
      c !== amountCol &&
      c !== actionCol &&
      c.mobile !== "hidden"
  );

  return (
    <>
      {/* ─── نمای جدولی: تبلت به بالا ─── */}
      <div
        className={cn(
          "overflow-auto rounded-2xl border border-border bg-card",
          disableMobileCards ? "block" : "hidden md:block",
          className
        )}
      >
        <table className="w-full min-w-[640px] text-right text-sm">
          <thead className="sticky top-0 z-10 bg-muted/70 text-xs text-muted-foreground backdrop-blur">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    "whitespace-nowrap px-4 py-3 font-extrabold",
                    column.align === "center" && "text-center",
                    column.align === "left" && "text-left",
                    column.className
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const rowProps = getRowProps?.(row, index) ?? {};
              return (
                <tr
                  {...rowProps}
                  key={keyExtractor(row, index)}
                  className={cn("border-t border-border transition hover:bg-muted/35", rowProps.className)}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        "whitespace-nowrap px-4 py-3",
                        column.align === "center" && "text-center",
                        column.align === "left" && "text-left",
                        column.className
                      )}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ─── نمای کارتی: موبایل ─── */}
      {!disableMobileCards && (
        <div className="space-y-2 md:hidden">
          {rows.map((row, index) => {
            const rowProps = getRowProps?.(row, index) ?? {};
            const { className: rowClass, onClick, ...restProps } = rowProps as HTMLAttributes<HTMLElement>;
            const clickable = Boolean(onClick);

            return (
              <div
                key={keyExtractor(row, index)}
                {...(restProps as HTMLAttributes<HTMLDivElement>)}
                onClick={onClick as HTMLAttributes<HTMLDivElement>["onClick"]}
                /*
                  ردیف قابل کلیک باید با کیبورد هم فعال شود.

                  ⚠️ role اینجا عمداً "button" نیست: کارت داخل خودش
                  منوی عملیات (یک button واقعی) دارد و button تودرتو
                  ساختار نامعتبر است — axe آن را nested-interactive
                  با شدت serious گزارش می‌کرد (۲۰ مورد در /sales).

                  "link" همان معنای «این کارت شما را به جایی می‌برد» را
                  می‌دهد بدون اینکه تودرتویی بسازد، چون منوی داخلی
                  button است نه link.
                */
                role={clickable ? "link" : undefined}
                tabIndex={clickable ? 0 : undefined}
                onKeyDown={
                  clickable
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          (onClick as (e: unknown) => void)?.(event);
                        }
                      }
                    : undefined
                }
                className={cn(
                  "rounded-2xl border border-border bg-card p-3.5 transition",
                  clickable && "cursor-pointer active:scale-[0.99] hover:border-primary/30",
                  rowClass
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-extrabold text-foreground">
                      {titleCol?.render(row)}
                    </div>
                    {subtitleCol && (
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {subtitleCol.render(row)}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {amountCol && (
                      <div className="text-left text-sm font-extrabold tabular-nums text-foreground">
                        {amountCol.render(row)}
                      </div>
                    )}
                    {actionCol && <div onClick={(e) => e.stopPropagation()}>{actionCol.render(row)}</div>}
                  </div>
                </div>

                {metaCols.length > 0 && (
                  <dl className="mt-3 space-y-1.5 border-t border-border pt-2.5">
                    {metaCols.map((column) => (
                      <div key={column.key} className="flex items-center justify-between gap-3">
                        <dt className="shrink-0 text-2xs text-muted-foreground">{column.header}</dt>
                        <dd className="min-w-0 truncate text-xs font-bold text-foreground">
                          {column.render(row)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
