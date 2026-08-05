"use client";

import Link from "next/link";
import { BookOpen, Upload } from "lucide-react";
import { PageHeader } from "@/components/shared/ui";
import { Button } from "@/src/shared/ui";
import { DataImport } from "@/components/shared/data-import";
import type { ImportKind } from "@/lib/import/schema";

/**
 * ورود داده از اکسل — سمت کاربر.
 *
 * چرا در تنظیمات و نه در صفحه‌ی کالاها؟
 *   این کار یک‌بار (یا چندبار در سال) انجام می‌شود، نه روزانه.
 *   گذاشتنش کنار دکمه‌ی «کالای جدید» یعنی هر روز جلوی چشم باشد و
 *   احتمال کلیک اشتباه بالا برود.
 */
export default function ImportSettingsPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="ورود اطلاعات از اکسل"
        subtitle="کالاها یا مشتریان خود را از یک فایل اکسل به‌صورت دسته‌جمعی وارد کنید"
        action={
          <Link href="/settings/import/guide">
            <Button variant="secondary" icon={<BookOpen size={15} />}>
              راهنمای کامل
            </Button>
          </Link>
        }
      />

      <DataImport
        apiBase="/api/import"
        templateUrl={(kind: ImportKind) => `/api/import/template?kind=${kind}`}
      />
    </div>
  );
}
