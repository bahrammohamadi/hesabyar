"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Building2 } from "lucide-react";
import { PageHeader, Spinner } from "@/components/shared/ui";
import { Card, Select } from "@/src/shared/ui";
import { DataImport } from "@/components/shared/data-import";
import type { ImportKind } from "@/lib/import/schema";

/**
 * ورود داده به‌جای مشتری — پنل مدیریت.
 *
 * کسب‌وکار *باید* صریح انتخاب شود؛ هیچ پیش‌فرضی وجود ندارد.
 * انتخاب خودکارِ اولین سازمان یعنی یک کلیک اشتباه، داده را در حساب
 * کسب‌وکار دیگری بنویسد — و برخلاف خواندن، این کار قابل «ندیدن»
 * نیست.
 */
export default function AdminImportPage() {
  const [orgId, setOrgId] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-orgs-for-import"],
    queryFn: async () => {
      const res = await fetch("/api/admin/organizations");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا در دریافت فهرست کسب‌وکارها");
      return json.organizations as { id: string; name: string; approval_status: string }[];
    },
  });

  const orgs = data ?? [];
  const selected = orgs.find((o) => o.id === orgId);

  return (
    <div className="space-y-4">
      <PageHeader
        title="ورود داده برای کسب‌وکار"
        subtitle="بارگذاری فایل اکسل کالا یا مشتری در حساب یک کسب‌وکار، با ثبت دلیل در گزارش ممیزی"
      />

      <Card className="border-warning/30 bg-warning-soft/40 p-4">
        <div className="flex gap-3">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning-onSoft" aria-hidden />
          <p className="text-xs leading-6 text-foreground">
            این کار مستقیماً در دیتابیس مشتری می‌نویسد. حتماً اول «بررسی فایل» را بزنید و
            گزارش را با خودِ مشتری تأیید کنید. هر ورود در گزارش ممیزی با نام شما ثبت می‌شود.
          </p>
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <label className="block space-y-1.5">
          <span className="flex items-center gap-1.5 text-sm font-bold text-foreground">
            <Building2 size={15} aria-hidden />
            کسب‌وکار مقصد <span className="text-destructive">*</span>
          </span>
          {isLoading ? (
            <Spinner />
          ) : error ? (
            <span className="block rounded-xl bg-destructive/10 p-3 text-xs text-destructive-text">
              {(error as Error).message}
            </span>
          ) : (
            <Select value={orgId} onChange={(e) => setOrgId(e.target.value)}>
              <option value="">— انتخاب کنید —</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                  {o.approval_status !== "approved" ? ` (${o.approval_status})` : ""}
                </option>
              ))}
            </Select>
          )}
          <span className="block text-2xs text-muted-foreground">
            داده در حساب همین کسب‌وکار نوشته می‌شود. پیش از ادامه، نام را دوباره بخوانید.
          </span>
        </label>
      </Card>

      {orgId ? (
        <>
          <p className="rounded-xl bg-muted p-3 text-xs font-bold text-foreground">
            مقصد: {selected?.name}
          </p>
          {/*
            key باعث می‌شود با عوض‌شدن سازمان، فایل انتخاب‌شده و
            پیش‌نمایش پاک شوند. بدون آن، ادمین می‌توانست فایل را برای
            سازمان الف بررسی کند، سازمان را به ب عوض کند و همان
            پیش‌نمایش را «ثبت نهایی» بزند.
          */}
          <DataImport
            key={orgId}
            apiBase="/api/admin/import"
            orgId={orgId}
            requireReason
            canRollback={false}
            templateUrl={(kind: ImportKind) =>
              `/api/admin/import?template=1&org_id=${orgId}&kind=${kind}`
            }
          />
        </>
      ) : (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">
            برای ادامه، ابتدا کسب‌وکار مقصد را انتخاب کنید.
          </p>
        </Card>
      )}
    </div>
  );
}
