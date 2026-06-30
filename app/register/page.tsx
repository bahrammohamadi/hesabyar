"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
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

    // اگر نشست بلافاصله ساخته شد (تأیید ایمیل خاموش است) → سازمان را بساز
    if (data.session) {
      const { error: rpcError } = await supabase.rpc("bootstrap_org", {
        p_org_name: orgName,
      });
      if (rpcError) {
        setError("خطا در ساخت کسب‌وکار: " + rpcError.message);
        setLoading(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } else {
      // تأیید ایمیل لازم است
      setInfo(
        "ثبت‌نام انجام شد. لطفاً ایمیل خود را برای تأیید بررسی کنید، سپس وارد شوید."
      );
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-brand-50 to-slate-100">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="حسابیار" className="w-24 h-24 object-contain mx-auto mb-2" />
          <h1 className="text-2xl font-bold text-slate-800">ساخت کسب‌وکار جدید</h1>
          <p className="text-slate-500 mt-1 text-sm">سیستم را برای کسب‌وکار خود راه‌اندازی کنید</p>
        </div>

        <form onSubmit={handleRegister} className="card p-6 space-y-4">
          <div>
            <label className="label">نام کسب‌وکار</label>
            <input
              type="text"
              required
              className="input"
              placeholder="مثلاً: مزون پوشاک ..."
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
            />
          </div>

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
            <div className="rounded-xl bg-rose-50 text-rose-700 text-sm px-4 py-3">{error}</div>
          )}
          {info && (
            <div className="rounded-xl bg-emerald-50 text-emerald-700 text-sm px-4 py-3">{info}</div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading && <Loader2 className="animate-spin" size={18} />}
            ساخت کسب‌وکار
          </button>

          <p className="text-center text-sm text-slate-500">
            قبلاً ثبت‌نام کرده‌اید؟{" "}
            <Link href="/login" className="text-brand-600 font-medium hover:underline">
              وارد شوید
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
