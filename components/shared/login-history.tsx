"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Laptop, Monitor, ShieldAlert, Smartphone, Tablet } from "lucide-react";
import { Badge } from "@/src/shared/ui";
import { toFaDigits, toJalali } from "@/lib/utils/format";
import { eventMeta, isNoteworthy, maskIp, summarize, type LoginEvent } from "@/lib/security/login-history";

/**
 * سابقه‌ی ورود به حساب.
 *
 * 🔴 چرا لازم بود: رویدادهای ورود از نسخه‌ی قبل ثبت می‌شدند ولی هیچ
 * جایی برای دیدنشان نبود. بدون این صفحه، کاربر هرگز نمی‌فهمد کسی
 * شب گذشته با رمزش تلاش کرده وارد شود.
 */

const KIND_ICON = {
  mobile: Smartphone,
  tablet: Tablet,
  desktop: Monitor,
  unknown: Laptop,
} as const;

type Row = LoginEvent & { device: string; kind: keyof typeof KIND_ICON };

export function LoginHistory() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["account-login-history"],
    queryFn: async () => {
      const res = await fetch("/api/account/login-history");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "دریافت سابقه ناموفق بود.");
      return (json.events ?? []) as Row[];
    },
    staleTime: 30_000,
  });

  const stats = useMemo(() => summarize(data ?? []), [data]);

  if (isLoading) {
    return <div className="h-24 animate-pulse rounded-xl bg-muted" />;
  }

  if (error) {
    return (
      <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive-text">
        {(error as Error).message}
      </div>
    );
  }

  if (!data?.length) {
    return (
      <p className="py-3 text-xs text-muted-foreground">
        هنوز رویدادی ثبت نشده است. از این پس هر ورود موفق و ناموفق اینجا دیده می‌شود.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/*
        هشدار فقط وقتی تلاش ناموفق **اخیر** وجود دارد.

        ⚠️ عمداً «ورود موفق از دستگاه جدید» هشدار نمی‌دهد: کاربر روی
        گوشی و لپ‌تاپ وارد می‌شود و اگر هر بار علامت قرمز ببیند، زود
        یاد می‌گیرد نادیده‌اش بگیرد — آن‌وقت هشدار واقعی هم گم می‌شود.
      */}
      {stats.recentFailures > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/[0.08] p-3">
          <ShieldAlert size={16} className="mt-0.5 shrink-0 text-warning-onSoft" aria-hidden />
          <div className="text-xs leading-6 text-warning-onSoft">
            <span className="font-bold">
              {toFaDigits(stats.recentFailures)} تلاش ناموفق در ۲۴ ساعت گذشته
            </span>
            <span className="block text-muted-foreground">
              اگر کار خودتان نبوده، رمز عبورتان را عوض کنید و دستگاه‌های ناشناس را ببندید.
            </span>
          </div>
        </div>
      )}

      <ul className="space-y-1.5">
        {data.map((e, i) => {
          const meta = eventMeta(e.event);
          const Icon = KIND_ICON[e.kind] ?? Laptop;
          return (
            <li
              key={`${e.created_at}-${i}`}
              className={`flex items-center justify-between gap-3 rounded-xl border p-2.5 ${
                isNoteworthy(e.event) ? "border-destructive/20 bg-destructive/[0.04]" : "border-border"
              }`}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <Icon size={16} className="shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0">
                  <div className="truncate text-xs font-bold text-foreground">{e.device}</div>
                  {/*
                    🔴 توکن‌های عددی هرکدام span جدا در flex با جداکننده‌ی
                    aria-hidden. رشته‌ی `${تاریخ} · ${آی‌پی}` در متن
                    راست‌به‌چپ بازچینش می‌شود و اعداد به هم می‌چسبند —
                    در DOM درست است و فقط رندر خراب می‌شود، پس تست
                    رشته‌ای نمی‌گیردش.
                  */}
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-2xs text-muted-foreground">
                    <span className="tabular-nums">{toJalali(e.created_at, true)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums" dir="ltr">{maskIp(e.ip)}</span>
                  </div>
                </div>
              </div>
              <Badge tone={meta.tone}>{meta.label}</Badge>
            </li>
          );
        })}
      </ul>

      <p className="text-2xs leading-relaxed text-muted-foreground">
        {/*
          دو عدد کنار هم، باز هم span جدا.
        */}
        <span className="tabular-nums">{toFaDigits(data.length)} رویداد اخیر</span>
        {stats.distinctIps > 0 && (
          <>
            <span aria-hidden="true"> · </span>
            <span className="tabular-nums">
              ورود موفق از {toFaDigits(stats.distinctIps)} نشانی متفاوت
            </span>
          </>
        )}
        <span aria-hidden="true"> · </span>
        <span>سابقه تا ۹۰ روز نگه داشته می‌شود</span>
      </p>
    </div>
  );
}
