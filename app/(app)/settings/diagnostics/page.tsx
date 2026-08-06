"use client";

import { useEffect, useState } from "react";
import { Check, Copy, RefreshCw, X } from "lucide-react";
import { PageHeader } from "@/components/shared/ui";
import { Button, Card, useToast } from "@/src/shared/ui";
import { isIOS, isInAppBrowser } from "@/lib/utils/platform";
import { cn } from "@/lib/utils/cn";

/**
 * تشخیص وضعیت میکروفون و دوربین.
 *
 * چرا ساخته شد: مشکل میکروفون آیفون سه دور اصلاح شد و هر بار یک علت
 * واقعی پیدا شد، ولی کاربر همچنان گیر بود. حدس‌زدن از راه دور جواب
 * نمی‌دهد. این صفحه وضعیت دقیق همان دستگاه را نشان می‌دهد و با یک دکمه
 * قابل کپی‌کردن است تا در تیکت پشتیبانی فرستاده شود.
 *
 * ⚠️ هیچ داده‌ای به سرور نمی‌رود؛ همه‌چیز در مرورگر خودِ کاربر می‌ماند.
 */

type DiagCheck = {
  label: string;
  value: string;
  ok: boolean | null;   // null = نامشخص/بی‌ربط
  hint?: string;
};

export default function DiagnosticsPage() {
  const { toast } = useToast();
  const [checks, setChecks] = useState<DiagCheck[]>([]);
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    const out: DiagCheck[] = [];

    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    out.push({ label: "مرورگر", value: ua.slice(0, 120), ok: null });
    out.push({
      label: "سیستم",
      value: isIOS() ? "iOS (آیفون/آیپد)" : /Android/i.test(ua) ? "اندروید" : "دسکتاپ",
      ok: null,
    });
    out.push({
      label: "مرورگر داخل اپ دیگر",
      value: isInAppBrowser() ? "بله — اینستاگرام/تلگرام" : "خیر",
      ok: !isInAppBrowser(),
      hint: isInAppBrowser()
        ? "میکروفون در مرورگر داخل اپ‌ها کار نمی‌کند. از «…» گزینه‌ی Open in Safari را بزنید."
        : undefined,
    });

    // اتصال امن — بدون HTTPS هیچ‌کدام کار نمی‌کنند
    const secure = typeof window !== "undefined" && window.isSecureContext;
    out.push({
      label: "اتصال امن (HTTPS)",
      value: secure ? "بله" : "خیر",
      ok: secure,
      hint: secure ? undefined : "بدون HTTPS مرورگر اجازه‌ی میکروفون و دوربین نمی‌دهد.",
    });

    // آیا API تشخیص گفتار *وجود دارد*؟
    const w = typeof window !== "undefined" ? (window as unknown as Record<string, unknown>) : {};
    const hasSR = Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
    out.push({
      label: "API تشخیص گفتار",
      value: hasSR ? "موجود است" : "موجود نیست",
      ok: hasSR,
      hint: hasSR
        ? undefined
        : "مرورگر شما تشخیص گفتار ندارد. از حالت «میکروفون کیبورد» استفاده کنید.",
    });

    /*
      ⚠️ `navigator.mediaDevices?.getUserMedia` بررسی نمی‌شود.
      TypeScript درست هشدار داد: در تعریف نوع، آن متد همیشه موجود
      است، پس شرط همیشه true می‌شد. چیزی که واقعاً ممکن است نباشد
      خودِ `mediaDevices` است — مرورگر در اتصال غیرامن آن را حذف
      می‌کند.
    */
    const hasMediaDevices = typeof navigator !== "undefined" && !!navigator.mediaDevices;
    out.push({
      label: "API دسترسی به میکروفون",
      value: hasMediaDevices ? "موجود است" : "موجود نیست",
      ok: hasMediaDevices,
      hint: hasMediaDevices ? undefined : "معمولاً یعنی صفحه با HTTPS باز نشده است.",
    });

    /*
      وضعیت مجوز.
      ⚠️ سافاری این API را ندارد و استثنا می‌دهد؛ آن حالت «نامشخص» است
      نه «خطا».
    */
    try {
      const st = await navigator.permissions?.query({ name: "microphone" as PermissionName });
      out.push({
        label: "مجوز میکروفون",
        value:
          st?.state === "granted" ? "داده شده" :
          st?.state === "denied" ? "رد شده" :
          st?.state === "prompt" ? "هنوز پرسیده نشده" : "نامشخص",
        ok: st?.state === "granted" ? true : st?.state === "denied" ? false : null,
        hint: st?.state === "denied"
          ? "مرورگر میکروفون را برای این سایت مسدود کرده است."
          : undefined,
      });
    } catch {
      out.push({
        label: "مجوز میکروفون",
        value: "مرورگر گزارش نمی‌دهد (طبیعی در سافاری)",
        ok: null,
      });
    }

    /*
      آزمون واقعی: باز کردن میکروفون.
      این تنها سنجه‌ی قابل اتکاست — بقیه فقط نشانه‌اند.
    */
    if (hasMediaDevices) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
        out.push({ label: "آزمون واقعی میکروفون", value: "موفق ✓", ok: true });
      } catch (e) {
        const name = (e as Error)?.name ?? "خطای نامشخص";
        out.push({
          label: "آزمون واقعی میکروفون",
          value: `ناموفق — ${name}`,
          ok: false,
          hint:
            name === "NotAllowedError"
              ? "مجوز داده نشده یا مسدود شده است."
              : name === "NotFoundError"
                ? "میکروفونی روی دستگاه پیدا نشد."
                : "علت نامشخص؛ این متن را برای پشتیبانی بفرستید.",
        });
      }
    }

    setChecks(out);
    setRunning(false);
  }

  useEffect(() => { void run(); /* eslint-disable-next-line */ }, []);

  async function copyAll() {
    const text = checks.map((c) => `${c.label}: ${c.value}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast({ tone: "success", title: "کپی شد", description: "در تیکت پشتیبانی بچسبانید." });
    } catch {
      toast({ tone: "error", title: "کپی نشد", description: "متن را دستی انتخاب کنید." });
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="بررسی میکروفون و دوربین"
        subtitle="وضعیت دستگاه شما برای ورود صوتی و اسکن بارکد"
        action={
          <Button variant="secondary" onClick={() => void run()} loading={running} icon={<RefreshCw size={15} />}>
            بررسی دوباره
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <ul className="divide-y divide-border">
          {checks.map((c) => (
            <li key={c.label} className="flex items-start gap-3 p-3.5">
              <span
                className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                  c.ok === true ? "bg-success-soft text-success-onSoft"
                    : c.ok === false ? "bg-destructive/10 text-destructive-text"
                      : "bg-muted text-muted-foreground"
                )}
                aria-hidden
              >
                {c.ok === true ? <Check size={13} /> : c.ok === false ? <X size={13} /> : "—"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-foreground">{c.label}</p>
                <p className="mt-0.5 break-words text-2xs text-muted-foreground" dir="auto">
                  {c.value}
                </p>
                {c.hint && (
                  <p className="mt-1 text-2xs leading-5 text-warning-onSoft">{c.hint}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-4">
        <p className="text-xs leading-6 text-muted-foreground">
          اگر ورود صوتی کار نمی‌کند، این نتیجه را کپی کنید و در بخش «پشتیبانی» برای ما بفرستید
          تا دقیقاً بدانیم روی دستگاه شما چه می‌گذرد.
        </p>
        <Button className="mt-3 w-full" variant="secondary" onClick={copyAll} icon={<Copy size={15} />}>
          کپی نتیجه‌ی بررسی
        </Button>
      </Card>

      {isIOS() && (
        <Card className="border-info/25 bg-info-soft/40 p-4">
          <p className="text-xs font-extrabold text-info-onSoft">نکته‌ی مخصوص آیفون</p>
          <p className="mt-1.5 text-xs leading-6 text-foreground">
            سافاری یک کلید مخفی برای تشخیص گفتار دارد که به‌صورت پیش‌فرض خاموش است:
          </p>
          <p className="mt-1.5 rounded-lg bg-card p-2.5 text-2xs leading-6 text-foreground" dir="ltr">
            Settings → Safari → Advanced → Experimental Features → Speech Recognition API
          </p>
          <p className="mt-1.5 text-xs leading-6 text-muted-foreground">
            اگر روشنش کنید و سافاری را ببندید و باز کنید، ورود صوتی مستقیم کار می‌کند.
            در غیر این صورت از حالت «میکروفون کیبورد» استفاده کنید که همیشه کار می‌کند و
            هیچ تنظیمی نمی‌خواهد.
          </p>
        </Card>
      )}
    </div>
  );
}
