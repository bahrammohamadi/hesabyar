"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button, Field, Input } from "@/src/shared/ui";
import { BRAND_NAME } from "@/lib/brand";
import {
  CLOCK_HINT,
  isWellFormedTotp,
  mfaErrorMessage,
  normalizeTotpInput,
  TOTP_CODE_LENGTH,
} from "@/lib/security/mfa";
import { toFaDigits } from "@/lib/utils/format";

/**
 * تأیید مرحله‌ی دوم هنگام ورود.
 *
 * 🔴 چرا این صفحه وجود دارد: اندازه‌گیری نشان داد ورود با رمز، وقتی
 * TOTP فعال است، **موفق می‌شود** و نشست `aal1` می‌دهد — و با همان
 * توکن می‌شود داده خواند. یعنی Supabase به‌تنهایی جلوی چیزی را
 * نمی‌گیرد. گارد در middleware کاربر را به اینجا می‌فرستد.
 */
function MfaChallengeInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";

  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.mfa.listFactors();
      if (!alive) return;
      const verified = (data?.totp ?? []).find((f) => f.status === "verified");
      setFactorId(verified?.id ?? null);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const clean = normalizeTotpInput(code);
    if (!isWellFormedTotp(clean)) {
      setError(`کد باید ${toFaDigits(TOTP_CODE_LENGTH)} رقم باشد.`);
      return;
    }
    if (!factorId) {
      setError("عامل دوم پیدا نشد. دوباره وارد شوید.");
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const { error: e2 } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: clean,
    });
    setBusy(false);

    if (e2) {
      setError(mfaErrorMessage(e2.message));
      /*
        ⚠️ ثبت تلاش ناموفق عمداً **بی‌صدا** است و جلوی نمایش خطا را
        نمی‌گیرد. اگر خطای ثبت را نشان می‌دادیم، کاربر دو پیام
        متفاوت می‌دید و گیج می‌شد.
      */
      void fetch("/api/auth/mfa-event", { method: "POST" }).catch(() => {});
      return;
    }

    /*
      `refresh` لازم است تا کوکی نشست با سطح جدید (aal2) در سرور هم
      دیده شود. بدون آن، middleware همچنان aal1 می‌بیند و کاربر را
      دوباره به همین صفحه برمی‌گرداند — حلقه‌ی بی‌پایان.
    */
    router.replace(next);
    router.refresh();
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <main
      dir="rtl"
      className="flex min-h-dvh items-center justify-center bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.14),transparent_32%),linear-gradient(180deg,#f8fafc,white)] px-4 py-10 text-slate-900"
    >
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <img src="/logo.png" alt={BRAND_NAME} className="mx-auto mb-3 h-20 w-20 object-contain" />
          <h1 className="text-2xl font-black text-slate-800">{BRAND_NAME}</h1>
        </div>

        <form
          onSubmit={submit}
          className="rounded-[32px] border border-white/80 bg-white/90 p-6 shadow-2xl shadow-slate-900/10 backdrop-blur sm:p-8"
        >
          <div className="mb-7">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ShieldCheck size={22} />
            </div>
            <h2 className="mt-4 text-2xl font-black text-slate-800">تأیید دومرحله‌ای</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              کد شش‌رقمی اپ احرازکننده را وارد کنید.
            </p>
          </div>

          <div className="space-y-4">
            <Field label="کد اپ احرازکننده" required>
              <Input
                dir="ltr"
                required
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                className="text-center text-lg tracking-[0.4em]"
                value={code}
                onChange={(ev) => setCode(ev.target.value)}
              />
            </Field>

            <p className="text-2xs leading-relaxed text-slate-500">{CLOCK_HINT}</p>

            {error && (
              <div role="alert" className="rounded-2xl border border-destructive/15 bg-rose-50 px-4 py-3 text-sm font-medium text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" loading={busy} disabled={loading} className="w-full">
              تأیید و ورود
            </Button>

            {/*
              🔴 راه خروج حتماً لازم است.

              اگر کاربر گوشی‌اش را گم کرده باشد، بدون این دکمه در
              صفحه‌ای گیر می‌کند که نه می‌تواند ردش کند و نه از آن
              خارج شود — حتی نمی‌تواند با حساب دیگری وارد شود.
            */}
            <button
              type="button"
              onClick={signOut}
              className="flex w-full items-center justify-center gap-1.5 text-sm font-bold text-slate-500 transition hover:text-primary"
            >
              <LogOut size={15} /> خروج و ورود با حساب دیگر
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

export default function MfaPage() {
  return (
    <Suspense fallback={null}>
      <MfaChallengeInner />
    </Suspense>
  );
}
