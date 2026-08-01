"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Activity, Boxes, CreditCard, Edit, Eye, History, MessageCircle, MoreVertical, PackageSearch, Phone, Plus, Send, ShoppingCart, Zap } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { PortalMenu } from "@/components/shared/portal-menu";
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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { can } = usePermission();
  const menuActions = useMemo(() => {
    const base = actions ?? getDefaultEntityActions({ type, id, phone });
    const permitted = base.filter((action) => can(action.requiredPermission));
    return actionFilter ? permitted.filter(actionFilter) : permitted;
  }, [actions, actionFilter, can, id, phone, type]);

  if (!menuActions.length) return null;

  return (
    <div ref={rootRef} className={cn("relative inline-flex", className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition hover:border-primary/20 hover:bg-primary/[0.06] hover:text-primary active:scale-95 sm:h-9 sm:w-9"
        aria-label={label ? `عملیات ${label}` : "عملیات موجودیت"}
      >
        <MoreVertical size={17} />
      </button>

      <PortalMenu anchorRef={buttonRef} open={open} onClose={() => setOpen(false)}>
        {label && <div className="px-3 py-2 text-xs font-medium text-muted-foreground sm:hidden">{label}</div>}
        <div className="space-y-1">
          {menuActions.map((action) => {
            const itemClass = cn(
              "flex w-full items-center gap-2 rounded-xl px-3 py-3 text-right text-sm transition sm:py-2.5",
              action.tone === "success" ? "text-success-onSoft hover:bg-success-soft" :
              action.tone === "danger" ? "text-destructive hover:bg-destructive/10" :
              action.tone === "primary" ? "text-primary hover:bg-primary/[0.06]" :
              "text-foreground hover:bg-muted",
              action.disabled && "pointer-events-none opacity-50"
            );

            if (action.id === "quick-view") {
              return (
                <button key={action.id} type="button" disabled={action.disabled || !id} className={itemClass} onClick={() => { setOpen(false); setQuickOpen(true); }}>
                  <ActionIcon id={action.id} /> {action.label}
                </button>
              );
            }
            if (!action.href) {
              return <button key={action.id} type="button" disabled={action.disabled} className={itemClass} onClick={() => setOpen(false)}><ActionIcon id={action.id} /> {action.label}</button>;
            }
            if (action.external) {
              return <a key={action.id} href={action.href} className={itemClass} onClick={() => setOpen(false)}><ActionIcon id={action.id} /> {action.label}</a>;
            }
            return <Link key={action.id} href={action.href} className={itemClass} onClick={() => setOpen(false)}><ActionIcon id={action.id} /> {action.label}</Link>;
          })}
        </div>
      </PortalMenu>

      <EntityQuickView open={quickOpen} onClose={() => setQuickOpen(false)} type={type} id={id} />
    </div>
  );
}
