"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, KeyRound } from "lucide-react";
import { Button, Field, Input } from "@/src/shared/ui";
import { createClient } from "@/lib/supabase/client";
import { BRAND_NAME } from "@/lib/brand";
import { firstPasswordError, passwordStrength } from "@/lib/security/password";
import { RESET_CODE_LENGTH } from "@/lib/security/recovery.shared";

/**
 * تعیین رمز جدید — دو حالت در یک صفحه.
 *
 *   الف) کاربر از **لینک ایمیل** آمده ⇒ Supabase نشست بازیابی ساخته
 *        است و فقط رمز جدید لازم است.
 *   ب) کاربر **کد مدیر** دارد ⇒ شناسه + کد + رمز جدید.
 *
 * 🔴 حالت درست خودکار تشخیص داده می‌شود، نه با پرسیدن از کاربر.
 * کسی که روی لینک ایمیل زده نباید بفهمد «کد» چیست.
 */
function ResetPasswordInner() {
  const router = useRouter();
  const [mode, setMode] = useState<"detecting" | "email" | "code">("detecting");

  const [loginId, setLoginId] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  /*
    تشخیص نشست بازیابی.

    ⚠️ Supabase توکن را در قطعه‌ی هش آدرس (#access_token=…) می‌گذارد
    و کتابخانه‌ی کلاینت آن را می‌خواند و نشست می‌سازد. پس باید
    *پس از* mount بررسی شود، نه در سرور.
  */
  useEffect(() => {
    let alive = true;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      const fromEmailLink =
        typeof window !== "undefined" && window.location.hash.includes("access_token");
      setMode(data.session && fromEmailLink ? "email" : "code");
    })();
    return () => {
      alive = false;
    };
  }, []);

  const strength = passwordStrength(password);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // اعتبارسنجی سمت کلاینت فقط برای بازخورد سریع است؛ الزام در سرور اعمال می‌شود.
    const problem = firstPasswordError(password);
    if (problem) {
      setError(problem);
      return;
    }
    if (password !== confirm) {
      setError("رمز جدید و تکرارش یکسان نیستند.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "email") {
        const supabase = createClient();
        const { error: e2 } = await supabase.auth.updateUser({ password });
        if (e2) {
          setError("تغییر رمز انجام نشد. ممکن است لینک منقضی شده باشد.");
          setLoading(false);
          return;
        }
      } else {
        const res = await fetch("/api/auth/reset-code", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ login_id: normalizeLoginId(loginId), code, password }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(json.error ?? "تغییر رمز انجام نشد.");
          setLoading(false);
          return;
        }
      }
      setDone(true);
    } catch {
      setError("ارتباط با سرور برقرار نشد.");
    }
    setLoading(false);
  }

  function normalizeLoginId(value: string) {
    const clean = value.trim().toLowerCase();
    if (clean.includes("@")) return clean;
    const digits = clean
      .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
      .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
      .replace(/[^0-9]/g, "");
    if (digits && digits.length >= 7) return `${digits}@hesabyar.app`;
    return clean ? `${clean}@hesabyar.app` : clean;
  }

  if (done) {
    return (
      <Shell>
        <div className="text-center">
          <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success-onSoft">
            <CheckCircle2 size={28} />
          </div>
          <h2 className="mt-4 text-xl font-black text-slate-800">رمز عبور عوض شد</h2>
          <p className="mt-2 text-sm leading-7 text-slate-500">
            حالا می‌توانید با رمز جدید وارد شوید.
          </p>
          <Button className="mt-6 w-full" onClick={() => router.push("/login")}>
            رفتن به صفحه ورود
          </Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <form onSubmit={handleSubmit}>
        <div className="mb-7">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <KeyRound size={22} />
          </div>
          <h2 className="mt-4 text-2xl font-black text-slate-800">تعیین رمز جدید</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {mode === "email"
              ? "رمز تازه‌ای برای حسابتان انتخاب کنید."
              : "شناسه، کد دریافتی از مدیر و رمز تازه را وارد کنید."}
          </p>
        </div>

        <div className="space-y-4">
          {mode === "code" && (
            <>
              <Field label="شماره موبایل یا ایمیل" required>
                <Input
                  type="text"
                  required
                  dir="ltr"
                  className="text-left"
                  placeholder="09111558263"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                />
              </Field>

              <Field label="کد بازیابی" required hint={`کد ${RESET_CODE_LENGTH} رقمی که مدیر مجموعه به شما داده است.`}>
                <Input
                  type="text"
                  required
                  dir="ltr"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="text-center text-lg tracking-[0.4em]"
                  placeholder="12345678"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </Field>
            </>
          )}

          <Field label="رمز عبور جدید" required>
            <div className="relative">
              <Input
                type={show ? "text" : "password"}
                required
                dir="ltr"
                autoComplete="new-password"
                className="pl-12 text-left"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "پنهان کردن رمز عبور" : "نمایش رمز عبور"}
                className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </Field>

          {/*
            نوار قدرت فقط بازخورد بصری است.
            ملاک پذیرش `validatePassword` در سرور است.
          */}
          {password && (
            <div className="flex items-center gap-2" aria-hidden="true">
              <div className="flex flex-1 gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={`h-1.5 flex-1 rounded-full ${
                      i < strength.score ? "bg-primary" : "bg-slate-200"
                    }`}
                  />
                ))}
              </div>
              <span className="shrink-0 text-xs text-slate-500">{strength.label}</span>
            </div>
          )}

          <Field label="تکرار رمز جدید" required>
            <Input
              type={show ? "text" : "password"}
              required
              dir="ltr"
              autoComplete="new-password"
              className="text-left"
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>

          {error && (
            <div role="alert" className="rounded-2xl border border-destructive/15 bg-rose-50 px-4 py-3 text-sm font-medium text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" loading={loading} disabled={mode === "detecting"} className="w-full">
            تغییر رمز عبور
          </Button>
        </div>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
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
        <div className="rounded-[32px] border border-white/80 bg-white/90 p-6 shadow-2xl shadow-slate-900/10 backdrop-blur sm:p-8">
          {children}
          <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-center text-sm text-slate-500">
            <Link href="/login" className="font-extrabold text-primary hover:underline">
              بازگشت به صفحه ورود
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}
