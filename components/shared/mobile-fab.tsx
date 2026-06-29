"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { Plus, Receipt, ShoppingCart, UserPlus, PackagePlus, X, Zap } from "lucide-react";

const ACTIONS = [
  { href: "/sales", label: "فاکتور جدید", icon: Receipt, tone: "bg-brand-600" },
  { href: "/purchases", label: "خرید جدید", icon: ShoppingCart, tone: "bg-emerald-600" },
  { href: "/contacts?action=new&type=customer", label: "مشتری جدید", icon: UserPlus, tone: "bg-cyan-600" },
  { href: "/products?action=new", label: "کالای جدید", icon: PackagePlus, tone: "bg-violet-600" },
];

export function MobileFab() {
  const [open, setOpen] = useState(false);

  return (
    <div className="sm:hidden fixed bottom-20 left-4 z-40">
      {open && (
        <>
          <button className="fixed inset-0 bg-black/20" onClick={() => setOpen(false)} aria-label="بستن" />
          <div className="relative mb-3 flex flex-col gap-2">
            {ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 self-start rounded-2xl bg-white shadow-lg border border-slate-200 px-4 py-3 min-h-12"
                >
                  <span className={cn("w-10 h-10 rounded-xl text-white flex items-center justify-center", action.tone)}>
                    <Icon size={18} />
                  </span>
                  <span className="text-sm font-medium text-slate-700 whitespace-nowrap">{action.label}</span>
                </Link>
              );
            })}
          </div>
        </>
      )}

      <button
        onClick={() => setOpen((s) => !s)}
        className="w-14 h-14 rounded-2xl bg-brand-600 text-white shadow-xl flex items-center justify-center active:scale-95 transition-transform"
        aria-label="دسترسی سریع"
      >
        {open ? <X size={24} /> : <Zap size={22} />}
      </button>
    </div>
  );
}
