"use client";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="max-w-lg mx-auto py-16 text-center">
      <div className="card p-6">
        <h2 className="text-lg font-bold text-destructive">خطا در این بخش</h2>
        <p className="text-sm text-muted-foreground mt-2">برای جلوگیری از بسته شدن کامل برنامه، خطا در همین بخش متوقف شد.</p>
        {error?.message && <p className="mt-3 text-xs text-muted-foreground break-words">{error.message}</p>}
        <button onClick={reset} className="btn-primary mt-5">تلاش دوباره</button>
      </div>
    </div>
  );
}
