"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertOctagon,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Info,
  Megaphone,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";
import { toFaDigits, toJalali } from "@/lib/utils/format";
import {
  RELEASES,
  CHANGE_KIND_LABEL,
  unseenReleases,
  type ChangeKind,
  type ReleaseNote,
} from "@/lib/changelog";

/**
 * زنگوله‌ی اعلان‌ها.
 *
 * 🔴 پیش از این کاملاً تزئینی بود: یک دکمه با آیکون Bell و بدون هیچ
 * onClick. کاربر می‌زد و هیچ اتفاقی نمی‌افتاد.
 *
 * حالا دو منبع را کنار هم نشان می‌دهد:
 *   • یادداشت انتشار — از lib/changelog، همراه خودِ نسخه می‌آید
 *   • اعلان سراسری — از دیتابیس، بدون نیاز به دیپلوی قابل انتشار است
 *
 * وضعیت «خوانده‌شده» در localStorage است نه دیتابیس: این یک ترجیح
 * نمایشی است و ذخیره‌اش در سرور یعنی یک درخواست اضافه در هر بارگذاری
 * برای چیزی که فقط روی همین مرورگر معنا دارد.
 */

const SEEN_VERSION_KEY = "tarazoo.seen-release.v1";
const SEEN_ANN_KEY = "tarazoo.seen-announcements.v1";

const KIND_STYLE: Record<ChangeKind, { icon: typeof Sparkles; className: string }> = {
  feature: { icon: Sparkles, className: "text-primary" },
  fix: { icon: Wrench, className: "text-info-onSoft" },
  security: { icon: CheckCircle2, className: "text-success-onSoft" },
  improvement: { icon: Info, className: "text-muted-foreground" },
};

const TONE_ICON = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertOctagon,
} as const;

type Announcement = {
  id: string;
  title: string;
  body: string | null;
  tone: keyof typeof TONE_ICON;
  created_at: string;
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  /*
    null یعنی «هنوز از localStorage نخوانده‌ایم».
    اگر مستقیم در useState اولیه بخوانیم، رندر سرور با کلاینت فرق
    می‌کند و React خطای hydration mismatch می‌دهد.
  */
  const [seenVersion, setSeenVersion] = useState<string | null | undefined>(undefined);
  const [seenAnnouncements, setSeenAnnouncements] = useState<string[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setSeenVersion(readJson<string | null>(SEEN_VERSION_KEY, null));
    setSeenAnnouncements(readJson<string[]>(SEEN_ANN_KEY, []));
  }, []);

  const { data: announcements } = useQuery({
    queryKey: ["bell-announcements"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Announcement[]> => {
      const supabase = createClient();
      // RLS خودش فیلتر می‌کند: فعال، در بازه، و مربوط به سازمان کاربر.
      const { data, error } = await supabase
        .from("platform_announcements")
        .select("id, title, body, tone, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) return [];
      return (data ?? []) as Announcement[];
    },
  });

  const unseenNotes = useMemo(
    () => (seenVersion === undefined ? [] : unseenReleases(seenVersion)),
    [seenVersion]
  );
  const unseenAnn = useMemo(
    () => (announcements ?? []).filter((a) => !seenAnnouncements.includes(a.id)),
    [announcements, seenAnnouncements]
  );
  const unreadCount = unseenNotes.length + unseenAnn.length;

  /** با باز شدن پنل، همه‌چیز خوانده‌شده علامت می‌خورد. */
  const markAllSeen = useCallback(() => {
    const latest = RELEASES[0]?.version ?? null;
    const annIds = (announcements ?? []).map((a) => a.id);
    setSeenVersion(latest);
    setSeenAnnouncements(annIds);
    try {
      window.localStorage.setItem(SEEN_VERSION_KEY, JSON.stringify(latest));
      // سقف ۵۰ تا حافظه بی‌نهایت رشد نکند.
      window.localStorage.setItem(SEEN_ANN_KEY, JSON.stringify(annIds.slice(-50)));
    } catch {
      /* حالت ناشناس یا سهمیه‌ی پر — ترجیح نمایشی حیاتی نیست */
    }
  }, [announcements]);

  function toggle() {
    const next = !open;
    setOpen(next);
    /*
      علامت‌گذاری هنگام *باز* شدن انجام می‌شود، نه بستن.

      اگر موقع بستن بود و کاربر پنل را باز می‌گذاشت و تب را می‌بست،
      همان اعلان‌ها دفعه‌ی بعد دوباره خوانده‌نشده می‌ماندند.
    */
    if (next && unreadCount > 0) markAllSeen();
  }

  // بستن با کلیک بیرون و Escape — همان الگوی DatePicker.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-label={
          unreadCount > 0 ? `اعلان‌ها، ${toFaDigits(unreadCount)} مورد خوانده‌نشده` : "اعلان‌ها"
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        /*
          🔴 نسخه‌ی قبلی `hidden … sm:flex` بود، یعنی در موبایل اصلاً
          دیده نمی‌شد. کاربران موبایل هرگز اعلان‌ها را نمی‌دیدند — و
          بخش بزرگی از کاربران یک نرم‌افزار فروشگاهی روی موبایل کار
          می‌کنند. حالا در همه‌ی اندازه‌ها هست.
        */
        className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground transition hover:text-primary"
      >
        <Bell size={18} aria-hidden />
        {unreadCount > 0 && (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-black text-white"
          >
            {toFaDigits(unreadCount > 9 ? "9+" : unreadCount)}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="اعلان‌ها"
          /*
            چیدمان RTL: پنل از لبه‌ی چپِ دکمه باز می‌شود. در موبایل
            عرض به ۹۲vw محدود است تا از صفحه بیرون نزند، و
            `max-w-[calc(100vw-1.5rem)]` تضمین می‌کند حتی روی
            باریک‌ترین صفحه هم فاصله از لبه بماند.
          */
          /*
            🔴 اندازه‌گیری واقعی در ۳۹۰px: پنل با left-0 نسبت به دکمه
            جای می‌گرفت و تا x=410 می‌رفت — ۲۰ پیکسل بیرون از صفحه.
            علتش این است که دکمه خودش نزدیک لبه‌ی چپ است و عرض پنل از
            فاصله‌ی باقی‌مانده بیشتر بود.

            راه‌حل: زیر sm پنل ثابت (fixed) و تمام‌عرض با حاشیه می‌شود؛
            از sm به بالا همان رفتار قبلی نسبت به دکمه.
          */
          className="fixed inset-x-3 top-[4.5rem] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:absolute sm:inset-x-auto sm:left-0 sm:top-12 sm:w-[22rem]"
          style={{ zIndex: "var(--z-picker)" }}
          dir="rtl"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2.5">
            <h2 className="text-xs font-extrabold text-foreground">اعلان‌ها</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="بستن"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-destructive"
            >
              <X size={14} aria-hidden />
            </button>
          </div>

          {/*
            🔴 tabIndex از axe آمد: این ناحیه اسکرول می‌شود ولی بدون
            فوکوس‌پذیری، کاربر صفحه‌کلید نمی‌توانست به اعلان‌های پایین
            برسد (serious / scrollable-region-focusable).
          */}
          <div className="max-h-[70vh] overflow-y-auto overscroll-contain" tabIndex={0} role="region" aria-label="فهرست اعلان‌ها">
            {(announcements ?? []).length === 0 && RELEASES.length === 0 ? (
              <p className="px-3 py-8 text-center text-2xs text-muted-foreground">اعلانی وجود ندارد.</p>
            ) : (
              <>
                {/* اعلان‌های سراسری اول می‌آیند: معمولاً فوری‌ترند */}
                {(announcements ?? []).map((a) => {
                  const Icon = TONE_ICON[a.tone] ?? Info;
                  return (
                    <article key={a.id} className="border-b border-border px-3 py-2.5 last:border-0">
                      <div className="flex items-start gap-2">
                        <Megaphone size={13} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <Icon size={12} className="shrink-0 text-muted-foreground" aria-hidden />
                            <h3 className="truncate text-2xs font-extrabold text-foreground">{a.title}</h3>
                          </div>
                          {a.body && (
                            <p className="mt-1 text-2xs leading-5 text-muted-foreground">{a.body}</p>
                          )}
                          <time className="mt-1 block text-[10px] text-muted-foreground">
                            {toJalali(a.created_at)}
                          </time>
                        </div>
                      </div>
                    </article>
                  );
                })}

                {RELEASES.map((release) => (
                  <ReleaseItem key={release.version} release={release} />
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ReleaseItem({ release }: { release: ReleaseNote }) {
  return (
    <article className="border-b border-border px-3 py-2.5 last:border-0">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="truncate text-2xs font-extrabold text-foreground">{release.title}</h3>
        <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground">
          {toFaDigits(release.version)}
        </span>
      </div>
      <time className="mt-0.5 block text-[10px] text-muted-foreground">{toJalali(release.date)}</time>

      <ul className="mt-1.5 space-y-1.5">
        {release.changes.map((change, index) => {
          const style = KIND_STYLE[change.kind];
          const Icon = style.icon;
          return (
            <li key={index} className="flex items-start gap-1.5">
              <Icon size={11} className={cn("mt-0.5 shrink-0", style.className)} aria-hidden />
              <span className="min-w-0 text-2xs leading-5 text-muted-foreground">
                <span className={cn("font-bold", style.className)}>{CHANGE_KIND_LABEL[change.kind]}: </span>
                {change.text}
              </span>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
