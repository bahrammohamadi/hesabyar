"use client";

import { User } from "lucide-react";
import { EntityActionMenu } from "./entity-action-menu";
import { EntityLink } from "./entity-link";
import { PhoneLink } from "./phone-link";

export function CustomerMiniCard({ id, name, phone }: { id?: string | null; name?: string | null; phone?: string | null }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
        <User size={17} />
      </div>
      <div className="min-w-0 flex-1">
        <EntityLink type="contact" id={id} className="block truncate text-sm" fallbackClassName="block truncate text-sm font-medium text-slate-700">
          {name || "مشتری"}
        </EntityLink>
        {phone && <PhoneLink phone={phone} className="mt-0.5 text-xs" />}
      </div>
      <EntityActionMenu type="contact" id={id} label={name} phone={phone} />
    </div>
  );
}
