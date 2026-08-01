"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { usePermission } from "@/lib/hooks/usePermission";
import { Plus, Receipt, ShoppingCart, UserPlus, PackagePlus, X, Zap } from "lucide-react";

const ACTIONS = [
  { href: "/sales", label: "فاکتور جدید", hint: "ثبت فروش", icon: Receipt, tone: "primary", permission: "sales.create" },
  { href: "/purchases", label: "خرید جدید", hint: "ورود موجودی", icon: ShoppingCart, tone: "emerald", permission: "purchases.create" },
  { href: "/contacts/new-customer", label: "مشتری جدید", hint: "ثبت مخاطب", icon: UserPlus, tone: "cyan", permission: "contacts.edit" },
  { href: "/products?action=new", label: "کالای جدید", hint: "تعریف کالا", icon: PackagePlus, tone: "violet", permission: "products.edit" },
];

const toneClass: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  emerald: "bg-success-soft text-success-onSoft",
  cyan: "bg-info-soft text-info-onSoft",
  violet: "bg-primary/10 text-primary",
};

export function MobileFab() {
  const [open, setOpen] = useState(false);
  const { can } = usePermission();
  const actions = ACTIONS.filter((action) => can(action.permission));

  return (
    <div className="fixed bottom-[96px] left-4 z-40 lg:hidden">
      {open && (
        <>
          <button className="fixed inset-0 bg-foreground/25 backdrop-blur-[1px]" onClick={() => setOpen(false)} aria-label="بستن" />
          <div className="relative mb-3 flex flex-col gap-2">
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-[56px] items-center gap-3 self-start rounded-2xl border border-white/70 bg-white/95 px-3.5 py-2.5 shadow-xl shadow-slate-900/10 backdrop-blur-xl active:scale-95"
                >
                  <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl", toneClass[action.tone])}>
                    <Icon size={19} />
                  </span>
                  <span className="whitespace-nowrap text-right">
                    <span className="block text-sm font-extrabold text-foreground">{action.label}</span>
                    <span className="block text-2xs text-muted-foreground">{action.hint}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </>
      )}

      <button
        onClick={() => setOpen((s) => !s)}
        disabled={actions.length === 0}
        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-2xl shadow-primary/30 transition-transform active:scale-95 disabled:opacity-50"
        aria-label="دسترسی سریع"
      >
        {open ? <X size={24} /> : <Zap size={22} />}
      </button>
    </div>
  );
}
