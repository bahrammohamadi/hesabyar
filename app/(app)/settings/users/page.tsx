"use client";

import { PageHeader } from "@/components/shared/ui";
import { UsersAccessManager } from "@/components/shared/users-access";

/**
 * کاربران و دسترسی‌ها.
 *
 * پیش از این فقط دو خط بود که SettingsContent را با یک prop صدا
 * می‌زد و کل منطق در فایل ۶۴۳ خطی /settings/page.tsx بود.
 */
export default function UsersSettingsPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="کاربران و دسترسی‌ها"
        subtitle="هر کاربر یک نقش دارد؛ در صورت نیاز می‌توانید دسترسی‌ها را جداگانه تنظیم کنید"
      />
      <UsersAccessManager />
    </div>
  );
}
