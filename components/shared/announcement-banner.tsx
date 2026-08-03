"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Info, CheckCircle2, AlertTriangle, AlertOctagon, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";

/**
 * نوار اعلان پلتفرم.
 *
 * RLS خودش فیلتر می‌کند: فقط اعلان‌های فعال، در بازه‌ی زمانی، و
 * مربوط به سازمان کاربر (یا سراسری) برمی‌گردند. پس اینجا شرط تکراری
 * نمی‌نویسیم — تک‌منبع حقیقت دیتابیس است.
 *
 * بستن در localStorage نگه داشته می‌شود تا اعلان بسته‌شده با هر
 * ناوبری دوباره برنگردد.
 */

const TONE = {
  info:    { bg: "bg-info-soft",        text: "text-info-onSoft",        border: "border-info/25",        Icon: Info },
  success: { bg: "bg-success-soft",     text: "text-success-onSoft",     border: "border-success/25",     Icon: CheckCircle2 },
  warning: { bg: "bg-warning-soft",     text: "text-warning-onSoft",     border: "border-warning/30",     Icon: AlertTriangle },
  danger:  { bg: "bg-destructive/10",   text: "text-destructive-text",   border: "border-destructive/30", Icon: AlertOctagon },
} as const;

type Announcement = {
  id: string;
  title: string;
  body: string | null;
  tone: keyof typeof TONE;
};

const STORAGE_KEY = "tarazoo-dismissed-announcements";

function readDismissed(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function AnnouncementBanner() {
  const [dismissed, setDismissed] = useState<string[]>([]);

  // بعد از mount خوانده می‌شود تا رندر سرور و کلاینت یکی بماند.
  useEffect(() => setDismissed(readDismissed()), []);

  const { data } = useQuery({
    queryKey: ["platform-announcements"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Announcement[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("platform_announcements")
        .select("id, title, body, tone")
        .order("created_at", { ascending: false })
        .limit(3);
      // جدول ممکن است هنوز روی دیتابیس نباشد؛ اپ نباید بشکند.
      if (error) return [];
      return (data ?? []) as Announcement[];
    },
  });

  const visible = (data ?? []).filter((a) => !dismissed.includes(a.id));
  if (visible.length === 0) return null;

  function dismiss(id: string) {
    const next = [...dismissed, id];
    setDismissed(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next.slice(-50)));
    } catch {
      /* بی‌اهمیت */
    }
  }

  return (
    <>
      {visible.map((a) => {
        const t = TONE[a.tone] ?? TONE.info;
        const Icon = t.Icon;
        return (
          <div
            key={a.id}
            role="status"
            className={cn("border-b px-3 py-2 sm:px-5", t.bg, t.border)}
          >
            <div className="mx-auto flex w-full max-w-7xl items-start gap-2.5">
              <Icon size={16} className={cn("mt-0.5 shrink-0", t.text)} aria-hidden />
              <div className={cn("min-w-0 flex-1", t.text)}>
                <p className="text-xs font-extrabold sm:text-sm">{a.title}</p>
                {a.body && <p className="mt-0.5 text-2xs leading-5 sm:text-xs">{a.body}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismiss(a.id)}
                aria-label="بستن اعلان"
                className={cn(
                  "-m-1 shrink-0 rounded-lg p-1 transition hover:bg-foreground/10",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  t.text
                )}
              >
                <X size={16} />
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}
