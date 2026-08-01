import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock, LogOut, ShieldAlert, ShieldX } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BRAND_NAME } from "@/lib/brand";

/**
 * صفحه‌ی «در انتظار تأیید».
 *
 * عمداً بیرون از گروه (app) و AppShell است، چون کاربرِ تأییدنشده نباید
 * سایدبار و ناوبری پنل را ببیند.
 *
 * سرور-کامپوننت است تا وضعیت واقعی از دیتابیس خوانده شود، نه از کلاینت.
 */
export default async function PendingApprovalPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  // بدون سازمان → باید اول کسب‌وکار بسازد
  if (!membership) redirect("/setup");

  const { data: org } = await supabase
    .from("organizations")
    .select("name, approval_status, rejection_note")
    .eq("id", membership.org_id)
    .maybeSingle();

  // اگر در این فاصله تأیید شده، نگهش نداریم
  if (!org || org.approval_status === "approved") redirect("/dashboard");

  const isRejected = org.approval_status === "rejected";
  const isSuspended = org.approval_status === "suspended";

  const title = isRejected
    ? "درخواست شما تأیید نشد"
    : isSuspended
      ? "دسترسی کسب‌وکار شما معلق شده است"
      : "کسب‌وکار شما در انتظار تأیید است";

  const body = isRejected
    ? "متأسفانه درخواست ثبت کسب‌وکار شما پذیرفته نشد. در صورت نیاز به بررسی مجدد با پشتیبانی تماس بگیرید."
    : isSuspended
      ? "دسترسی این کسب‌وکار موقتاً معلق شده است. برای رفع تعلیق با پشتیبانی تماس بگیرید."
      : "درخواست شما ثبت شد و در صف بررسی مدیر پلتفرم قرار دارد. پس از تأیید، به‌صورت خودکار به پنل دسترسی خواهید داشت.";

  const Icon = isRejected ? ShieldX : isSuspended ? ShieldAlert : Clock;
  const tone = isRejected || isSuspended ? "destructive" : "warning";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-[1.75rem] border border-border bg-card p-6 text-center shadow-sm sm:p-8">
        <div
          className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full ${
            tone === "destructive" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"
          }`}
        >
          <Icon size={28} strokeWidth={2} />
        </div>

        <h1 className="text-lg font-black text-foreground sm:text-xl">{title}</h1>

        <p className="mt-1.5 text-sm font-bold text-primary">{org.name}</p>

        <p className="mt-4 text-sm leading-7 text-muted-foreground">{body}</p>

        {isRejected && org.rejection_note && (
          <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/[0.06] p-3 text-right">
            <div className="text-2xs font-bold text-destructive">دلیل:</div>
            <div className="mt-0.5 text-xs leading-6 text-foreground/80">{org.rejection_note}</div>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Link
            href="/pending-approval"
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground transition hover:bg-primary/90 active:scale-95"
          >
            بررسی مجدد وضعیت
          </Link>
          <Link
            href="/login?signout=1"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-bold text-muted-foreground transition hover:text-foreground active:scale-95"
          >
            <LogOut size={15} />
            خروج
          </Link>
        </div>

        <p className="mt-5 text-2xs leading-6 text-muted-foreground">
          اگر فکر می‌کنید اشتباهی رخ داده، با پشتیبانی {BRAND_NAME} تماس بگیرید.
        </p>
      </div>
    </main>
  );
}
