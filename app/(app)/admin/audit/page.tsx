"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollText, ShieldCheck, Filter } from "lucide-react";
import { PageHeader, Spinner, EmptyState } from "@/components/shared/ui";
import { Badge, Card, Select } from "@/src/shared/ui";
import { toFaDigits, toJalali } from "@/lib/utils/format";

type AuditEvent = {
  id: string;
  created_at: string;
  action: string;
  actor_email: string | null;
  actor_role: string | null;
  target_type: string | null;
  target_id: string | null;
  target_name: string | null;
  reason: string | null;
  meta: Record<string, unknown>;
  ip: string | null;
};

/** برچسب و لحن فارسی هر عمل. */
const ACTION_LABEL: Record<string, { label: string; tone: "success" | "warning" | "danger" | "neutral" | "info" }> = {
  "org.approve": { label: "تأیید کسب‌وکار", tone: "success" },
  "org.reject": { label: "رد کسب‌وکار", tone: "danger" },
  "org.suspend": { label: "تعلیق کسب‌وکار", tone: "danger" },
  "org.reactivate": { label: "رفع تعلیق", tone: "success" },
  "trial.extend": { label: "تمدید دوره آزمایشی", tone: "info" },
};

const ROLE_LABEL: Record<string, string> = {
  super_admin: "سوپرادمین",
  support: "پشتیبانی",
  finance: "مالی",
  readonly: "فقط مشاهده",
};

function describe(e: AuditEvent): string {
  const m = e.meta ?? {};
  if (e.action === "trial.extend" && m.days) {
    return `${toFaDigits(String(m.days))} روز تمدید شد`;
  }
  if (m.from && m.to) return `از «${m.from}» به «${m.to}»`;
  return "";
}

export default function AdminAuditPage() {
  const [action, setAction] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-audit", action],
    queryFn: async () => {
      const url = action ? `/api/admin/audit?action=${encodeURIComponent(action)}` : "/api/admin/audit";
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "خطا در دریافت گزارش");
      return json.events as AuditEvent[];
    },
  });

  const rows = data ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="گزارش فعالیت مدیران"
        subtitle="هر عملیات سطح پلتفرم با نام انجام‌دهنده، زمان و دلیل ثبت می‌شود. این گزارش فقط‌خواندنی است."
        action={
          <Badge tone="info">
            <ShieldCheck size={13} />
            {toFaDigits(rows.length)} رویداد
          </Badge>
        }
      />

      <Card className="p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <span className="flex shrink-0 items-center gap-1.5 text-sm font-bold text-muted-foreground">
            <Filter size={14} aria-hidden />
            نوع عملیات
          </span>
          <Select
            className="sm:w-64"
            aria-label="فیلتر نوع عملیات"
            value={action}
            onChange={(e) => setAction(e.target.value)}
          >
            <option value="">همه</option>
            {Object.entries(ACTION_LABEL).map(([key, v]) => (
              <option key={key} value={key}>{v.label}</option>
            ))}
          </Select>
        </div>
      </Card>

      {isLoading ? (
        <Spinner label="در حال بارگذاری..." />
      ) : error ? (
        <div className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive-text">
          {(error as Error).message}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="رویدادی ثبت نشده"
          description="پس از اولین عملیات مدیریتی، اینجا نمایش داده می‌شود."
        />
      ) : (
        <Card className="overflow-hidden">
          {/* دسکتاپ */}
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[860px] text-right text-sm">
              <thead className="bg-primary text-xs text-primary-foreground">
                <tr>
                  <th className="px-4 py-3.5 font-extrabold">زمان</th>
                  <th className="px-4 py-3.5 font-extrabold">عملیات</th>
                  <th className="px-4 py-3.5 font-extrabold">هدف</th>
                  <th className="px-4 py-3.5 font-extrabold">انجام‌دهنده</th>
                  <th className="px-4 py-3.5 font-extrabold">جزئیات</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => {
                  const a = ACTION_LABEL[e.action] ?? { label: e.action, tone: "neutral" as const };
                  return (
                    <tr key={e.id} className="border-b border-border last:border-0">
                      <td className="whitespace-nowrap px-4 py-3 text-2xs text-muted-foreground tabular-nums">
                        {toJalali(e.created_at, true)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={a.tone}>{a.label}</Badge>
                      </td>
                      <td className="px-4 py-3 font-bold text-foreground">{e.target_name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-foreground">{e.actor_email ?? "—"}</div>
                        {e.actor_role && (
                          <div className="text-2xs text-muted-foreground">
                            {ROLE_LABEL[e.actor_role] ?? e.actor_role}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {describe(e)}
                        {e.reason && <div className="mt-0.5">دلیل: {e.reason}</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* موبایل و تبلت */}
          <ul className="divide-y divide-border lg:hidden">
            {rows.map((e) => {
              const a = ACTION_LABEL[e.action] ?? { label: e.action, tone: "neutral" as const };
              return (
                <li key={e.id} className="p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <Badge tone={a.tone}>{a.label}</Badge>
                    <span className="shrink-0 text-2xs text-muted-foreground tabular-nums">
                      {toJalali(e.created_at, true)}
                    </span>
                  </div>
                  <div className="mt-1.5 text-sm font-bold text-foreground">{e.target_name ?? "—"}</div>
                  <div className="mt-0.5 text-2xs text-muted-foreground">
                    {e.actor_email} · {ROLE_LABEL[e.actor_role ?? ""] ?? e.actor_role}
                  </div>
                  {(describe(e) || e.reason) && (
                    <div className="mt-1 text-2xs text-muted-foreground">
                      {describe(e)}
                      {e.reason && ` · دلیل: ${e.reason}`}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
