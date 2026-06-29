"use client";

import { Phone } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function normalizePhoneForTel(phone?: string | null) {
  if (!phone) return "";
  return phone.trim().replace(/[^\d+]/g, "");
}

export function PhoneLink({
  phone,
  className,
  showIcon = true,
  fallback = "—",
}: {
  phone?: string | null;
  className?: string;
  showIcon?: boolean;
  fallback?: string;
}) {
  const tel = normalizePhoneForTel(phone);

  if (!phone || !tel) {
    return <span className={cn("text-slate-400", className)}>{fallback}</span>;
  }

  return (
    <a
      href={`tel:${tel}`}
      dir="ltr"
      className={cn("inline-flex items-center gap-1 text-brand-600 hover:text-brand-700 hover:underline", className)}
      onClick={(event) => event.stopPropagation()}
    >
      {showIcon && <Phone size={13} />}
      <span>{phone}</span>
    </a>
  );
}
