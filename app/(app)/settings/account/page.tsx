"use client";

import { useQuery } from "@tanstack/react-query";
import { KeyRound, MonitorSmartphone, UserCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/shared/ui";
import { Card } from "@/src/shared/ui";
import { ChangePasswordForm } from "@/components/shared/change-password-form";
import { ActiveSessions } from "@/components/shared/active-sessions";
import { ProfileForm } from "@/components/shared/profile-form";
import { displayUsername, toJalali } from "@/lib/utils/format";

/**
 * حساب کاربری — اطلاعات شخصی و امنیت.
 *
 * 🔴 تا پیش از این هیچ صفحه‌ای برای تغییر رمز وجود نداشت. اگر کاربری
 * رمزش را لو می‌داد، تنها راه تماس با پشتیبانی و دست‌کاری دستی
 * دیتابیس بود.
 */
export default function AccountSettingsPage() {
  const { data: user, isLoading } = useQuery({
    queryKey: ["account-current-user"],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      if (!u) return null;
      return {
        email: u.email ?? "",
        name: (u.user_metadata?.name as string | undefined) ?? displayUsername(u.email) ?? "کاربر",
        createdAt: u.created_at,
        lastSignIn: u.last_sign_in_at ?? null,
      };
    },
    staleTime: 60_000,
  });

  return (
    <div className="space-y-5">
      <PageHeader title="حساب کاربری" subtitle="اطلاعات شخصی و امنیت حساب شما" />

      <Card className="p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <UserCircle size={18} className="text-primary" aria-hidden />
          <h2 className="text-sm font-extrabold text-foreground">اطلاعات حساب</h2>
        </div>
        {/*
          🔴 نام و شماره حالا قابل ویرایش‌اند.
          پیش از این فقط نمایش داده می‌شدند و کاربری که نامش را اشتباه
          وارد کرده بود باید به پشتیبانی زنگ می‌زد.
        */}
        <ProfileForm />

        <div className="mt-4 border-t border-border pt-4">
        {isLoading ? (
          <div className="h-16 animate-pulse rounded-xl bg-muted" />
        ) : (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-2xs text-muted-foreground">نام کاربری</dt>
              <dd className="mt-0.5 font-bold text-foreground" dir="ltr">
                {displayUsername(user?.email) ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-2xs text-muted-foreground">تاریخ عضویت</dt>
              <dd className="mt-0.5 text-foreground">{user?.createdAt ? toJalali(user.createdAt) : "—"}</dd>
            </div>
            <div>
              <dt className="text-2xs text-muted-foreground">آخرین ورود</dt>
              <dd className="mt-0.5 text-foreground">
                {user?.lastSignIn ? toJalali(user.lastSignIn, true) : "—"}
              </dd>
            </div>
          </dl>
        )}
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <div className="mb-1 flex items-center gap-2">
          <KeyRound size={18} className="text-primary" aria-hidden />
          <h2 className="text-sm font-extrabold text-foreground">تغییر رمز عبور</h2>
        </div>
        <p className="mb-4 text-2xs leading-relaxed text-muted-foreground">
          برای تغییر رمز، رمز فعلی خود را وارد کنید. این کار جلوی تغییر رمز توسط کسی را می‌گیرد که
          به‌طور موقت به دستگاه شما دسترسی پیدا کرده است.
        </p>
        <ChangePasswordForm />
      </Card>

      <Card className="p-4 sm:p-5">
        <div className="mb-1 flex items-center gap-2">
          <MonitorSmartphone size={18} className="text-primary" aria-hidden />
          <h2 className="text-sm font-extrabold text-foreground">دستگاه‌های واردشده</h2>
        </div>
        <p className="mb-4 text-2xs leading-relaxed text-muted-foreground">
          فهرست دستگاه‌هایی که با حساب شما وارد شده‌اند. تغییر رمز عبور به‌تنهایی این دستگاه‌ها
          را بیرون نمی‌اندازد؛ برای این کار باید نشستشان را ببندید.
        </p>
        <ActiveSessions />
      </Card>
    </div>
  );
}
