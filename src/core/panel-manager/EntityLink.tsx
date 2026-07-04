"use client";

// EntityLink جدید و panel-based: این کامپوننت route change نمی‌دهد و از PanelManager استفاده می‌کند.
// نسخه route-based قدیمی همچنان در components/shared/entity-link.tsx وجود دارد.

import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { usePanelManager } from "./panel-manager.store";
import type { DocumentType, EntityPanelType, OpenPanelOptions } from "./types";

type EntityLinkProps = {
  type: EntityPanelType | "invoice";
  id?: string;
  docType?: DocumentType;
  children: ReactNode;
  className?: string;
  options?: OpenPanelOptions;
};

export function EntityLink({ type, id, docType, children, className, options }: EntityLinkProps) {
  const { openEntity, openDocument } = usePanelManager();

  return (
    <button
      type="button"
      className={cn("inline-flex items-center text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-md", className)}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (type === "invoice") {
          openDocument(docType ?? "sale", id, { context: "entity-link", ...options });
        } else {
          openEntity(type, id, { context: "entity-link", ...options });
        }
      }}
    >
      {children}
    </button>
  );
}
