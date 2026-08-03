"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert, LogOut, Eye } from "lucide-react";
import { toFaDigits } from "@/lib/utils/format";

/**
 * نوار هشدار «شما به‌جای کاربر دیگری وارد شده‌اید».
 *
 * 🔴 چرا این نوار حیاتی است؟
 *   بدون نشانه‌ی دائمی و پررنگ، ادمین فراموش می‌کند در جلسه‌ی
 *   جعل هویت است و ممکن است تصور کند دارد داده‌ی خودش را می‌بیند —
 *   یا بدتر، عملی روی داده‌ی مشتری انجام دهد بدون آنکه بداند.
 *
 *   پس: رنگ هشدار پررهگذر، ثابت در بالای صفحه، شمارش معکوس، و
 *   دکمه‌ی خروج همیشه در دسترس.
 */

type Session = {
  session_id: string;
  target_email: string;
  org_name: string | null;
  read_only: boolean;
  reason: string;
  expires_at: string;
};

export function ImpersonationBanner() {
  const qc = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  const [ending, setEnding] = useState(false);

  const { data: session } = useQuery({
    queryKey: ["impersonation-session"],
    // هر دقیقه بررسی می‌شود تا انقضا در سمت سرور هم دیده شود.
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: false,
    queryFn: async (): Promise<Session | null> => {
      const res = await fetch("/api/admin/impersonate");
      if (!res.ok) return null;      // غیرادمین → بی‌صدا هیچ
      const json = await res.json();
      return json.session ?? null;
    },
  });

  // شمارش معکوس زنده
  useEffect(() => {
    if (!session) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [session]);

  if (!session) return null;

  const msLeft = new Date(session.expires_at).getTime() - now;
  const expired = msLeft <= 0;
  const mins = Math.max(0, Math.floor(msLeft / 60000));
  const secs = Math.max(0, Math.floor((msLeft % 60000) / 1000));

  async function end() {
    setEnding(true);
    try {
      await fetch("/api/admin/impersonate", { method: "DELETE" });
      qc.invalidateQueries({ queryKey: ["impersonation-session"] });
      window.location.reload();
    } finally {
      setEnding(false);
    }
  }

  return (
    <div
      role="alert"
      className="sticky top-0 border-b-2 border-destructive/40 bg-destructive px-3 py-2 text-destructive-foreground sm:px-5"
      style={{ zIndex: "var(--z-toast)" }}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <ShieldAlert size={17} className="shrink-0" aria-hidden />
          <div className="min-w-0 text-xs sm:text-sm">
            <span className="font-extrabold">
              شما به‌جای «{session.target_email}» وارد شده‌اید
            </span>
            {session.org_name && (
              <span className="hidden opacity-90 sm:inline"> — {session.org_name}</span>
            )}
            {session.read_only && (
              <span className="mr-1.5 inline-flex items-center gap-1 rounded-full bg-destructive-foreground/20 px-2 py-0.5 text-2xs font-bold">
                <Eye size={11} aria-hidden />
                فقط مشاهده
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-lg bg-destructive-foreground/15 px-2 py-1 text-2xs font-extrabold tabular-nums sm:text-xs">
            {expired
              ? "منقضی شد"
              : `${toFaDigits(mins)}:${toFaDigits(String(secs).padStart(2, "0"))}`}
          </span>
          <button
            type="button"
            onClick={end}
            disabled={ending}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-destructive-foreground px-3 text-2xs font-extrabold text-destructive transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive-foreground/50 disabled:opacity-60 sm:text-xs"
          >
            <LogOut size={13} aria-hidden />
            خروج از این حالت
          </button>
        </div>
      </div>
    </div>
  );
}
