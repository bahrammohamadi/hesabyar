"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Laptop, Loader2, LogOut, Monitor, Smartphone, Tablet } from "lucide-react";
import { toJalali } from "@/lib/utils/format";
import { maskIp } from "@/lib/security/login-history";
import { useConfirm } from "@/src/shared/ui";

/**
 * نشست‌های فعال کاربر.
 *
 * 🔴 چرا لازم بود: پس از تغییر رمز، نشست‌های قدیمی همچنان معتبر
 * می‌مانند. یعنی اگر کسی رمز شما را می‌دانست و شما عوضش کردید، او
 * هنوز وارد است — و تا پیش از این هیچ راهی برای بیرون‌انداختنش نبود.
 */

type Session = {
  id: string;
  createdAt: string;
  lastSeen: string;
  ip: string | null;
  device: string;
  kind: "mobile" | "tablet" | "desktop" | "unknown";
  isCurrent: boolean;
};

const KIND_ICON = {
  mobile: Smartphone,
  tablet: Tablet,
  desktop: Monitor,
  unknown: Laptop,
} as const;

export function ActiveSessions() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["account-sessions"],
    queryFn: async (): Promise<Session[]> => {
      const res = await fetch("/api/account/sessions");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا در دریافت نشست‌ها");
      return json.sessions as Session[];
    },
  });

  const revoke = useMutation({
    mutationFn: async (body: { session_id?: string; all_others?: boolean }) => {
      const res = await fetch("/api/account/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "بستن نشست ناموفق بود");
      return json as { revoked: number };
    },
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ["account-sessions"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const sessions = data ?? [];
  const others = sessions.filter((s) => !s.isCurrent);

  async function revokeAll() {
    const ok = await confirm({
      title: "خروج از سایر دستگاه‌ها",
      description:
        "همه‌ی نشست‌های دیگر بسته می‌شوند و آن دستگاه‌ها باید دوباره وارد شوند. نشست فعلی شما باز می‌ماند.",
      tone: "danger",
      confirmLabel: "خروج از همه",
      cancelLabel: "انصراف",
    });
    if (ok) revoke.mutate({ all_others: true });
  }

  if (isLoading) {
    return <div className="h-20 animate-pulse rounded-xl bg-muted" />;
  }

  return (
    <div className="space-y-3">
      {error && (
        <div role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-2xs text-destructive-text">
          {error}
        </div>
      )}

      <ul className="space-y-2">
        {sessions.map((s) => {
          const Icon = KIND_ICON[s.kind] ?? Laptop;
          return (
            <li
              key={s.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3"
            >
              <Icon size={17} className="shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-2xs font-bold text-foreground">{s.device}</span>
                  {s.isCurrent && (
                    <span className="rounded-md bg-success-soft px-1.5 py-0.5 text-[10px] font-bold text-success-onSoft">
                      این دستگاه
                    </span>
                  )}
                </div>
                {/*
                  🔴 دو باگ که با اسکرین‌شات پیدا شدند:

                  ۱) نشانی اینترنتی **خام** نمایش داده می‌شد
                     (31.171.101.138). در صفحه‌ای که ممکن است کسی از
                     پشت سر ببیند، نشانی کامل اطلاعات اضافه می‌دهد
                     بی‌آنکه به کاربر کمکی کند؛ برای تشخیص «این من
                     بودم؟» سه بخش اول کافی است. کارت «سابقه‌ی ورود»
                     از همان اول می‌پوشاند و این یکی جا مانده بود.

                  ۲) الگوی ` · ${توکن}` داخل یک رشته — همان
                     خانواده‌باگی که چند بار تکرار شده: در متن
                     راست‌به‌چپ بازچینش می‌شود و اعداد به هم
                     می‌چسبند. حالا span جدا در flex با جداکننده‌ی
                     aria-hidden.
                */}
                <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-muted-foreground">
                  <span className="tabular-nums">آخرین فعالیت: {toJalali(s.lastSeen, true)}</span>
                  {s.ip && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums" dir="ltr">{maskIp(s.ip)}</span>
                    </>
                  )}
                </div>
              </div>
              {!s.isCurrent && (
                <button
                  type="button"
                  onClick={() => revoke.mutate({ session_id: s.id })}
                  disabled={revoke.isPending}
                  aria-label={`بستن نشست ${s.device}`}
                  className="shrink-0 rounded-lg px-2 py-1 text-2xs font-bold text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                >
                  بستن
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {others.length > 0 && (
        <button
          type="button"
          onClick={revokeAll}
          disabled={revoke.isPending}
          /*
            text-destructive-text و نه text-destructive: دومی برای
            پس‌زمینه‌ی رنگی طراحی شده و روی دکمه‌ی روشن کنتراست کافی
            ندارد (axe serious / color-contrast).
          */
          className="btn-secondary text-destructive-text disabled:opacity-50"
        >
          {revoke.isPending ? (
            <Loader2 size={14} className="animate-spin" aria-hidden />
          ) : (
            <LogOut size={14} aria-hidden />
          )}
          خروج از سایر دستگاه‌ها
        </button>
      )}

      <p className="text-2xs leading-relaxed text-muted-foreground">
        اگر دستگاهی را نمی‌شناسید، آن را ببندید و بلافاصله رمز عبورتان را تغییر دهید.
      </p>
    </div>
  );
}
