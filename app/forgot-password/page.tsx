"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyRound, Mail, ShieldQuestion, UserCog } from "lucide-react";
import { Button, Field, Input } from "@/src/shared/ui";
import { BRAND_NAME } from "@/lib/brand";

/**
 * درخواست بازیابی رمز.
 *
 * دو مسیر بر اساس نوع حساب — ولی صفحه **هرگز نمی‌گوید** حساب وجود
 * دارد یا نه. تصمیم مسیر فقط از روی *شکل شناسه* گرفته می‌شود، نه از
 * روی وجودش در دیتابیس.
 */
export default function ForgotPasswordPage() {
  const [loginId, setLoginId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ channel: string; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** همان قاعده‌ی صفحه‌ی ورود: شماره به ایمیل ساختگی تبدیل می‌شود. */
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login_id: normalizeLoginId(loginId) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "درخواست انجام نشد. کمی بعد دوباره تلاش کنید.");
        setLoading(false);
        return;
      }
      setResult({ channel: json.channel, message: json.message });
    } catch {
      setError("ارتباط با سرور برقرار نشد.");
    }
    setLoading(false);
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

        <div className="rounded-[32px] border border-white/80 bg-white/90 p-6 shadow-2xl shadow-slate-900/10 backdrop-blur sm:p-8">
          {!result ? (
            <form onSubmit={handleSubmit}>
              <div className="mb-7">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <ShieldQuestion size={22} />
                </div>
                <h2 className="mt-4 text-2xl font-black text-slate-800">بازیابی رمز عبور</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  شناسه‌ای که با آن وارد می‌شوید را بنویسید تا راه بازیابی را نشانتان بدهیم.
                </p>
              </div>

              <div className="space-y-4">
                <Field label="شماره موبایل یا ایمیل" required>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <Input
                      type="text"
                      required
                      dir="ltr"
                      inputMode="email"
                      autoComplete="username"
                      className="pl-10 text-left"
                      placeholder="09111558263"
                      value={loginId}
                      onChange={(e) => setLoginId(e.target.value)}
                    />
                  </div>
                </Field>

                {error && (
                  <div role="alert" className="rounded-2xl border border-destructive/15 bg-rose-50 px-4 py-3 text-sm font-medium text-destructive">
                    {error}
                  </div>
                )}

                <Button type="submit" loading={loading} className="w-full">
                  ادامه
                </Button>
              </div>
            </form>
          ) : (
            <div>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-success/10 text-success-onSoft">
                {result.channel === "email" ? <Mail size={22} /> : <UserCog size={22} />}
              </div>
              <h2 className="mt-4 text-xl font-black text-slate-800">
                {result.channel === "email" ? "ایمیل بازیابی" : "بازیابی با کد مدیر"}
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">{result.message}</p>

              {result.channel === "email" ? (
                <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-500">
                  {/*
                    ⚠️ سقف پروژه ۲ ایمیل در ساعت است. صادقانه گفته
                    می‌شود تا کاربر بی‌خبر منتظر نماند.
                  */}
                  اگر تا چند دقیقه ایمیلی نرسید، پوشه‌ی هرزنامه را ببینید. در ساعت‌های شلوغ ممکن است
                  ارسال با تأخیر انجام شود؛ در این صورت از مدیر مجموعه کد بازیابی بگیرید.
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-500">
                    {/*
                      🔴 فلش جهت‌دار در متن راست‌به‌چپ بازچینش می‌شود.
                      نوشته بود «تنظیمات ← کاربران» ولی روی صفحه
                      «تنظیمات → کاربران» دیده می‌شد، یعنی ترتیب مسیر
                      برعکس به‌نظر می‌رسید. در DOM متن درست بود و فقط
                      رندر خراب می‌شد، پس تست رشته‌ای نمی‌گرفتش —
                      همان خانواده‌باگی که چند بار تکرار شده.

                      راه‌حل: به‌جای فلش، واژه‌ی «سپس» که جهت ندارد.
                    */}
                    مدیر مجموعه از بخش «تنظیمات» و سپس «کاربران و دسترسی‌ها» یک کد هشت‌رقمی
                    برای شما می‌سازد. کد ۳۰ دقیقه اعتبار دارد.
                  </div>
                  <Link href="/reset-password" className="block">
                    <Button variant="secondary" className="w-full">
                      <KeyRound size={16} /> کد را دارم
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          )}

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
