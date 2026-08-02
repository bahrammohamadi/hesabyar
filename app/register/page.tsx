"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";
import { BRAND_NAME } from "@/lib/brand";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

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
      setError("خطا در ثبت‌نام: " + signUpError.message);
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
    } else {
      // تأیید ایمیل روشن است؛ تا کلیک روی لینک، نشستی وجود ندارد.
      setInfo(
        "ثبت‌نام انجام شد. لینک تأیید به ایمیل شما ارسال شد. پس از تأیید، وارد شوید تا پنل شما فعال شود."
      );
      setLoading(false);
    }
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
            />
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
