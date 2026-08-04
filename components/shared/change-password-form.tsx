"use client";

import { useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  MIN_PASSWORD_LENGTH,
  firstPasswordError,
  passwordStrength,
} from "@/lib/security/password";

/**
 * فرم تغییر رمز عبور کاربر.
 *
 * 🔴 چرا رمز فعلی پرسیده می‌شود؟
 *   Supabase در `updateUser({ password })` رمز فعلی را لازم ندارد؛
 *   فقط یک نشست معتبر می‌خواهد. یعنی هر کسی که چند لحظه به لپ‌تاپِ
 *   بازِ کاربر دسترسی داشته باشد می‌تواند رمز را عوض کند و صاحب حساب
 *   را برای همیشه بیرون بیندازد. سرور رمز فعلی را با یک ورود آزمایشی
 *   جداگانه بررسی می‌کند.
 */
export function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const strength = passwordStrength(next);
  /*
    خطای زنده فقط وقتی نشان داده می‌شود که کاربر چیزی تایپ کرده باشد.
    نمایش «حداقل ۸ کاراکتر» روی فیلد خالی، پیش از هر تلاشی، آزاردهنده است.
  */
  const liveError = next ? firstPasswordError(next, current) : null;
  const mismatch = confirm.length > 0 && next !== confirm;
  const canSubmit = !!current && !!next && !!confirm && !liveError && !mismatch && !saving;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setDone(false);

    if (next !== confirm) {
      setError("رمز جدید و تکرار آن یکسان نیستند.");
      return;
    }
    const clientError = firstPasswordError(next, current);
    if (clientError) {
      setError(clientError);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "تغییر رمز عبور ناموفق بود.");
        return;
      }
      setDone(true);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch {
      setError("ارتباط با سرور برقرار نشد.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <PasswordField
        id="current-password"
        label="رمز فعلی"
        value={current}
        onChange={setCurrent}
        show={showCurrent}
        onToggle={() => setShowCurrent((s) => !s)}
        autoComplete="current-password"
      />

      <div>
        <PasswordField
          id="new-password"
          label="رمز جدید"
          value={next}
          onChange={setNext}
          show={showNext}
          onToggle={() => setShowNext((s) => !s)}
          autoComplete="new-password"
          invalid={!!liveError}
        />
        {next && (
          <div className="mt-2">
            {/* نوار کیفیت — بازخورد بصری، نه ملاک پذیرش */}
            <div className="flex gap-1" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors",
                    i < strength.score
                      ? strength.score <= 1
                        ? "bg-destructive"
                        : strength.score === 2
                          ? "bg-warning"
                          : "bg-success"
                      : "bg-muted"
                  )}
                />
              ))}
            </div>
            <p
              className={cn(
                "mt-1 text-2xs",
                liveError ? "text-destructive-text" : "text-muted-foreground"
              )}
            >
              {liveError ?? `کیفیت: ${strength.label}`}
            </p>
          </div>
        )}
      </div>

      <div>
        <PasswordField
          id="confirm-password"
          label="تکرار رمز جدید"
          value={confirm}
          onChange={setConfirm}
          show={showNext}
          onToggle={() => setShowNext((s) => !s)}
          autoComplete="new-password"
          invalid={mismatch}
        />
        {mismatch && (
          <p className="mt-1 text-2xs text-destructive-text">رمز جدید و تکرار آن یکسان نیستند.</p>
        )}
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive-text">
          {error}
        </div>
      )}

      {done && (
        <div role="status" className="flex items-center gap-2 rounded-xl bg-success-soft px-4 py-3 text-sm text-success-onSoft">
          <ShieldCheck size={16} aria-hidden />
          رمز عبور با موفقیت تغییر کرد.
        </div>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={!canSubmit} className="btn-primary disabled:opacity-50">
          {saving ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <KeyRound size={16} aria-hidden />}
          تغییر رمز عبور
        </button>
        <span className="text-2xs text-muted-foreground">
          حداقل {MIN_PASSWORD_LENGTH} کاراکتر، نه فقط عدد
        </span>
      </div>
    </form>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  onToggle,
  autoComplete,
  invalid,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  autoComplete: string;
  invalid?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          className={cn("input pl-11 text-left", invalid && "border-destructive")}
          dir="ltr"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          aria-invalid={invalid || undefined}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={show ? `پنهان کردن ${label}` : `نمایش ${label}`}
          className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-primary"
        >
          {show ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
        </button>
      </div>
    </div>
  );
}
