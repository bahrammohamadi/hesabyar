"use client";

import Link from "next/link";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";
import { PageHeader } from "@/components/shared/ui";
import { Card } from "@/src/shared/ui";
import { BackupCard } from "@/components/shared/backup-card";

/**
 * پشتیبان و خروجی اطلاعات.
 *
 * صفحه‌ی جدا و نه یک کارت در «عمومی»: این کاری است که کاربر آگاهانه
 * سراغش می‌آید (معمولاً پیش از یک تغییر بزرگ) و باید آدرس مستقیم و
 * قابل ارجاع داشته باشد — راهنمای ورود اکسل به همین‌جا لینک می‌دهد.
 */
export default function BackupSettingsPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="پشتیبان و خروجی"
        subtitle="یک نسخه از تمام اطلاعات کسب‌وکار خود بگیرید و جای امن نگه دارید"
      />

      <BackupCard />

      <Card className="p-4 sm:p-5">
        <h2 className="mb-2 text-sm font-extrabold text-foreground">خروجی بخش‌های جداگانه</h2>
        <p className="mb-3 text-2xs leading-6 text-muted-foreground">
          اگر فقط یک بخش را می‌خواهید، هر صفحه‌ی گزارش دکمه‌ی خروجی اکسل خودش را دارد:
          گزارش فروش، سودآوری، عملکرد فروشندگان، موجودی به تاریخ و کاردکس کالا.
        </p>
        <Link
          href="/reports"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
        >
          رفتن به گزارش‌ها
          <ArrowLeft size={14} aria-hidden />
        </Link>
      </Card>

      <Card className="p-4 sm:p-5">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-extrabold text-foreground">
          <FileSpreadsheet size={16} aria-hidden />
          ورود اطلاعات
        </h2>
        <p className="mb-3 text-2xs leading-6 text-muted-foreground">
          می‌خواهید اطلاعات را از اکسل وارد کنید؟ پیش از آن حتماً از همین صفحه پشتیبان بگیرید.
        </p>
        <Link
          href="/settings/import"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
        >
          ورود اطلاعات از اکسل
          <ArrowLeft size={14} aria-hidden />
        </Link>
      </Card>
    </div>
  );
}
