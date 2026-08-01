"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { toFaDigits } from "@/lib/utils/format";

/**
 * صفحه‌بندی سمت کلاینت برای فهرست‌های بلند.
 *
 * مسئله‌ای که حل می‌کند:
 *   صفحه‌ی اشخاص هر ۵۴۳ ردیف را یکجا رندر می‌کرد و ۲۵٬۴۴۷ گره DOM
 *   می‌ساخت، در حالی که کاربر همزمان حدود ۱۵ ردیف می‌بیند. این هم
 *   حافظه و زمان رندر می‌برد و هم پیمایش را دشوار می‌کند.
 *
 * چرا سمت کلاینت و نه سمت سرور؟
 *   جستجو، فیلتر و مرتب‌سازی این صفحات روی کل مجموعه انجام می‌شود.
 *   بردن صفحه‌بندی به سرور یعنی بازنویسی آن منطق و چند رفت‌وبرگشت
 *   شبکه‌ای بیشتر. داده از قبل واکشی شده؛ فقط رندر را محدود می‌کنیم.
 *   (اگر روزی تعداد ردیف‌ها از چند هزار گذشت، آن‌وقت نوبت سرور است.)
 */

export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

/** برش دادن آرایه به صفحه‌ی جاری، همراه با وضعیت صفحه‌بندی. */
export function usePagination<T>(items: T[], defaultSize: number = 50) {
  const [pageSize, setPageSize] = useState<number>(defaultSize);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  // با تغییر فیلتر ممکن است شماره‌ی صفحه از محدوده خارج شود.
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  const paged = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize]
  );

  return {
    paged,
    page,
    setPage,
    pageSize,
    setPageSize: (size: number) => {
      setPageSize(size);
      setPage(1);
    },
    totalPages,
    total: items.length,
  };
}

/** شماره‌ی صفحات با «…» برای فهرست‌های طولانی. */
function pageWindow(current: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "gap")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) out.push("gap");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < total - 1) out.push("gap");
  out.push(total);
  return out;
}

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
  className,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  className?: string;
}) {
  // یک صفحه یعنی چیزی برای پیمایش نیست؛ فقط شمارش را نشان می‌دهیم.
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="صفحه‌بندی"
      className={cn(
        "flex flex-col items-center justify-between gap-3 border-t border-border pt-3 sm:flex-row",
        className
      )}
    >
      <p className="text-2xs text-muted-foreground">
        نمایش {toFaDigits(from)}–{toFaDigits(to)} از {toFaDigits(total)}
      </p>

      <div className="flex items-center gap-3">
        {onPageSizeChange && (
          <label className="flex items-center gap-1.5 text-2xs text-muted-foreground">
            <span className="hidden sm:inline">در هر صفحه</span>
            <select
              aria-label="تعداد سطر در هر صفحه"
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className="min-h-9 rounded-lg border border-border bg-card px-2 text-2xs font-bold text-foreground"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {toFaDigits(size)}
                </option>
              ))}
            </select>
          </label>
        )}

        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              aria-label="صفحه قبل"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            >
              {/* در چیدمان راست‌به‌چپ، «قبل» به سمت راست اشاره می‌کند. */}
              <ChevronRight size={16} />
            </button>

            {pageWindow(page, totalPages).map((item, index) =>
              item === "gap" ? (
                <span key={`gap-${index}`} className="px-1 text-2xs text-muted-foreground">
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => onPageChange(item)}
                  aria-current={item === page ? "page" : undefined}
                  aria-label={`صفحه ${item}`}
                  className={cn(
                    "inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-2xs font-bold tabular-nums transition",
                    item === page
                      ? "bg-primary text-primary-foreground"
                      : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {toFaDigits(item)}
                </button>
              )
            )}

            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
              aria-label="صفحه بعد"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
