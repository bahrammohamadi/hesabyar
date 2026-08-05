"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";
import { BRAND_NAME } from "@/lib/brand";
import { emailError } from "@/lib/email-guard";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // فقط وقتی کاربر چیزی نوشته باشد؛ فیلد خالی خطا نمی‌گیرد.
  const liveEmailError = email.trim() ? emailError(email) : null;

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    /*
      بررسی ایمیل پیش از رفت‌وبرگشت شبکه.
      محافظ واقعی تریگر دیتابیس است (0029)؛ این فقط پیام سریع‌تر و
      واضح‌تری به کاربر می‌دهد.
    */
    const emailProblem = emailError(email);
    if (emailProblem) {
      setError(emailProblem);
      return;
    }

    if (password.length < 6) {
      setError("رمز عبور باید حداقل ۶ کاراکتر باشد.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      /*
        پیام تریگر دیتابیس از قبل فارسی و قابل نمایش است؛ بقیه‌ی
        خطاها پیام عمومی می‌گیرند تا جزئیات داخلی لو نرود.
      */
      const raw = signUpError.message ?? "";
      setError(
        raw.includes("ایمیل موقت")
          ? "ثبت‌نام با ایمیل موقت امکان‌پذیر نیست. لطفاً از ایمیل اصلی خود استفاده کنید."
          : "خطا در ثبت‌نام: " + raw
      );
      setLoading(false);
      return;
    }

    /*
      سازمان دیگر اینجا ساخته نمی‌شود.

      قبلاً bootstrap_org همین‌جا صدا زده می‌شد و کاربر مستقیم به
      داشبورد می‌رفت. حالا به /onboarding می‌رود تا نوع کسب‌وکار،
      نام و شماره تماس را بدهد و سازمان همان‌جا با یک فراخوانی
      ساخته شود — هم داده‌ی بیشتری داریم، هم یک RPC کمتر.
    */
    if (data.session) {
      router.push("/onboarding");
      router.refresh();
      return;
    }

    /*
      🔴 حالت بدون نشست — باگی که روی سرور واقعی بازتولید شد.

      وقتی تأیید ایمیل *پیش از* ورود لازم بود، کاربر اینجا پیام
      «لینک به ایمیلت رفت» می‌گرفت و همان‌جا رها می‌شد: نه نشستی
      داشت، نه سازمانی. اندازه‌گیری پس از یک ثبت‌نام واقعی:
        email_confirmed_at = null · organizations = صفر ردیف
      کسی که برنمی‌گشت، هیچ ردی جز یک ایمیل بی‌مصرف نداشت.

      بدتر: سقف ارسال ایمیل در پلن رایگان **۲ در ساعت برای کل
      پروژه** است، پس سومین ثبت‌نامِ یک ساعت اصلاً ایمیلی نمی‌گرفت.

      حالا `mailer_autoconfirm` روشن است و این شاخه نباید رخ دهد.
      ولی اگر روزی تنظیمات عوض شد، به‌جای بن‌بست، تلاش می‌کنیم
      کاربر را همان لحظه وارد کنیم.
    */
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setInfo(
        "حساب شما ساخته شد. برای ورود، ایمیل خود را تأیید کنید یا با پشتیبانی تماس بگیرید."
      );
      setLoading(false);
      return;
    }

    router.push("/onboarding");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.png" alt={BRAND_NAME} className="w-24 h-24 object-contain mx-auto mb-2" />
          <h1 className="text-2xl font-bold text-foreground">ساخت حساب کاربری</h1>
          <p className="text-muted-foreground mt-1 text-sm">۱۴ روز استفاده‌ی رایگان، بدون نیاز به پرداخت</p>
        </div>

        <form onSubmit={handleRegister} className="card p-6 space-y-4">
          <div>
            <label className="label">ایمیل</label>
            <input
              type="email"
              required
              dir="ltr"
              className="input text-left"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(liveEmailError)}
              aria-describedby={liveEmailError ? "reg-email-err" : undefined}
            />
            {liveEmailError && (
              <p id="reg-email-err" role="alert" className="mt-1.5 text-xs font-bold text-destructive-text">
                {liveEmailError}
              </p>
            )}
          </div>

          <div>
            <label className="label">رمز عبور</label>
            <input
              type="password"
              required
              dir="ltr"
              className="input text-left"
              placeholder="حداقل ۶ کاراکتر"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="rounded-xl bg-destructive/10 text-destructive-text text-sm font-bold px-4 py-3">{error}</div>
          )}
          {info && (
            <div className="rounded-xl bg-success-soft text-success-onSoft text-sm font-bold px-4 py-3">{info}</div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading && <Loader2 className="animate-spin" size={18} />}
            ادامه
          </button>

          <p className="text-center text-sm text-muted-foreground">
            قبلاً ثبت‌نام کرده‌اید؟{" "}
            <Link href="/login" className="text-primary font-medium hover:underline">
              وارد شوید
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
