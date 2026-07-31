"use client";

import { User } from "lucide-react";
import { EntityActionMenu } from "./entity-action-menu";
import { EntityLink } from "./entity-link";
import { PhoneLink } from "./phone-link";

export function CustomerMiniCard({ id, name, phone }: { id?: string | null; name?: string | null; phone?: string | null }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <User size={17} />
      </div>
      <div className="min-w-0 flex-1">
        <EntityLink type="contact" id={id} className="block truncate text-sm" fallbackClassName="block truncate text-sm font-medium text-foreground">
          {name || "مشتری"}
        </EntityLink>
        {phone && <PhoneLink phone={phone} className="mt-0.5 text-xs" />}
      </div>
      <EntityActionMenu type="contact" id={id} label={name} phone={phone} />
    </div>
  );
}
