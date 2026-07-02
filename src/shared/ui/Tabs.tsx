"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type TabItem = { value: string; label: ReactNode; content: ReactNode };

export function Tabs({ items, defaultValue, className }: { items: TabItem[]; defaultValue?: string; className?: string }) {
  const [active, setActive] = useState(defaultValue ?? items[0]?.value);
  return (
    <div className={className}>
      <div className="flex gap-1 rounded-2xl bg-muted p-1">
        {items.map((item) => (
          <button key={item.value} type="button" onClick={() => setActive(item.value)} className={cn("flex-1 rounded-xl px-3 py-2 text-xs font-extrabold transition", active === item.value ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-4">{items.find((item) => item.value === active)?.content}</div>
    </div>
  );
}
