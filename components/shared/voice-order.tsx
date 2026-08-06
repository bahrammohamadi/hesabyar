"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isIOS, isInAppBrowser, permissionHelp } from "@/lib/utils/platform";
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

/**
 * آیا ورود صوتی روی این دستگاه در دسترس است؟
 *
 * 🔴 دو مسیر دارد، نه یکی:
 *
 *   ۱ تشخیص گفتار مرورگر (`SpeechRecognition`) — کروم و اندروید
 *   ۲ دیکته‌ی کیبورد سیستم — هر دستگاه لمسی، بدون هیچ API
 *
 * نسخه‌ی قبلی فقط مسیر اول را می‌سنجید و در نبودش **دکمه را کاملاً
 * پنهان می‌کرد**. روی آیفونی که کلید آزمایشی سافاری
 * (Settings ← Safari ← Advanced ← Experimental Features ←
 * Speech Recognition API) خاموش دارد — که پیش‌فرض است —
 * `webkitSpeechRecognition` تعریف‌نشده است، پس کاربر حتی دکمه‌ی
 * «افزودن با صدا» را هم نمی‌دید و راه دیکته هم برایش بسته می‌ماند.
 * (با شبیه‌سازی همان حالت بازتولید شد: دکمه در DOM نبود.)
 *
 * حالا روی iOS همیشه true است، چون دیکته‌ی کیبورد همیشه کار می‌کند.
 */
export const isVoiceSupported = (): boolean =>
  getRecognitionCtor() !== null || isIOS();

type Props = {
  open: boolean;
  onClose: () => void;
  /** کاتالوگ برای تطبیق. */
  variants: SelectableVariant[];
  /** کاربر گزینه‌ای را تأیید کرد. */
  onConfirm: (variant: SelectableVariant, qty: number) => void;
};

type Phase = "idle" | "requesting" | "listening" | "matched" | "nomatch" | "denied" | "error";

export function VoiceOrder({ open, onClose, variants, onConfirm }: Props) {
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  /** جلوگیری از دو تلاش هم‌زمان راه‌اندازی. */
  const startingRef = useRef(false);
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [interim, setInterim] = useState("");
  const [finalText, setFinalText] = useState("");
  const [qty, setQty] = useState(1);
  const [matches, setMatches] = useState<Scored<SelectableVariant>[]>([]);
  const [errorText, setErrorText] = useState("");
  const [added, setAdded] = useState<string[]>([]);
  /*
    🔴 حالت دیکته‌ی کیبورد — راه‌حل قطعی برای آیفون.

    پس از دو دور اصلاح، کاربر همچنان گزارش داد میکروفون کار نمی‌کند.
    علت ریشه‌ای که بعداً پیدا شد: سافاری iOS یک کلید آزمایشی دارد
    (Settings ← Safari ← Advanced ← Experimental Features ←
    Speech Recognition API) که اگر خاموش باشد، `webkitSpeechRecognition`
    وجود دارد ولی هرگز کار نمی‌کند. هیچ کدی نمی‌تواند آن را روشن کند و
    هیچ API‌ای هم وضعیتش را گزارش نمی‌دهد.

    ولی **دیکته‌ی کیبورد آیفون** (دکمه‌ی میکروفون کنار Space) در هر
    فیلد متنی کار می‌کند، هیچ مجوز وبی نمی‌خواهد و از همان موتور
    تشخیص گفتار اپل استفاده می‌کند. کاربر روی فیلد می‌زند، میکروفون
    کیبورد را لمس می‌کند و حرف می‌زند — متن در فیلد می‌نشیند و ما
    همان `parseUtterance` را رویش اجرا می‌کنیم.

    نتیجه یکی است: «سه عدد شومیز آبی» به سبد اضافه می‌شود.
  */
  const [dictationMode, setDictationMode] = useState(false);
  const [typed, setTyped] = useState("");

  /*
    🔴 این سه باید *پیش از* هر return زودهنگام باشند.

    نسخه‌ی اول بعد از `if (!open || !mounted) return null` نوشته شده
    بود. وقتی پنجره بسته است آن سه useMemo اجرا نمی‌شدند و به‌محض باز
    شدن اجرا می‌شدند — یعنی تعداد هوک‌ها بین دو رندر فرق می‌کرد و
    React با خطای #310 کل صفحه را می‌ترکاند.
    (روی شبیه‌سازی آیفون بازتولید شد: صفحه‌ی «خطای برنامه».)

    درس: قانون هوک‌ها استثنا ندارد؛ حتی برای مقداری که ثابت است.
  */
  const ios = useMemo(() => isIOS(), []);
  const inAppBrowser = useMemo(() => isInAppBrowser(), []);
  const help = useMemo(() => permissionHelp("microphone"), []);

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
      /*
        اگر کاتالوگ هنوز نرسیده، «پیدا نشد» گفتن دروغ است — کالا
        هست، ما هنوز فهرست را نداریم. تفکیک این دو برای اعتماد کاربر
        مهم است.
      */
      if (variants.length === 0) {
        setMatches([]);
        setPhase("error");
        setErrorText("فهرست کالاها هنوز آماده نیست. یک لحظه صبر کنید و دوباره بگویید.");
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

  const runStart = useCallback(async () => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      /*
        روی iOS این حالت رایج است (کلید آزمایشی سافاری خاموش).
        به‌جای پیام بن‌بست، به حالت دیکته می‌رویم که همیشه کار می‌کند.
      */
      if (ios) {
        setDictationMode(true);
        setPhase("idle");
        return;
      }
      setPhase("error");
      setErrorText("مرورگر شما تشخیص گفتار ندارد. کروم یا سافاری را امتحان کنید.");
      return;
    }

    stop();

    /*
      🔴 چرا اول getUserMedia؟

      SpeechRecognition.start() خودش پنجره‌ی «اجازه می‌دهید؟» کروم را
      باز نمی‌کند. اگر کاربر قبلاً به این دامنه اجازه‌ی میکروفون نداده
      باشد، بی‌صدا با not-allowed شکست می‌خورد — کاربر پیام «اجازه
      داده نشد» می‌بیند بدون اینکه هرگز چیزی از او پرسیده شده باشد.
      (تأییدشده: permissions.query وضعیت "prompt" می‌داد و start()
      نه onstart می‌داد نه onerror.)

      getUserMedia همان درخواستی است که پنجره را می‌آورد. بلافاصله
      پس از گرفتن مجوز، جریان را می‌بندیم چون خود SpeechRecognition
      میکروفون را جدا باز می‌کند؛ نگه‌داشتنش یعنی دو بار اشغال
      میکروفون و روشن ماندن نشانگر ضبط.

      🔴 روی iOS این *تنها* فراخوانی است و باید در همان چرخه‌ی لمس
      کاربر رخ دهد. نسخه‌ی قبلی دو بار getUserMedia می‌زد (یکی اینجا
      و یکی چند خط بالاتر)؛ سافاری موبایل دومی را خارج از ژست کاربر
      می‌دید و NotAllowedError می‌داد — بدون اینکه هرگز پنجره‌ای نشان
      داده شود. کاربر «دسترسی مسدود است» می‌دید و هر کاری در تنظیمات
      می‌کرد فرقی نمی‌کرد، چون مجوز اصلاً مسئله نبود.
    */
    /*
      🔴 روی iOS این مرحله *رد می‌شود*.

      گزارش کاربر با اسکرین‌شات: «بارکدخوان و دوربین کار می‌کند ولی
      میکروفون نه». همین تفاوت، ریشه را لو داد.

      در سافاری iOS، `getUserMedia({audio:true})` و
      `SpeechRecognition` دو مسیر مجوز **جداگانه** دارند:
        • getUserMedia مجوز «ضبط صدا» می‌خواهد
        • SpeechRecognition مجوز «تشخیص گفتار» می‌خواهد و پنجره‌ی
          خودش را نشان می‌دهد
      اولی می‌تواند رد شود در حالی که دومی کاملاً کار می‌کند. ما با
      رد شدن getUserMedia زودتر تسلیم می‌شدیم و «دسترسی داده نشد»
      می‌گفتیم — بدون اینکه اصلاً تشخیص گفتار را امتحان کرده باشیم.

      روی کروم و اندروید برعکس است: آنجا SpeechRecognition خودش
      پنجره باز نمی‌کند و بدون getUserMedia بی‌صدا شکست می‌خورد. پس
      رفتار هر پلتفرم جدا می‌ماند.
    */
    if (!ios && navigator.mediaDevices?.getUserMedia) {
      setPhase("requesting");
      try {
        const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
        probe.getTracks().forEach((t) => t.stop());
      } catch (err) {
        const name = (err as Error)?.name ?? "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          setPhase("denied");
          // متن دقیق در UI بر اساس پلتفرم ساخته می‌شود؛ اینجا خالی
          // می‌ماند تا دو پیام متناقض نشان داده نشود.
          setErrorText("");
        } else if (name === "NotFoundError") {
          setPhase("error");
          setErrorText("میکروفونی روی این دستگاه پیدا نشد.");
        } else {
          setPhase("error");
          setErrorText("دسترسی به میکروفون ممکن نشد. دوباره تلاش کنید.");
        }
        return;
      }
    } else if (ios) {
      // پنجره‌ی مجوز را خودِ SpeechRecognition نشان می‌دهد.
      setPhase("requesting");
    }
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
        // متن خالی: بلوک راهنمای بازیابی پایین‌تر جزئیات را نشان می‌دهد.
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
  }, [handleTranscript, stop, ios]);

  const start = useCallback(async () => {
    /*
      🔴 قفل هم‌زمانی.

      حتی با وابستگی [open] در افکت، getUserMedia دو بار صدا زده
      می‌شد (ردیابی شد: دو نقطه‌ی فراخوانی متفاوت در باندل). برای
      کاربر یعنی احتمال دیدن دو پنجره‌ی مجوز پشت سر هم.

      رفرنس است نه state، چون باید بلافاصله اثر کند نه در رندر بعدی.
    */
    if (startingRef.current) return;
    startingRef.current = true;
    try {
      await runStart();
    } finally {
      startingRef.current = false;
    }
  }, [runStart]);


  /*
    با باز شدن، اول وضعیت مجوز پرسیده می‌شود.

    اگر از قبل مسدود است، وقت کاربر با یک تلاش محکوم‌به‌شکست تلف
    نمی‌شود و مستقیم راهنمای بازیابی می‌آید.
    permissions.query در همه‌ی مرورگرها نیست؛ در نبودش مثل قبل
    مستقیم تلاش می‌کنیم.

    🔴 چرا start در وابستگی‌های افکت نیست؟
      start به handleTranscript وابسته است و آن به variants. کاتالوگ
      با تأخیر می‌رسد، پس هویت start عوض می‌شد و افکت دوباره اجرا
      می‌گشت — یعنی getUserMedia دو بار صدا زده می‌شد و کاربر
      احتمالاً دو بار پنجره‌ی مجوز می‌دید.
      (اندازه‌گیری‌شده: شمارنده ۲ می‌داد، حالا ۱.)

      رفرنس همیشه تازه نگه داشته می‌شود، پس بسته‌شدگی کهنه نداریم.
  */
  const startRef = useRef(start);
  useEffect(() => { startRef.current = start; }, [start]);

  useEffect(() => {
    if (!open) { stop(); setPhase("idle"); setAdded([]); setTyped(""); setDictationMode(false); return; }

    /*
      🔴 روی iOS خودکار شروع نمی‌کنیم.

      سافاری موبایل مجوز میکروفون را فقط در پاسخ *مستقیم* به لمس
      می‌دهد. جریان قبلی این بود:

        لمس دکمه → setVoiceOpen(true) → رندر → useEffect
                 → await permissions.query → getUserMedia

      هر `await` میان راه، زنجیره‌ی «ژست کاربر» را می‌شکند و وقتی
      نوبت به getUserMedia می‌رسد سافاری آن را خارج از ژست می‌بیند و
      NotAllowedError می‌دهد — بدون اینکه هرگز پنجره‌ای به کاربر نشان
      داده شود. کاربر فقط «دسترسی مسدود است» می‌دید و هر کاری در
      تنظیمات می‌کرد فرقی نمی‌کرد، چون مجوز اصلاً مسئله نبود.

      روی iOS پنجره با دکمه‌ی «شروع صحبت» باز می‌شود؛ آن کلیک، خودش
      ژست معتبر است و getUserMedia بدون واسطه در همان چرخه صدا زده
      می‌شود.

      روی دسکتاپ و اندروید رفتار قبلی (شروع خودکار) حفظ می‌شود چون
      آنجا محدودیتی نیست و یک لمس اضافه فقط مزاحمت است.
    */
    if (isIOS()) {
      setPhase("idle");
      /*
        روی iOS از همان ابتدا حالت دیکته پیشنهاد می‌شود.
        تشخیص گفتار وب آنجا به یک کلید آزمایشیِ خاموش وابسته است و
        نمی‌شود فهمید روشن است یا نه — تنها راه، تلاش و شکست است.
        به‌جای آن، مسیری که *همیشه* کار می‌کند پیش‌فرض می‌شود و
        تلاش برای میکروفون به‌عنوان گزینه‌ی دوم می‌ماند.
      */
      setDictationMode(true);
      return () => { stop(); };
    }

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
      if (!cancelled) void startRef.current();
    })();
    return () => { cancelled = true; stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
  const requesting = phase === "requesting";

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
          {/*
            🔴 حالت دیکته — مسیری که روی آیفون همیشه کار می‌کند.

            به‌جای تشخیص گفتار وب (که در سافاری پشت یک کلید آزمایشیِ
            پیش‌فرض‌خاموش است)، از دیکته‌ی خودِ کیبورد استفاده می‌شود:
            کاربر روی کادر می‌زند، میکروفون کیبورد را لمس می‌کند و
            حرف می‌زند. هیچ مجوز وبی در کار نیست.
          */}
          {dictationMode ? (
            <div className="space-y-3">
              <div className="rounded-xl bg-info-soft/50 p-3 text-xs leading-6 text-foreground">
                <p className="font-extrabold text-info-onSoft">با میکروفون کیبورد بگویید</p>
                <ol className="mt-1.5 list-inside list-decimal space-y-0.5 text-muted-foreground">
                  <li>روی کادر پایین بزنید تا کیبورد باز شود</li>
                  <li>دکمه‌ی میکروفون 🎙️ کنار دکمه‌ی فاصله را لمس کنید</li>
                  <li>بگویید: «سه عدد شومیز آبی»</li>
                </ol>
              </div>

              <div>
                <label htmlFor="voice-dictation" className="mb-1.5 block text-sm font-bold text-foreground">
                  متن سفارش
                </label>
                <textarea
                  id="voice-dictation"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  rows={2}
                  autoComplete="off"
                  placeholder="مثلاً: سه عدد شومیز آبی"
                  className="w-full rounded-xl border border-border bg-card p-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <p className="mt-1 text-2xs text-muted-foreground">
                  می‌توانید تایپ هم بکنید — فرقی نمی‌کند.
                </p>
              </div>

              <Button
                className="w-full"
                disabled={typed.trim().length < 2}
                onClick={() => {
                  handleTranscript(typed);
                  setTyped("");
                }}
              >
                جستجوی کالا
              </Button>

              {/*
                تلاش برای میکروفون به‌عنوان گزینه‌ی دوم می‌ماند: اگر
                کاربر کلید آزمایشی سافاری را روشن کرده باشد، کار
                می‌کند و تجربه‌ی روان‌تری دارد.
              */}
              <button
                type="button"
                onClick={() => { setDictationMode(false); void start(); }}
                className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-bold text-muted-foreground transition hover:bg-muted"
              >
                یا میکروفون مرورگر را امتحان کنید
              </button>
            </div>
          ) : (
          <>
          {/* نشانگر میکروفون */}
          <div className="flex flex-col items-center gap-3 py-2">
            <button
              type="button"
              onClick={listening ? stop : () => void start()}
              disabled={requesting}
              aria-label={listening ? "توقف ضبط" : "شروع ضبط"}
              className={cn(
                "relative flex h-20 w-20 items-center justify-center rounded-full transition",
                "focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30",
                listening
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-primary text-primary-foreground hover:bg-primary/90",
                requesting && "opacity-70"
              )}
            >
              {listening && (
                <span
                  aria-hidden
                  className="absolute inset-0 animate-ping rounded-full bg-destructive/40 motion-reduce:animate-none"
                />
              )}
              {requesting ? (
                <Loader2 size={30} className="animate-spin motion-reduce:animate-none" />
              ) : listening ? (
                <MicOff size={30} />
              ) : (
                <Mic size={30} />
              )}
            </button>

            <p role="status" aria-live="polite" className="min-h-6 text-center text-sm font-bold text-foreground">
              {requesting && "در انتظار اجازه‌ی دسترسی به میکروفون…"}
              {listening && !interim && "بگویید… مثلاً «سه عدد شومیز شانتون»"}
              {listening && interim && <span className="text-muted-foreground">{interim}</span>}
              {!listening && finalText && `شنیدم: «${finalText}»`}
              {!listening && !requesting && !finalText && phase === "idle" &&
                (ios
                  ? "برای شروع، دکمه‌ی میکروفون را لمس کنید"
                  : "برای گفتن دوباره، میکروفون را بزنید")}
            </p>
          </div>

          {/*
            🔴 هشدار مرورگر درون‌برنامه‌ای — پیش از هر تلاش.

            بیشتر کاربران ایرانی لینک را از اینستاگرام یا تلگرام باز
            می‌کنند. در WKWebView روی iOS، `webkitSpeechRecognition`
            وجود دارد (پس isVoiceSupported درست می‌گوید «پشتیبانی
            می‌شود») ولی start() بی‌صدا شکست می‌خورد. بدترین حالت:
            دکمه هست، کاربر می‌زند، هیچ اتفاقی نمی‌افتد.
            بهتر است *قبل* از تلاش بگوییم چرا کار نمی‌کند.
          */}
          {inAppBrowser && phase === "idle" && (
            <div className="mt-3 rounded-xl bg-warning-soft p-3.5 text-xs leading-6 text-foreground">
              <p className="flex items-start gap-2 font-bold text-warning-onSoft">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />
                این صفحه داخل اپ دیگری باز شده
              </p>
              <p className="mt-1.5">
                میکروفون در مرورگرِ داخل اینستاگرام و تلگرام کار نمی‌کند. از منوی «…» گزینه‌ی
                «Open in Safari» یا «باز کردن در مرورگر» را بزنید.
              </p>
            </div>
          )}

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
                دسترسی به میکروفون داده نشد
              </p>

              {/*
                🔴 راهنما باید متناسب با همان دستگاه باشد.

                پیام قبلی می‌گفت «روی آیکون قفل کنار نشانی سایت بزنید».
                در سافاری آیفون **چنین آیکونی وجود ندارد** — کاربر
                دنبال چیزی می‌گشت که نبود و هیچ کاری از دستش برنمی‌آمد.
                مسیر واقعی آیفون از دکمه‌ی «aA» در نوار نشانی می‌گذرد.
              */}
              {/*
                راهنما از یک منبع مشترک می‌آید (`permissionHelp`) تا
                همان متن در بارکدخوان هم استفاده شود و دو جا از هم
                جدا نیفتند.
              */}
              {help.note && help.variant === "in-app" && (
                <p className="mt-2 text-foreground">{help.note}</p>
              )}
              <ol className="mt-2 list-inside list-decimal space-y-1 pr-1 text-foreground">
                {help.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              {help.note && help.variant !== "in-app" && (
                <p className="mt-2 text-muted-foreground">{help.note}</p>
              )}

              <Button
                variant="secondary"
                className="mt-3 w-full"
                onClick={() => { setErrorText(""); void start(); }}
              >
                تلاش دوباره
              </Button>

              {/*
                🔴 راه خروج از بن‌بست.

                گزارش کاربر: «هنوز تو آیفون نمی‌تونم کاری کنم». حتی با
                بهترین راهنما، بعضی دستگاه‌ها به هر دلیلی (نسخه‌ی iOS،
                محدودیت Screen Time، مرورگر واسط) میکروفون نمی‌دهند.

                در آن حالت کاربر نباید در یک صفحه‌ی خطا حبس شود. این
                دکمه او را به همان کاری می‌رساند که می‌خواست انجام
                دهد — افزودن کالا — فقط از راه دیگر.
              */}
              {/*
                🔴 مسیر نجات: دیکته‌ی کیبورد.

                وقتی میکروفون مرورگر رد می‌شود، این همان کار را از راه
                دیگری انجام می‌دهد و هیچ مجوز وبی نمی‌خواهد. برای
                کاربر آیفون که در سه دور اصلاح همچنان گیر کرده بود،
                این تنها مسیری است که قطعاً کار می‌کند.
              */}
              <Button
                className="mt-2 w-full"
                onClick={() => { setPhase("idle"); setErrorText(""); setDictationMode(true); }}
              >
                به‌جایش با میکروفون کیبورد بگویم
              </Button>

              <button
                type="button"
                onClick={onClose}
                className="mt-2 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-bold text-foreground transition hover:bg-muted"
              >
                بی‌خیال، کالا را دستی انتخاب می‌کنم
              </button>
            </div>
          )}

          {phase === "error" && (
            <div role="alert" className="mt-2 flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-xs leading-6 text-destructive-text">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />
              <span>{errorText}</span>
            </div>
          )}
          </>
          )}

          {/*
            نتایج بیرون از شرط حالت‌اند: چه با میکروفون و چه با دیکته،
            کالای پیداشده باید یکجا نمایش داده شود.
          */}
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
