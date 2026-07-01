"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fa" dir="rtl">
      <body className="bg-slate-50 text-slate-800">
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl bg-white border border-slate-200 p-6 text-center shadow-sm">
            <h1 className="text-lg font-bold text-rose-600">خطای برنامه</h1>
            <p className="text-sm text-slate-500 mt-2">یک خطای غیرمنتظره رخ داد. صفحه را دوباره بارگذاری کنید.</p>
            {error?.message && <p className="mt-3 text-xs text-slate-400 break-words">{error.message}</p>}
            <button onClick={reset} className="mt-5 rounded-xl bg-primary text-white px-4 py-2 text-sm">تلاش دوباره</button>
          </div>
        </div>
      </body>
    </html>
  );
}
