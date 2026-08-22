"use client";

import { PageHeader } from "@/components/shared/ui";
import { OrgPrefsForm } from "@/components/shared/org-prefs-form";
import { OptionListsManager } from "@/components/shared/option-lists-manager";

/**
 * تنظیمات نمایش و شخصی‌سازی.
 *
 * سه چیز که به هم مرتبط‌اند و در یک صفحه جمع شده‌اند:
 *   • واحد پول نمایش
 *   • صنف کسب‌وکار و اثرش بر برچسب‌ها و پیش‌فرض‌ها
 *   • گزینه‌های کشویی (رنگ، سایز، واحد…)
 *
 * ⚠️ عمداً از «کسب‌وکار، برند و ظاهر» جداست: آنجا هویت بصری است
 * (لوگو، نام روی فاکتور) و اینجا رفتار پنل. قاطی‌کردنشان یعنی
 * صفحه‌ای که کاربر هر بار باید در آن دنبال چیزی بگردد.
 */
export default function PreferencesSettingsPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="نمایش و شخصی‌سازی"
        subtitle="واحد پول، صنف کسب‌وکار و گزینه‌های کشویی پنل"
      />
      <OrgPrefsForm />
      <OptionListsManager />
    </div>
  );
}
