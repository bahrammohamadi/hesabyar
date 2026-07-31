"use client";

import { Package } from "lucide-react";
import { EntityActionMenu } from "./entity-action-menu";
import { EntityLink } from "./entity-link";

export function ProductMiniCard({
  id,
  name,
  meta,
}: {
  id?: string | null;
  name?: string | null;
  meta?: string | null;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Package size={17} />
      </div>
      <div className="min-w-0 flex-1">
        <EntityLink type="product" id={id} className="block truncate text-sm" fallbackClassName="block truncate text-sm font-medium text-foreground">
          {name || "کالا"}
        </EntityLink>
        {meta && <div className="mt-0.5 truncate text-xs text-muted-foreground">{meta}</div>}
      </div>
      <EntityActionMenu type="product" id={id} label={name} />
    </div>
  );
}
