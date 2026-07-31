"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Sparkles, Store } from "lucide-react";
import { Button, Field, Input } from "@/src/shared/ui";
import { BRAND_NAME } from "@/lib/brand";

export default function LoginPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function normalizeLoginId(value: string) {
    const clean = value.trim().toLowerCase();
    if (clean.includes("@")) return clean;
    const digits = clean.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))).replace(/[^0-9]/g, "");
    if (digits && digits.length >= 7) return `${digits}@hesabyar.app`;
    return clean ? `${clean}@hesabyar.app` : clean;
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: normalizeLoginId(loginId), password });

    if (error) {
      setError("ایمیل یا رمز عبور اشتباه است.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-dvh overflow-y-auto bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.14),transparent_32%),linear-gradient(180deg,#f8fafc,white)] text-slate-900" dir="rtl">
      <div className="mx-auto grid min-h-dvh max-w-6xl grid-cols-1 items-center gap-8 px-4 py-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
        <section className="relative order-2 hidden max-h-[calc(100dvh-4rem)] min-h-0 overflow-y-auto rounded-[36px] border border-white/70 bg-primary p-8 text-primary-foreground shadow-2xl shadow-primary/20 lg:block">
          <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-24 right-8 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
          <div className="relative z-10 flex min-h-[560px] flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-sm font-bold backdrop-blur">
                <Sparkles size={16} /> حسابداری، فروش و انبار در یکجا
              </div>
              <div className="mt-10 flex items-center gap-4">
                <img src="/logo.png" alt={BRAND_NAME} className="h-20 w-20 rounded-3xl border border-white/30 bg-white object-contain p-2" />
                <div>
                  <h1 className="text-4xl font-black tracking-tight">{BRAND_NAME}</h1>
                  <p className="mt-2 text-white/75">سیستم مدیریت فروش و مالی</p>
                </div>
              </div>
              <p className="mt-10 max-w-lg text-lg leading-9 text-white/85">
                ورود امن به پنل مدیریت روزانه؛ برای ثبت فروش، کنترل موجودی، پیگیری بدهکاران و گزارش‌های مدیریتی.
              </p>
            </div>

            <div className="grid gap-3">
              {[
                { icon: Store, title: "POS سریع", text: "ثبت فروش و دسترسی فوری به مشتری و کالا" },
                { icon: ShieldCheck, title: "امن و چندکاربره", text: "دسترسی‌ها و داده‌ها با Supabase RLS محافظت می‌شوند" },
                { icon: LockKeyhole, title: "داده‌های مالی قابل اعتماد", text: "Audit و workflow برای عملیات حساس فعال است" },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="flex items-start gap-3 rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15"><Icon size={20} /></div>
                    <div>
                      <div className="font-extrabold">{item.title}</div>
                      <div className="mt-1 text-sm leading-6 text-white/70">{item.text}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="order-1 mx-auto w-full max-w-md animate-[fadeIn_0.35s_ease-out] lg:order-2">
          <div className="mb-8 text-center lg:hidden">
            <img src="/logo.png" alt={BRAND_NAME} className="mx-auto mb-3 h-24 w-24 object-contain" />
            <h1 className="text-2xl font-black text-slate-800">{BRAND_NAME}</h1>
            <p className="mt-1 text-sm text-slate-500">سیستم مدیریت فروش و مالی</p>
          </div>

          <form onSubmit={handleLogin} className="rounded-[32px] border border-white/80 bg-white/90 p-6 shadow-2xl shadow-slate-900/10 backdrop-blur sm:p-8">
            <div className="mb-7">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><LockKeyhole size={22} /></div>
              <h2 className="mt-4 text-2xl font-black text-slate-800">ورود به حساب</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">شماره موبایل یا ایمیل و رمز عبور خود را وارد کنید تا وارد داشبورد شوید.</p>
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
                    className="text-left pl-10"
                    placeholder="09111558263"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                  />
                </div>
              </Field>

              <Field label="رمز عبور" required>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    required
                    dir="ltr"
                    autoComplete="current-password"
                    className="text-left pl-12"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                    aria-label={showPassword ? "پنهان کردن رمز عبور" : "نمایش رمز عبور"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </Field>

              {error && (
                <div role="alert" className="rounded-2xl border border-destructive/15 bg-rose-50 px-4 py-3 text-sm font-medium text-destructive">
                  {error}
                </div>
              )}

              <Button type="submit" loading={loading} className="w-full">
                ورود به داشبورد
              </Button>
            </div>

            <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-center text-sm text-slate-500">
              حساب ندارید؟{" "}
              <Link href="/register" className="font-extrabold text-primary hover:underline">
                ثبت‌نام کسب‌وکار
              </Link>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
