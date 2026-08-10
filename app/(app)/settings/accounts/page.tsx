"use client";

import { Tag } from "lucide-react";
import { useOrg } from "@/lib/hooks/useOrg";
import { PageHeader } from "@/components/shared/ui";
import { AccountsManager } from "@/components/shared/accounts-manager";
import { ManagedList } from "@/components/shared/managed-list";

/**
 * مالی و حساب‌ها.
 *
 * «دسته‌بندی هزینه» از صفحه‌ی کاتالوگ به اینجا منتقل شد: هزینه
 * مفهومی مالی است و کنار صندوق و بانک جای درستش است، نه کنار
 * دسته‌بندی کالا.
 */
export default function AccountsSettingsPage() {
  const { orgId, branchId } = useOrg();

  return (
    <div className="space-y-4">
      <PageHeader
        title="مالی و حساب‌ها"
        subtitle="صندوق، حساب‌های بانکی و دسته‌بندی هزینه‌ها"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <AccountsManager orgId={orgId} branchId={branchId} />
        <ManagedList
          orgId={orgId}
          branchId={branchId}
          table="expense_categories"
          title="دسته‌بندی هزینه"
          description="مثل اجاره، حقوق، قبوض. هنگام ثبت هزینه انتخاب می‌شود."
          icon={<Tag size={17} aria-hidden />}
        />
      </div>
    </div>
  );
}
