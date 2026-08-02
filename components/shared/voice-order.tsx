"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Mic, MicOff, X, AlertTriangle, Check, Loader2 } from "lucide-react";
import { Button } from "@/src/shared/ui/Button";
import { parseUtterance, rankMatches, type Scored } from "@/lib/voice-order";
import { toFaDigits, formatToman } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { SelectableVariant } from "@/components/shared/product-selector";

/**
 * افزودن کالا به فاکتور با صدا.
 *
 * ⚠️ تصمیم طراحی مهم: هرگز خودکار اضافه نمی‌کند.
 *
 *   تشخیص گفتار فارسی روی سرور گوگل انجام می‌شود و با لهجه و نویز
 *   محیط فروشگاه افت می‌کند. سنجش روی کاتالوگ واقعی ۳۷۵ کالایی:
 *   ۹۴٪ گزینه‌ی درست رتبه‌ی اول، ۱۰۰٪ در سه گزینه‌ی اول.
 *
 *   یعنی از هر ۱۶ بار، یک بار گزینه‌ی اول اشتباه است. افزودن خودکار
 *   یعنی فاکتور غلط برای مشتری. پس همیشه فهرست پیشنهاد نشان داده
 *   می‌شود و کاربر انتخاب می‌کند.
 */

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
};

/** سازنده‌ی SpeechRecognition، با پیشوند وبکیت برای سافاری. */
function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as
    | (new () => SpeechRecognitionLike)
    | null;
}

/** آیا مرورگر جاری از تشخیص گفتار پشتیبانی می‌کند؟ */
export const isVoiceSupported = (): boolean => getRecognitionCtor() !== null;

type Props = {
  open: boolean;
  onClose: () => void;
  /** کاتالوگ برای تطبیق. */
  variants: SelectableVariant[];
  /** کاربر گزینه‌ای را تأیید کرد. */
  onConfirm: (variant: SelectableVariant, qty: number) => void;
};

type Phase = "idle" | "listening" | "matched" | "nomatch" | "denied" | "error";

export function VoiceOrder({ open, onClose, variants, onConfirm }: Props) {
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [interim, setInterim] = useState("");
  const [finalText, setFinalText] = useState("");
  const [qty, setQty] = useState(1);
  const [matches, setMatches] = useState<Scored<SelectableVariant>[]>([]);
  const [errorText, setErrorText] = useState("");
  const [added, setAdded] = useState<string[]>([]);

  useEffect(() => setMounted(true), []);

  const handleTranscript = useCallback(
    (text: string) => {
      const parsed = parseUtterance(text);
      setFinalText(parsed.raw);
      setQty(parsed.qty);

      if (!parsed.term) {
        setMatches([]);
        setPhase("nomatch");
        return;
      }
      const ranked = rankMatches(
        parsed.term,
        variants,
        (v) => [v.product_name, v.color, v.size].filter(Boolean).join(" "),
        6
      );
      setMatches(ranked);
      setPhase(ranked.length ? "matched" : "nomatch");
    },
    [variants]
  );

  const stop = useCallback(() => {
    try { recRef.current?.abort(); } catch { /* از قبل متوقف شده */ }
    recRef.current = null;
  }, []);

  const start = useCallback(async () => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setPhase("error");
      setErrorText("مرورگر شما تشخیص گفتار ندارد. کروم یا سافاری را امتحان کنید.");
      return;
    }

    /*
      🔴 مجوز میکروفون صریح گرفته می‌شود، پیش از استارت تشخیص.

      چرا لازم شد: SpeechRecognition خودش پنجره‌ی مجوز را نشان
      می‌دهد، ولی اگر کاربر یک‌بار «Block» زده باشد، دفعات بعد بی‌صدا
      خطای not-allowed می‌دهد و هیچ راهی برای بازیابی نشان داده
      نمی‌شود. کاربر فقط یک پیام مبهم می‌دید.

      با getUserMedia:
        • بار اول پنجره‌ی مجوز مرورگر واقعاً باز می‌شود
        • در حالت مسدود، از permissions.query وضعیت را می‌فهمیم و
          راهنمای دقیق نشان می‌دهیم
      استریم بلافاصله بسته می‌شود؛ فقط برای گرفتن مجوز است.
    */
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        s.getTracks().forEach((t) => t.stop());
      } catch (err) {
        const name = (err as Error)?.name ?? "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          setPhase("denied");
          setErrorText("");
          return;
        }
        if (name === "NotFoundError") {
          setPhase("error");
          setErrorText("میکروفونی روی این دستگاه پیدا نشد.");
          return;
        }
      }
    }

    stop();
    setInterim("");
    setFinalText("");
    setMatches([]);

    const rec = new Ctor();
    rec.lang = "fa-IR";
    /*
      continuous=false یعنی پس از یک جمله خودش متوقف می‌شود.
      برای «یک کالا در هر بار» دقیق‌تر است و باتری/داده کمتری می‌برد.
    */
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 3;

    rec.onstart = () => setPhase("listening");

    rec.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const t = r[0]?.transcript ?? "";
        if (r.isFinal) { handleTranscript(t); return; }
        live += t;
      }
      setInterim(live);
    };

    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setPhase("denied");
        setErrorText("");
      } else if (e.error === "no-speech") {
        setPhase("nomatch");
        setFinalText("");
        setErrorText("صدایی شنیده نشد.");
      } else if (e.error === "network") {
        setPhase("error");
        setErrorText("تشخیص گفتار به اینترنت نیاز دارد و اتصال برقرار نشد.");
      } else if (e.error !== "aborted") {
        setPhase("error");
        setErrorText("خطا در تشخیص گفتار. دوباره تلاش کنید.");
      }
    };

    rec.onend = () => {
      setPhase((p) => (p === "listening" ? "nomatch" : p));
    };

    recRef.current = rec;
    try { rec.start(); } catch {
      setPhase("error");
      setErrorText("میکروفون در دسترس نیست.");
    }
  }, [handleTranscript, stop]);

  /*
    با باز شدن، اول وضعیت مجوز پرسیده می‌شود.

    اگر از قبل مسدود است، وقت کاربر با یک تلاش محکوم‌به‌شکست تلف
    نمی‌شود و مستقیم راهنمای بازیابی می‌آید.
    permissions.query در همه‌ی مرورگرها نیست؛ در نبودش مثل قبل
    مستقیم تلاش می‌کنیم.
  */
  useEffect(() => {
    if (!open) { stop(); setPhase("idle"); setAdded([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const st = await navigator.permissions?.query({
          name: "microphone" as PermissionName,
        });
        if (cancelled) return;
        if (st?.state === "denied") {
          setPhase("denied");
          setErrorText("");
          return;
        }
      } catch {
        /* پشتیبانی نمی‌شود — مسیر عادی */
      }
      if (!cancelled) void start();
    })();
    return () => { cancelled = true; stop(); };
  }, [open, start, stop]);

  // Escape فقط این لایه را می‌بندد، نه پنل زیرین.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  function confirm(v: SelectableVariant) {
    onConfirm(v, qty);
    setAdded((a) => [...a, `${toFaDigits(qty)} × ${v.product_name}`]);
    setMatches([]);
    setFinalText("");
    setPhase("idle");
  }

  if (!open || !mounted) return null;

  const listening = phase === "listening";

  return createPortal(
    <div
      className="fixed inset-0 flex items-end justify-center bg-foreground/70 backdrop-blur-sm sm:items-center sm:p-4"
      style={{ zIndex: "var(--z-picker)" }}
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-label="افزودن کالا با صدا"
    >
      <div className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-card sm:max-w-md sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Mic size={18} className="text-primary" aria-hidden />
            <h2 className="text-sm font-extrabold text-foreground">افزودن با صدا</h2>
            {added.length > 0 && (
              <span className="rounded-full bg-success-soft px-2 py-0.5 text-2xs font-bold text-success-onSoft">
                {toFaDigits(added.length)} کالا
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {/* نشانگر میکروفون */}
          <div className="flex flex-col items-center gap-3 py-2">
            <button
              type="button"
              onClick={listening ? stop : () => void start()}
              aria-label={listening ? "توقف ضبط" : "شروع ضبط"}
              className={cn(
                "relative flex h-20 w-20 items-center justify-center rounded-full transition",
                "focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30",
                listening
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              {listening && (
                <span
                  aria-hidden
                  className="absolute inset-0 animate-ping rounded-full bg-destructive/40 motion-reduce:animate-none"
                />
              )}
              {listening ? <MicOff size={30} /> : <Mic size={30} />}
            </button>

            <p role="status" aria-live="polite" className="min-h-6 text-center text-sm font-bold text-foreground">
              {listening && !interim && "بگویید… مثلاً «سه عدد شومیز شانتون»"}
              {listening && interim && <span className="text-muted-foreground">{interim}</span>}
              {!listening && finalText && `شنیدم: «${finalText}»`}
              {!listening && !finalText && phase === "idle" && "برای گفتن دوباره، میکروفون را بزنید"}
            </p>
          </div>

          {/*
            راهنمای بازیابی مجوز.

            پیام «از تنظیمات مرورگر فعالش کنید» عملاً بی‌فایده بود —
            کاربر نمی‌داند کجای تنظیمات. حالا مسیر دقیق کروم و سافاری
            نوشته شده و دکمه‌ی «تلاش دوباره» هم هست، چون پس از تغییر
            مجوز باید دوباره امتحان شود.
          */}
          {phase === "denied" && (
            <div role="alert" className="mt-3 rounded-xl bg-destructive/10 p-3.5 text-xs leading-6 text-destructive-text">
              <p className="flex items-start gap-2 font-bold">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />
                دسترسی به میکروفون مسدود است
              </p>
              <ol className="mt-2 list-inside list-decimal space-y-1 pr-1 text-foreground">
                <li>روی آیکون قفل 🔒 کنار نشانی سایت در نوار مرورگر بزنید</li>
                <li>گزینه‌ی «میکروفون» (Microphone) را پیدا کنید</li>
                <li>آن را روی «اجازه دادن» (Allow) بگذارید</li>
                <li>صفحه را یک‌بار تازه‌سازی کنید</li>
              </ol>
              <p className="mt-2 text-muted-foreground">
                در سافاری: منوی Safari ← Settings for This Website ← Microphone ← Allow
              </p>
              <Button
                variant="secondary"
                className="mt-3 w-full"
                onClick={() => { setErrorText(""); void start(); }}
              >
                تلاش دوباره
              </Button>
            </div>
          )}

          {phase === "error" && (
            <div role="alert" className="mt-2 flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-xs leading-6 text-destructive-text">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />
              <span>{errorText}</span>
            </div>
          )}

          {phase === "nomatch" && (
            <div role="status" className="mt-2 rounded-xl bg-warning-soft p-3 text-xs leading-6 text-warning-onSoft">
              {finalText
                ? <>کالایی مطابق «{finalText}» پیدا نشد. دوباره بگویید یا از جستجوی دستی استفاده کنید.</>
                : (errorText || "چیزی شنیده نشد. دوباره تلاش کنید.")}
            </div>
          )}

          {/* گزینه‌ها — تأیید همیشه لازم است */}
          {matches.length > 0 && (
            <div className="mt-3">
              <p className="mb-2 text-xs font-bold text-muted-foreground">
                کدام کالا؟ (تعداد: {toFaDigits(qty)})
              </p>
              <ul className="space-y-2">
                {matches.map(({ item, score }) => (
                  <li key={item.variant_id}>
                    <button
                      type="button"
                      onClick={() => confirm(item)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 text-right transition hover:border-primary/40 hover:bg-primary/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-foreground">
                          {item.product_name}
                        </span>
                        <span className="block truncate text-2xs text-muted-foreground">
                          {[item.color, item.size].filter(Boolean).join(" / ") || "بدون تنوع"}
                          {" · "}
                          {formatToman(item.sale_price)}
                          {" · موجودی "}
                          {toFaDigits(item.stock_qty)}
                        </span>
                      </span>
                      <span
                        className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-2xs font-bold text-muted-foreground tabular-nums"
                        title="میزان تطابق"
                      >
                        {toFaDigits(Math.round(score * 100))}٪
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {added.length > 0 && (
            <div className="mt-4 border-t border-border pt-3">
              <p className="mb-1.5 text-2xs font-bold text-muted-foreground">افزوده‌شده در این جلسه</p>
              <ul className="space-y-1">
                {added.map((a, i) => (
                  <li key={i} className="flex items-center gap-1.5 text-2xs text-success-onSoft">
                    <Check size={12} aria-hidden />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="border-t border-border p-3">
          <Button variant="secondary" className="w-full" onClick={onClose}>
            پایان
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
