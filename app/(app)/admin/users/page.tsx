"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, UserCog, ShieldAlert, Mail, Phone, Building2 } from "lucide-react";
import { PageHeader, Spinner, EmptyState } from "@/components/shared/ui";
import { Badge, Button, Card, Select, useToast } from "@/src/shared/ui";
import { businessTypeLabel } from "@/lib/business-types";
import { displayUsername, toFaDigits, toJalali } from "@/lib/utils/format";

type AdminUser = {
  user_id: string;
  email: string;
  joined_at: string;
  last_sign_in_at: string | null;
  email_verified: boolean;
  org_id: string | null;
  org_name: string | null;
  approval_status: string | null;
  owner_full_name: string | null;
  owner_phone: string | null;
  business_type: string | null;
  trial_ends_at: string | null;
  member_role: string | null;
  platform_role: string | null;
};

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  approved: "success", pending: "warning", rejected: "danger", suspended: "neutral",
};
const STATUS_LABEL: Record<string, string> = {
  approved: "تأیید شده", pending: "در انتظار", rejected: "رد شده", suspended: "معلق",
};

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [term, setTerm] = useState("");
  const [applied, setApplied] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-users", applied, status],
    queryFn: async (): Promise<AdminUser[]> => {
      const p = new URLSearchParams();
      if (applied) p.set("q", applied);
      if (status) p.set("status", status);
      const res = await fetch(`/api/admin/users/search?${p}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "خطا در جستجو");
      return json.users as AdminUser[];
    },
  });

  /** ورود به‌جای کاربر — دلیل اجباری است. */
  async function impersonate(u: AdminUser) {
    const reason = window.prompt(
      `دلیل ورود به حساب «${displayUsername(u.email)}» را بنویسید (در گزارش ثبت می‌شود):`
    );
    if (reason === null) return;
    if (reason.trim().length < 5) {
      toast({ tone: "error", title: "دلیل باید حداقل ۵ نویسه باشد" });
      return;
    }

    setBusy(u.user_id);
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: u.user_id, reason: reason.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "عملیات ناموفق بود");
      toast({ tone: "success", title: "جلسه آغاز شد", description: "حداکثر ۳۰ دقیقه اعتبار دارد." });
      qc.invalidateQueries({ queryKey: ["impersonation-session"] });
    } catch (e) {
      toast({ tone: "error", title: "ورود ناموفق", description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const rows = data ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="کاربران پلتفرم"
        subtitle="جستجو بر اساس ایمیل، نام، شماره تماس یا نام کسب‌وکار"
      />

      <Card className="p-3 sm:p-4">
        <form
          onSubmit={(e) => { e.preventDefault(); setApplied(term.trim()); }}
          className="flex flex-col gap-2 sm:flex-row"
        >
          <div className="relative flex-1">
            <Search size={17} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="ایمیل، نام، شماره تماس یا نام کسب‌وکار…"
              aria-label="عبارت جستجو"
              className="min-h-11 w-full rounded-xl border border-border bg-card pr-10 pl-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <Select
            className="sm:w-44"
            aria-label="فیلتر وضعیت"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">همه‌ی وضعیت‌ها</option>
            <option value="approved">تأیید شده</option>
            <option value="pending">در انتظار تأیید</option>
            <option value="suspended">معلق</option>
            <option value="rejected">رد شده</option>
          </Select>
          <Button type="submit" className="shrink-0">جستجو</Button>
        </form>
      </Card>

      {isLoading ? (
        <Spinner label="در حال جستجو..." />
      ) : error ? (
        <div className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive-text">
          {(error as Error).message}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={UserCog} title="کاربری یافت نشد" description="عبارت دیگری را امتحان کنید." />
      ) : (
        <Card className="overflow-hidden">
          <p className="border-b border-border px-4 py-2 text-2xs text-muted-foreground">
            {toFaDigits(rows.length)} کاربر
          </p>
          <ul className="divide-y divide-border">
            {rows.map((u) => (
              <li key={u.user_id} className="p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-bold text-foreground">
                        {u.owner_full_name || displayUsername(u.email)}
                      </span>
                      {u.platform_role && <Badge tone="info">ادمین: {u.platform_role}</Badge>}
                      {!u.email_verified && <Badge tone="warning">ایمیل تأیید نشده</Badge>}
                      {u.approval_status && (
                        <Badge tone={STATUS_TONE[u.approval_status] ?? "neutral"}>
                          {STATUS_LABEL[u.approval_status] ?? u.approval_status}
                        </Badge>
                      )}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1" dir="ltr">
                        <Mail size={11} aria-hidden />{u.email}
                      </span>
                      {u.owner_phone && (
                        <span className="inline-flex items-center gap-1" dir="ltr">
                          <Phone size={11} aria-hidden />{u.owner_phone}
                        </span>
                      )}
                      {u.org_name && (
                        <span className="inline-flex items-center gap-1">
                          <Building2 size={11} aria-hidden />{u.org_name}
                          {u.business_type && ` · ${businessTypeLabel(u.business_type)}`}
                        </span>
                      )}
                    </div>

                    <div className="mt-1 text-2xs text-muted-foreground">
                      عضویت: {toJalali(u.joined_at)}
                      {u.last_sign_in_at && ` · آخرین ورود: ${toJalali(u.last_sign_in_at)}`}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {u.org_id && (
                      <Link
                        href={`/admin/organizations/${u.org_id}`}
                        className="inline-flex min-h-9 items-center rounded-xl border border-border bg-card px-3 text-2xs font-bold text-foreground transition hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      >
                        کسب‌وکار
                      </Link>
                    )}
                    {!u.platform_role && (
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={busy === u.user_id}
                        onClick={() => impersonate(u)}
                        icon={<ShieldAlert size={13} />}
                      >
                        ورود به حساب
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
