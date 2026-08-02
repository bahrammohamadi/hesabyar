import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/shared/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // اطمینان از وجود سازمان (membership)
  const { data: memberships } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("is_active", true)
    .limit(1);

  /*
    بدون سازمان → معارفه.

    قبلاً به /setup می‌رفت که فقط نام کسب‌وکار می‌گرفت. حالا
    /onboarding نوع صنف، نام مالک و شماره تماس را هم می‌گیرد و
    سازمان را با تست ۱۴ روزه‌ی فعال می‌سازد.
  */
  if (!memberships || memberships.length === 0) {
    redirect("/onboarding");
  }

  /*
    گارد تأیید کسب‌وکار (migration 0021).

    سوپرادمین از این گارد مستثناست، وگرنه اگر سازمان خودش روزی pending شود
    دیگر نمی‌تواند وارد پنل ادمین شود و کسی را تأیید کند — قفل‌شدن متقابل.

    اگر ستون approval_status هنوز روی دیتابیس نباشد (migration اجرا نشده)،
    کوئری خطا می‌دهد و ما عمداً «اجازه عبور» می‌دهیم تا اپ از کار نیفتد.
  */
  const { data: isAdmin } = await supabase.rpc("is_platform_admin");

  if (!isAdmin) {
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("approval_status, onboarded_at")
      .eq("id", memberships[0].org_id)
      .maybeSingle();

    if (!orgError && org && org.approval_status && org.approval_status !== "approved") {
      redirect("/pending-approval");
    }

    /*
      سازمان هست ولی معارفه ناتمام مانده (کاربری که پیش از افزودن
      این مرحله ثبت‌نام کرده، یا فرم را نیمه‌کاره رها کرده).

      `onboarded_at === null` تنها شرط است؛ اگر ستون هنوز روی
      دیتابیس نباشد orgError پر می‌شود و این بلوک رد می‌شود.
    */
    if (!orgError && org && org.onboarded_at === null) {
      redirect("/onboarding");
    }
  }

  return <AppShell>{children}</AppShell>;
}
