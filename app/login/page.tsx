"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("ایمیل یا رمز عبور اشتباه است.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-brand-50 to-slate-100">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/mehrjameh-logo.jpg" alt="مهرجامه" className="w-28 h-28 object-contain mx-auto mb-2" />
          <h1 className="text-2xl font-bold text-slate-800">مهرجامه</h1>
          <p className="text-slate-500 mt-1 text-sm">سیستم مدیریت فروش و مالی</p>
        </div>

        <form onSubmit={handleLogin} className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">ورود به حساب</h2>

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
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="rounded-xl bg-rose-50 text-rose-700 text-sm px-4 py-3">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading && <Loader2 className="animate-spin" size={18} />}
            ورود
          </button>

          <p className="text-center text-sm text-slate-500">
            حساب ندارید؟{" "}
            <Link href="/register" className="text-brand-600 font-medium hover:underline">
              ثبت‌نام کنید
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
