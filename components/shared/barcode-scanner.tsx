"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isIOS, isInAppBrowser } from "@/lib/utils/platform";
import { createPortal } from "react-dom";
import { Camera, X, AlertTriangle, Keyboard, Check } from "lucide-react";
import { Button } from "@/src/shared/ui/Button";
import { checkBarcode, SUPPORTED_FORMATS } from "@/lib/barcode";
import { toFaDigits } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/**
 * اسکنر بارکد با دوربین.
 *
 * چرا دو موتور؟
 *   • BarcodeDetector بومی مرورگر: صفر بایت باندل، سریع‌ترین، ولی فقط
 *     روی Chromium (کروم/اج/کروم اندروید). فایرفاکس ندارد و سافاری
 *     پشت پرچم است.
 *   • ZXing به‌عنوان جایگزین: حدود ۲۰۰ کیلوبایت، ولی همه‌جا کار می‌کند.
 *     با import پویا فقط وقتی بارگذاری می‌شود که بومی در دسترس نباشد،
 *     پس کاربر کروم هزینه‌اش را نمی‌پردازد.
 *
 * ⚠️ دوربین فقط روی HTTPS یا localhost کار می‌کند. روی HTTP معمولی،
 *    getUserMedia بی‌صدا رد می‌شود؛ برای همین خطا را صریح نشان می‌دهیم.
 */

type Props = {
  open: boolean;
  onClose: () => void;
  /** با هر خواندن موفق صدا زده می‌شود. */
  onDetected: (code: string) => void;
  /** پس از اسکن باز بماند تا چند کالا پشت‌سرهم اسکن شود. */
  continuous?: boolean;
};

type Status = "idle" | "starting" | "scanning" | "denied" | "unsupported" | "error";

export function BarcodeScanner({ open, onClose, onDetected, continuous = true }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errorText, setErrorText] = useState("");
  const [lastHit, setLastHit] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [manual, setManual] = useState("");
  const [showManual, setShowManual] = useState(false);

  useEffect(() => setMounted(true), []);

  /*
    یک بارکد در هر فریم چند بار خوانده می‌شود. بدون این محافظ، یک بار
    گرفتن کالا جلوی دوربین ده‌ها بار به فاکتور اضافه می‌شد.
  */
  const emit = useCallback(
    (raw: string) => {
      const { value, isEmpty } = checkBarcode(raw);
      if (isEmpty) return;
      const now = Date.now();
      if (lastRef.current.code === value && now - lastRef.current.at < 2000) return;
      lastRef.current = { code: value, at: now };

      setLastHit(value);
      setCount((c) => c + 1);
      // بازخورد لرزشی کوتاه؛ روی دسکتاپ بی‌اثر است.
      try { navigator.vibrate?.(60); } catch { /* پشتیبانی نمی‌شود */ }

      onDetected(value);
      if (!continuous) onClose();
    },
    [onDetected, continuous, onClose]
  );

  /** آزادسازی کامل دوربین. نشتی اینجا یعنی چراغ دوربین روشن می‌ماند. */
  const teardown = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    if (!open) { teardown(); setStatus("idle"); setLastHit(null); setCount(0); return; }

    let cancelled = false;
    (async () => {
      setStatus("starting");
      setErrorText("");

      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("unsupported");
        setErrorText("مرورگر شما به دوربین دسترسی نمی‌دهد. اگر با HTTP باز کرده‌اید، از HTTPS استفاده کنید.");
        return;
      }

      let stream: MediaStream;
      try {
        // دوربین پشتی برای اسکن مناسب‌تر است.
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
          audio: false,
        });
      } catch (err) {
        if (cancelled) return;
        const name = (err as Error)?.name ?? "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          setStatus("denied");
          /*
            🔴 راهنما باید متناسب با همان دستگاه باشد.

            «روی قفل کنار نشانی سایت بزنید» در سافاری آیفون بی‌معناست:
            آنجا آیکون قفلی وجود ندارد و مسیر واقعی از دکمه‌ی «aA»
            می‌گذرد. کاربر دنبال چیزی می‌گشت که اصلاً نبود.

            و اگر صفحه داخل مرورگر اینستاگرام/تلگرام باز شده باشد،
            هیچ تنظیمی کمک نمی‌کند — باید در سافاری باز شود.
          */
          setErrorText(
            isInAppBrowser()
              ? "این صفحه داخل مرورگر یک اپ دیگر باز شده و دوربین آنجا کار نمی‌کند. از منوی «…» گزینه‌ی «Open in Safari» را بزنید — یا همین‌جا کد را دستی وارد کنید."
              : isIOS()
                ? "اجازه‌ی دسترسی به دوربین داده نشد. روی دکمه‌ی «aA» در نوار نشانی بزنید ← Website Settings ← Camera ← Allow. اگر نبود: تنظیمات ← Safari ← Camera ← Allow — یا همین‌جا کد را دستی وارد کنید."
                : "اجازه‌ی دسترسی به دوربین داده نشد. روی قفل کنار نشانی سایت بزنید، دوربین را روی «اجازه» بگذارید و صفحه را تازه کنید — یا همین‌جا کد را دستی وارد کنید."
          );
        } else if (name === "NotFoundError") {
          setStatus("error");
          setErrorText("دوربینی روی این دستگاه پیدا نشد.");
        } else {
          setStatus("error");
          setErrorText("دوربین باز نشد. لطفاً کد را دستی وارد کنید.");
        }
        setShowManual(true);
        return;
      }

      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      try { await video.play(); } catch { /* برخی مرورگرها play را رد می‌کنند */ }
      if (cancelled) return;
      setStatus("scanning");

      const NativeDetector = (window as unknown as { BarcodeDetector?: new (o?: unknown) => { detect(s: CanvasImageSource): Promise<{ rawValue: string }[]> } }).BarcodeDetector;

      if (NativeDetector) {
        // مسیر بومی — بدون بارگذاری هیچ کتابخانه‌ای.
        let detector: { detect(s: CanvasImageSource): Promise<{ rawValue: string }[]> };
        try {
          detector = new NativeDetector({ formats: SUPPORTED_FORMATS });
        } catch {
          detector = new NativeDetector();
        }
        let raf = 0;
        let busy = false;
        const tick = async () => {
          if (cancelled) return;
          if (!busy && video.readyState >= 2) {
            busy = true;
            try {
              const found = await detector.detect(video);
              if (found?.length) emit(found[0].rawValue);
            } catch { /* فریم خراب — فریم بعدی */ }
            busy = false;
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        stopRef.current = () => cancelAnimationFrame(raf);
      } else {
        // جایگزین: ZXing فقط در همین حالت دانلود می‌شود.
        try {
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          if (cancelled) return;
          const reader = new BrowserMultiFormatReader();
          const controls = await reader.decodeFromVideoElement(video, (result) => {
            if (result) emit(result.getText());
          });
          stopRef.current = () => controls.stop();
        } catch {
          if (cancelled) return;
          setStatus("error");
          setErrorText("موتور تشخیص بارکد بارگذاری نشد. کد را دستی وارد کنید.");
          setShowManual(true);
        }
      }
    })();

    return () => { cancelled = true; teardown(); };
  }, [open, emit, teardown]);

  // بستن با Escape — capture تا پنل زیرین بسته نشود.
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

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const { value, isEmpty } = checkBarcode(manual);
    if (isEmpty) return;
    onDetected(value);
    setManual("");
    if (!continuous) onClose();
  }

  if (!open || !mounted) return null;

  return createPortal(
    /*
      --z-picker یعنی این لایه روی پنل‌های باز می‌نشیند و PanelHost آن
      را inert نمی‌کند (فهرست سفید shouldSkip).
    */
    <div
      className="fixed inset-0 flex items-center justify-center bg-foreground/70 p-0 backdrop-blur-sm sm:p-4"
      style={{ zIndex: "var(--z-picker)" }}
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-label="اسکن بارکد با دوربین"
    >
      <div className="flex h-full w-full flex-col overflow-hidden bg-card sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Camera size={18} className="text-primary" aria-hidden />
            <h2 className="text-sm font-extrabold text-foreground">اسکن بارکد</h2>
            {count > 0 && (
              <span className="rounded-full bg-success-soft px-2 py-0.5 text-2xs font-bold text-success-onSoft">
                {toFaDigits(count)} کالا
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن اسکنر"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* تصویر دوربین */}
          <div className="relative aspect-[4/3] w-full bg-foreground/90">
            <video
              ref={videoRef}
              playsInline
              muted
              className={cn("h-full w-full object-cover", status !== "scanning" && "opacity-0")}
            />

            {/* کادر هدف */}
            {status === "scanning" && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="relative h-32 w-4/5 max-w-xs rounded-xl border-2 border-primary-foreground/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
                  <span className="absolute inset-x-0 top-1/2 h-0.5 animate-pulse bg-destructive/80 motion-reduce:animate-none" />
                </div>
              </div>
            )}

            {(status === "starting" || status === "idle") && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-primary-foreground">
                <Camera size={30} className="animate-pulse motion-reduce:animate-none" aria-hidden />
                <p className="text-xs">در حال باز کردن دوربین…</p>
              </div>
            )}

            {(status === "denied" || status === "error" || status === "unsupported") && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-primary-foreground">
                <AlertTriangle size={28} aria-hidden />
                <p className="text-xs leading-6">{errorText}</p>
              </div>
            )}

            {lastHit && (
              <div
                role="status"
                className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-success/90 py-2 text-xs font-bold text-success-foreground"
              >
                <Check size={14} aria-hidden />
                <span dir="ltr" className="tabular-nums">{lastHit}</span>
              </div>
            )}
          </div>

          <div className="space-y-3 p-4">
            {status === "scanning" && (
              <p className="text-center text-xs text-muted-foreground">
                بارکد را داخل کادر بگیرید. پس از خواندن، کالا خودکار به فاکتور اضافه می‌شود.
              </p>
            )}

            <Button
              type="button"
              variant="secondary"
              className="w-full"
              icon={<Keyboard size={15} />}
              onClick={() => setShowManual((v) => !v)}
            >
              {showManual ? "بستن ورود دستی" : "ورود دستی کد"}
            </Button>

            {showManual && (
              <form onSubmit={submitManual} className="flex gap-2">
                <input
                  autoFocus
                  dir="ltr"
                  inputMode="numeric"
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  placeholder="6260000000001"
                  aria-label="کد بارکد"
                  className="min-h-11 flex-1 rounded-xl border border-border bg-card px-3 text-left text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <Button type="submit" disabled={!manual.trim()}>افزودن</Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
