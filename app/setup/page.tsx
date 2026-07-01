"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

export default function SetupPage() {
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!orgName.trim()) return;
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("bootstrap_org", { p_org_name: orgName.trim() });
    if (error) {
      setError("خطا در ساخت کسب‌وکار: " + error.message);
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-slate-50 via-white to-slate-100">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="حسابیار" className="w-24 h-24 object-contain mx-auto mb-2" />
          <h1 className="text-2xl font-bold text-slate-800">راه‌اندازی کسب‌وکار</h1>
          <p className="text-slate-500 mt-1 text-sm">برای شروع، نام کسب‌وکار خود را وارد کنید</p>
        </div>

        <form onSubmit={handleSetup} className="card p-6 space-y-4">
          <div>
            <label className="label">نام کسب‌وکار</label>
            <input
              autoFocus
              className="input"
              placeholder="مثلاً: مزون پوشاک ..."
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
            />
          </div>
          {error && (
            <div className="rounded-xl bg-rose-50 text-rose-700 text-sm px-4 py-3">{error}</div>
          )}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading && <Loader2 className="animate-spin" size={18} />}
            شروع کنیم
          </button>
        </form>
      </div>
    </div>
  );
}
