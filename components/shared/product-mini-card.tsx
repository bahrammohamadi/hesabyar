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
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
        <Package size={17} />
      </div>
      <div className="min-w-0 flex-1">
        <EntityLink type="product" id={id} className="block truncate text-sm" fallbackClassName="block truncate text-sm font-medium text-slate-700">
          {name || "کالا"}
        </EntityLink>
        {meta && <div className="mt-0.5 truncate text-xs text-slate-400">{meta}</div>}
      </div>
      <EntityActionMenu type="product" id={id} label={name} />
    </div>
  );
}
