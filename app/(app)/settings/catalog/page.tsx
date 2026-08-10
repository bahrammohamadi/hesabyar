"use client";

import { FolderTree, Tag } from "lucide-react";
import { useOrg } from "@/lib/hooks/useOrg";
import { PageHeader } from "@/components/shared/ui";
import { ManagedList } from "@/components/shared/managed-list";

/**
 * کاتالوگ — دسته‌بندی کالا و برند.
 *
 * 🔴 تا پیش از این، «تم رنگی نرم‌افزار» هم بالای همین صفحه بود —
 * جایی که هیچ ربطی به کاتالوگ ندارد و در /settings/general هم
 * دقیقاً تکرار شده بود. حالا فقط یک‌جا هست: تنظیمات عمومی.
 *
 * «دسته‌بندی هزینه» هم از اینجا به «مالی و حساب‌ها» منتقل شد؛
 * هزینه مفهومی مالی است نه کالایی.
 */
export default function CatalogSettingsPage() {
  const { orgId, branchId } = useOrg();

  return (
    <div className="space-y-4">
      <PageHeader
        title="کاتالوگ"
        subtitle="دسته‌بندی کالا و برندها — پایه‌ی سازمان‌دهی محصولات شما"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <ManagedList
          orgId={orgId}
          branchId={branchId}
          table="categories"
          title="دسته‌بندی کالا"
          description="مثل پیراهن، شومیز، شلوار. هنگام ثبت کالا انتخاب می‌شود."
          icon={<FolderTree size={17} aria-hidden />}
        />
        <ManagedList
          orgId={orgId}
          branchId={branchId}
          table="brands"
          title="برندها"
          description="نام تولیدکننده یا برند کالا."
          icon={<Tag size={17} aria-hidden />}
        />
      </div>
    </div>
  );
}
