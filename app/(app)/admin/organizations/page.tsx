"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, CheckCircle2, Clock, ShieldCheck, XCircle } from "lucide-react";
import { PageHeader, Spinner, EmptyState } from "@/components/shared/ui";
import { Badge, Button, Card, Select, useConfirm, useToast } from "@/src/shared/ui";
import { displayUsername, toFaDigits, toJalali } from "@/lib/utils/format";

type AdminOrg = {
  id: string;
  name: string;
  approval_status: "pending" | "approved" | "rejected" | "suspended";
  is_demo: boolean;
  is_active: boolean;
  created_at: string;
  approved_at: string | null;
  rejection_note: string | null;
  owner_id: string;
  owner_email: string;
  members_count: number;
  sales_count: number;
  current_plan: string | null;
};

const STATUS: Record<AdminOrg["approval_status"], { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  approved: { label: "تأیید شده", tone: "success" },
  pending: { label: "در انتظار تأیید", tone: "warning" },
  rejected: { label: "رد شده", tone: "danger" },
  suspended: { label: "معلق", tone: "neutral" },
};

export default function AdminOrganizationsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [filter, setFilter] = useState<"" | AdminOrg["approval_status"]>("");
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-organizations"],
    queryFn: async () => {
      const res = await fetch("/api/admin/organizations");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "خطا در دریافت فهرست کسب‌وکارها");
      return json.organizations as AdminOrg[];
    },
  });

  async function act(org: AdminOrg, action: "approve" | "reject") {
    const isApprove = action === "approve";
    const ok = await confirm({
      title: isApprove ? `تأیید «${org.name}»؟` : `رد «${org.name}»؟`,
      description: isApprove
        ? "پس از تأیید، مالک این کسب‌وکار می‌تواند وارد پنل شود."
        : "کسب‌وکار رد می‌شود و مالک آن اجازه ورود نخواهد داشت.",
      tone: isApprove ? "default" : "danger",
      confirmLabel: isApprove ? "تأیید" : "رد کردن",
    });
    if (!ok) return;

    setBusy(org.id);
    try {
      const res = await fetch("/api/admin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: org.id, action, reason: isApprove ? undefined : "رد توسط مدیر پلتفرم" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "عملیات ناموفق بود");
      toast({ tone: "success", title: isApprove ? "کسب‌وکار تأیید شد" : "کسب‌وکار رد شد" });
      qc.invalidateQueries({ queryKey: ["admin-organizations"] });
    } catch (e) {
      toast({ tone: "error", title: "عملیات ناموفق", description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const rows = (data ?? []).filter((o) => !filter || o.approval_status === filter);
  const pendingCount = (data ?? []).filter((o) => o.approval_status === "pending").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="مدیریت کسب‌وکارها"
        subtitle="تأیید، رد و نظارت بر سازمان‌های ثبت‌شده در پلتفرم"
        action={
          <Badge tone={pendingCount > 0 ? "warning" : "success"}>
            <ShieldCheck size={13} />
            {pendingCount > 0 ? `${toFaDigits(pendingCount)} در انتظار` : "همه بررسی شده"}
          </Badge>
        }
      />

      <Card className="p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <span className="shrink-0 text-sm font-bold text-muted-foreground">فیلتر وضعیت</span>
          <Select
            className="sm:w-56"
            aria-label="فیلتر وضعیت"
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
          >
            <option value="">همه</option>
            <option value="pending">در انتظار تأیید</option>
            <option value="approved">تأیید شده</option>
            <option value="rejected">رد شده</option>
            <option value="suspended">معلق</option>
          </Select>
        </div>
      </Card>

      {isLoading ? (
        <Spinner label="در حال بارگذاری..." />
      ) : error ? (
        <div className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Building2} title="کسب‌وکاری یافت نشد" description="با این فیلتر موردی وجود ندارد." />
      ) : (
        <Card className="overflow-hidden">
          {/* دسکتاپ */}
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[900px] text-right text-sm">
              <thead className="bg-primary text-xs text-primary-foreground">
                <tr>
                  <th className="px-4 py-3.5 font-extrabold">کسب‌وکار</th>
                  <th className="px-4 py-3.5 font-extrabold">مالک</th>
                  <th className="px-4 py-3.5 text-center font-extrabold">اعضا</th>
                  <th className="px-4 py-3.5 text-center font-extrabold">فاکتور</th>
                  <th className="px-4 py-3.5 font-extrabold">پلن</th>
                  <th className="px-4 py-3.5 text-center font-extrabold">وضعیت</th>
                  <th className="px-4 py-3.5 text-center font-extrabold">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-bold text-foreground">{o.name}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Clock size={11} />
                        {toJalali(o.created_at)}
                        {o.is_demo && <Badge tone="info">دمو</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{displayUsername(o.owner_email) || "—"}</td>
                    <td className="px-4 py-3 text-center tabular-nums">{toFaDigits(o.members_count ?? 0)}</td>
                    <td className="px-4 py-3 text-center tabular-nums">{toFaDigits(o.sales_count ?? 0)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{o.current_plan ?? "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge tone={STATUS[o.approval_status].tone}>{STATUS[o.approval_status].label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        {o.approval_status !== "approved" && (
                          <Button size="sm" loading={busy === o.id} onClick={() => act(o, "approve")} icon={<CheckCircle2 size={14} />}>
                            تأیید
                          </Button>
                        )}
                        {o.approval_status !== "rejected" && (
                          <Button size="sm" variant="danger" loading={busy === o.id} onClick={() => act(o, "reject")} icon={<XCircle size={14} />}>
                            رد
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* موبایل و تبلت */}
          <ul className="divide-y divide-border lg:hidden">
            {rows.map((o) => (
              <li key={o.id} className="p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-foreground">{o.name}</div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">{displayUsername(o.owner_email) || "—"}</div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <Badge tone={STATUS[o.approval_status].tone}>{STATUS[o.approval_status].label}</Badge>
                      {o.is_demo && <Badge tone="info">دمو</Badge>}
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {toFaDigits(o.members_count ?? 0)} عضو · {toFaDigits(o.sales_count ?? 0)} فاکتور
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  {o.approval_status !== "approved" && (
                    <Button size="sm" className="flex-1" loading={busy === o.id} onClick={() => act(o, "approve")} icon={<CheckCircle2 size={14} />}>
                      تأیید
                    </Button>
                  )}
                  {o.approval_status !== "rejected" && (
                    <Button size="sm" variant="danger" className="flex-1" loading={busy === o.id} onClick={() => act(o, "reject")} icon={<XCircle size={14} />}>
                      رد
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
