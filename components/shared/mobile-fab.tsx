"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { usePermission } from "@/lib/hooks/usePermission";
import { usePanelManager } from "@/src/core/panel-manager/panel-manager.store";
import { Receipt, ShoppingCart, UserPlus, PackagePlus, X, Zap } from "lucide-react";

/**
 * دکمه‌ی شناور دسترسی سریع (موبایل).
 *
 * 🔴 مشکلی که داشت:
 *   «فاکتور جدید» و «خرید جدید» فقط لینک به /sales و /purchases بودند.
 *   کاربر روی دکمه می‌زد، صفحه عوض می‌شد، و باید *دوباره* دکمه‌ی
 *   دیگری می‌زد تا فرم باز شود. یعنی دو کلیک و یک ناوبری کامل برای
 *   کاری که در دسکتاپ یک کلیک بود.
 *
 *   حالا هر چهار مورد مستقیم همان پنل مشترکی را باز می‌کنند که بقیه‌ی
 *   برنامه استفاده می‌کند، بدون تغییر صفحه.
 */

type FabAction = {
  key: string;
  label: string;
  hint: string;
  icon: typeof Receipt;
  tone: string;
  permission: string;
} & ({ href: string; open?: never } | { href?: never; open: "sale" | "purchase" | "contact" | "product" });

const ACTIONS: FabAction[] = [
  { key: "sale", label: "فاکتور جدید", hint: "ثبت فروش", icon: Receipt, tone: "primary", permission: "sales.create", open: "sale" },
  { key: "purchase", label: "خرید جدید", hint: "ورود موجودی", icon: ShoppingCart, tone: "emerald", permission: "purchases.create", open: "purchase" },
  { key: "contact", label: "مشتری جدید", hint: "ثبت مخاطب", icon: UserPlus, tone: "cyan", permission: "contacts.edit", open: "contact" },
  { key: "product", label: "کالای جدید", hint: "تعریف کالا", icon: PackagePlus, tone: "violet", permission: "products.edit", open: "product" },
];

const toneClass: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  emerald: "bg-success-soft text-success-onSoft",
  cyan: "bg-info-soft text-info-onSoft",
  violet: "bg-primary/10 text-primary",
};

export function MobileFab() {
  const [open, setOpen] = useState(false);
  // portal فقط بعد از mount ممکن است؛ در SSR سند وجود ندارد.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { can } = usePermission();
  const { openDocument, openEntity } = usePanelManager();
  const actions = ACTIONS.filter((action) => can(action.permission));

  function runAction(action: FabAction) {
    setOpen(false);
    if (action.open === "sale") openDocument("sale", undefined, { mode: "create", context: "workspace" });
    else if (action.open === "purchase") openDocument("purchase", undefined, { mode: "create", context: "workspace" });
    else if (action.open === "contact") openEntity("contact", undefined, { mode: "create", context: "workspace", title: "مشتری جدید" });
    else if (action.open === "product") openEntity("product", undefined, { mode: "create", context: "workspace", title: "کالای جدید" });
  }

  const itemClass =
    "flex min-h-[56px] items-center gap-3 self-start rounded-2xl border border-white/70 bg-white/95 px-3.5 py-2.5 shadow-xl shadow-slate-900/10 backdrop-blur-xl active:scale-95";

  return (
    <div className="fixed bottom-[96px] left-4 z-40 lg:hidden">
      {open && (
        <>
          {/*
            🔴 پرده باید *بیرون* از این ظرف رندر شود.

            دو تلاش ناموفق قبل از رسیدن به این راه‌حل:
              ۱. پرده بدون z-index → روی دکمه‌ها می‌افتاد.
              ۲. پرده با `z-0` و منو با `z-10` → باز هم مسدود بود، چون
                 `z-0` خودش یک stacking context می‌سازد و ظرف والد
                 (`z-40`) هر دو را در یک لایه حبس می‌کند.

            Playwright هر بار همین را گزارش می‌داد:
              «<button aria-label="بستن"> … intercepts pointer events»
            یعنی منو دیده می‌شد ولی هیچ میان‌بری کلیک‌پذیر نبود و کاربر
            فکر می‌کرد برنامه هنگ کرده.

            راه‌حل همان الگوی PortalMenu در این پروژه است: پرده مستقیم
            به body می‌رود، پس اصلاً هم‌ظرفِ دکمه‌ها نیست.
          */}
          {mounted && createPortal(
            <button
              className="fixed inset-0 z-30 bg-foreground/25 backdrop-blur-[1px] lg:hidden"
              onClick={() => setOpen(false)}
              aria-label="بستن"
            />,
            document.body
          )}
          <div className="relative mb-3 flex flex-col gap-2">
            {actions.map((action) => {
              const Icon = action.icon;
              const body = (
                <>
                  <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl", toneClass[action.tone])}>
                    <Icon size={19} aria-hidden />
                  </span>
                  <span className="whitespace-nowrap text-right">
                    <span className="block text-sm font-extrabold text-foreground">{action.label}</span>
                    <span className="block text-2xs text-muted-foreground">{action.hint}</span>
                  </span>
                </>
              );

              // مسیرهایی که هنوز صفحه‌ی اختصاصی دارند لینک می‌مانند.
              if (action.href) {
                return (
                  <Link key={action.key} href={action.href} onClick={() => setOpen(false)} className={itemClass}>
                    {body}
                  </Link>
                );
              }

              return (
                <button key={action.key} type="button" onClick={() => runAction(action)} className={itemClass}>
                  {body}
                </button>
              );
            })}
          </div>
        </>
      )}

      <button
        onClick={() => setOpen((s) => !s)}
        disabled={actions.length === 0}
        className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-2xl shadow-primary/30 transition-transform active:scale-95 disabled:opacity-50"
        aria-label="دسترسی سریع"
      >
        {open ? <X size={24} aria-hidden /> : <Zap size={22} aria-hidden />}
      </button>
    </div>
  );
}
