"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Boxes, CreditCard, Edit, Eye, History, MessageCircle, MoreVertical, PackageSearch, Phone, Plus, Send, ShoppingCart, Zap } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { EntityAction, EntityType } from "@/lib/entities/types";
import { getDefaultEntityActions } from "@/lib/entities/actions";
import { usePermission } from "@/lib/hooks/usePermission";

const EntityQuickView = dynamic(() => import("./entity-quick-view").then((mod) => mod.EntityQuickView), {
  ssr: false,
});

function ActionIcon({ id }: { id: string }) {
  if (id === "quick-view") return <Zap size={16} />;
  if (id === "view") return <Eye size={16} />;
  if (id === "call") return <Phone size={16} />;
  if (id === "sms") return <Send size={16} />;
  if (id === "whatsapp") return <MessageCircle size={16} />;
  if (id === "new-sale") return <ShoppingCart size={16} />;
  if (id === "new-purchase") return <Plus size={16} />;
  if (id === "payment") return <CreditCard size={16} />;
  if (id === "interaction") return <Activity size={16} />;
  if (id === "edit" || id === "price-change") return <Edit size={16} />;
  if (id === "adjust-stock") return <Boxes size={16} />;
  if (id === "movements" || id === "stock-history") return <History size={16} />;
  return <PackageSearch size={16} />;
}

export function EntityActionMenu({
  type,
  id,
  label,
  phone,
  actions,
  actionFilter,
  align = "left",
  className,
}: {
  type: EntityType;
  id?: string | null;
  label?: string | null;
  phone?: string | null;
  actions?: EntityAction[];
  actionFilter?: (action: EntityAction) => boolean;
  align?: "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { can } = usePermission();
  const menuActions = useMemo(() => {
    const base = actions ?? getDefaultEntityActions({ type, id, phone });
    const permitted = base.filter((action) => can(action.requiredPermission));
    return actionFilter ? permitted.filter(actionFilter) : permitted;
  }, [actions, actionFilter, can, id, phone, type]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!menuActions.length) return null;

  return (
    <div ref={rootRef} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 active:scale-95"
        aria-label={label ? `عملیات ${label}` : "عملیات موجودیت"}
      >
        <MoreVertical size={17} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20 sm:hidden" />
          <div
            className={cn(
              "fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border border-slate-200 bg-white p-2 shadow-xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:top-11 sm:z-50 sm:w-52 sm:rounded-2xl",
              align === "left" ? "sm:left-0" : "sm:right-0"
            )}
            onClick={(event) => event.stopPropagation()}
          >
            {label && <div className="px-3 py-2 text-xs font-medium text-slate-400 sm:hidden">{label}</div>}
            <div className="space-y-1">
              {menuActions.map((action) => {
                const itemClass = cn(
                  "flex w-full items-center gap-2 rounded-xl px-3 py-3 text-right text-sm transition sm:py-2.5",
                  action.tone === "success" ? "text-emerald-700 hover:bg-emerald-50" :
                  action.tone === "danger" ? "text-rose-700 hover:bg-rose-50" :
                  action.tone === "primary" ? "text-brand-700 hover:bg-brand-50" :
                  "text-slate-700 hover:bg-slate-50",
                  action.disabled && "pointer-events-none opacity-50"
                );

                if (action.id === "quick-view") {
                  return (
                    <button
                      key={action.id}
                      type="button"
                      disabled={action.disabled || !id}
                      className={itemClass}
                      onClick={() => {
                        setOpen(false);
                        setQuickOpen(true);
                      }}
                    >
                      <ActionIcon id={action.id} />
                      {action.label}
                    </button>
                  );
                }

                if (!action.href) {
                  return (
                    <button key={action.id} type="button" disabled={action.disabled} className={itemClass} onClick={() => setOpen(false)}>
                      <ActionIcon id={action.id} />
                      {action.label}
                    </button>
                  );
                }

                if (action.external) {
                  return (
                    <a key={action.id} href={action.href} className={itemClass} onClick={() => setOpen(false)}>
                      <ActionIcon id={action.id} />
                      {action.label}
                    </a>
                  );
                }

                return (
                  <Link key={action.id} href={action.href} className={itemClass} onClick={() => setOpen(false)}>
                    <ActionIcon id={action.id} />
                    {action.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}

      <EntityQuickView open={quickOpen} onClose={() => setQuickOpen(false)} type={type} id={id} />
    </div>
  );
}
