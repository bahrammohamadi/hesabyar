"use client";

// EntityLink قدیمی و route-based: این کامپوننت برای لینک مستقیم به صفحات full-page مثل /contacts/[id] است.
// برای باز کردن پنل‌های Entity-based از نسخه جدید استفاده کنید:
// src/core/panel-manager/EntityLink.tsx

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import type { EntityType } from "@/lib/entities/types";
import { canNavigateToEntity, getEntityHref } from "@/lib/entities/routes";

export function EntityLink({
  type,
  id,
  children,
  label,
  className,
  fallbackClassName,
  allowUnimplementedRoute = false,
}: {
  type: EntityType;
  id?: string | null;
  children?: ReactNode;
  label?: ReactNode;
  className?: string;
  fallbackClassName?: string;
  allowUnimplementedRoute?: boolean;
}) {
  const content = children ?? label ?? "—";
  const href = getEntityHref(type, id);

  if (!href || !canNavigateToEntity(type, id, allowUnimplementedRoute)) {
    return <span className={cn("text-muted-foreground", fallbackClassName)}>{content}</span>;
  }

  return (
    <Link
      href={href}
      className={cn("inline-flex min-h-11 items-center font-medium text-primary transition hover:text-primary hover:underline sm:min-h-0", className)}
      onClick={(event) => event.stopPropagation()}
    >
      {content}
    </Link>
  );
}
