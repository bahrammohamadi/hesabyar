"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type Column<T> = {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  align?: "right" | "center" | "left";
  className?: string;
};

export function DataTable<T>({ columns, rows, keyExtractor, empty, className }: { columns: Column<T>[]; rows: T[]; keyExtractor: (row: T, index: number) => string; empty?: ReactNode; className?: string }) {
  if (rows.length === 0) return <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{empty ?? "داده‌ای برای نمایش وجود ندارد."}</div>;
  return (
    <div className={cn("overflow-auto rounded-2xl border border-border bg-card", className)}>
      <table className="w-full min-w-[640px] text-right text-sm">
        <thead className="sticky top-0 z-10 bg-muted/70 text-xs text-muted-foreground backdrop-blur">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={cn("whitespace-nowrap px-4 py-3 font-extrabold", column.align === "center" && "text-center", column.align === "left" && "text-left", column.className)}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={keyExtractor(row, index)} className="border-t border-border transition hover:bg-muted/35">
              {columns.map((column) => (
                <td key={column.key} className={cn("whitespace-nowrap px-4 py-3", column.align === "center" && "text-center", column.align === "left" && "text-left", column.className)}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
