"use client";

import { useState } from "react";
import { useOrgPrefs } from "@/lib/hooks/useOrgPrefs";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight, Building2, CalendarClock, CheckCircle2, PauseCircle,
  PlayCircle, ShoppingCart, Users, XCircle, Package, Phone, ScrollText,
} from "lucide-react";
import { PageHeader, Spinner } from "@/components/shared/ui";
import { Badge, Button, Card, useConfirm, useToast } from "@/src/shared/ui";
import { displayUsername, formatToman, toFaDigits, toJalali } from "@/lib/utils/format";
import { businessTypeLabel } from "@/lib/business-types";

type OrgDetail = {
  id: string; name: string;
  approval_status: "pending" | "approved" | "rejected" | "suspended";
  is_demo: boolean; created_at: string; rejection_note: string | null;
  owner_id: string; owner_email: string;
  business_type: string | null; owner_full_name: string | null; owner_phone: string | null;
  trial_ends_at: string | null; trial_days_left: number | null;
  members_count: number; sales_count: number; products_count: number; contacts_count: number;
  sales_total: number; last_sale_at: string | null;
  current_plan: string | null; subscription_status: string | null;
};

type Member = { user_id: string; role: string; email: string; created_at: string; last_sign_in_at: string | null };
type AuditRow = { id: string; created_at: string; action: string; actor_email: string | null; reason: string | null };

const STATUS: Record<OrgDetail["approval_status"], { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  approved: { label: "تأیید شده", tone: "success" },
  pending: { label: "در انتظار تأیید", tone: "warning" },
  rejected: { label: "رد شده", tone: "danger" },
  suspended: { label: "معلق", tone: "neutral" },
};

const ROLE_LABEL: Record<string, string> = {
  owner: "مالک", manager: "مدیر", cashier: "صندوق‌دار",
  inventory: "انباردار", accountant: "حسابدار",
};

/** آیا نقش بیننده اجازه‌ی این عمل را دارد؟ باید با ماتریس دیتابیس یکی باشد. */
function can(role: string, permission: string): boolean {
  const M: Record<string, string[]> = {
    "orgs.approve": ["super_admin", "support"],
    "orgs.suspend": ["super_admin"],
    "trial.extend": ["super_admin", "support", "finance"],
  };
  return (M[permission] ?? []).includes(role);
}

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
        <Icon size={13} aria-hidden />
        {label}
      </div>
      <div className="mt-1 text-sm font-extrabold text-foreground tabular-nums">{value}</div>
    </div>
  );
}

export default function AdminOrgDetailPage({ params }: { params: { id: string } }) {
  /* واحد پول سازمان — تومان یا ریال، از تنظیمات. */
  const { money, unitLabel: unitWord } = useOrgPrefs();
  const qc = useQueryClient();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-org", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/organizations/${params.id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "خطا در دریافت اطلاعات");
      return json as {
        organization: OrgDetail; members: Member[]; audit: AuditRow[]; viewerRole: string;
      };
    },
  });

  async function act(action: string, opts: { title: string; description: string; danger?: boolean; days?: number }) {
    const ok = await confirm({
      title: opts.title,
      description: opts.description,
      tone: opts.danger ? "danger" : "default",
      confirmLabel: "انجام بده",
    });
    if (!ok) return;

    setBusy(action);
    try {
      const res = await fetch(`/api/admin/organizations/${params.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, days: opts.days, reason: opts.danger ? "اقدام مدیر پلتفرم" : undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "عملیات ناموفق بود");
      toast({ tone: "success", title: "انجام شد" });
      qc.invalidateQueries({ queryKey: ["admin-org", params.id] });
      qc.invalidateQueries({ queryKey: ["admin-organizations"] });
    } catch (e) {
      toast({ tone: "error", title: "عملیات ناموفق", description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  if (isLoading) return <Spinner label="در حال بارگذاری..." />;
  if (error) {
    return (
      <div className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive-text">
        {(error as Error).message}
      </div>
    );
  }
  if (!data) return null;

  const o = data.organization;
  const role = data.viewerRole;
  const st = STATUS[o.approval_status];

  return (
    <div className="space-y-4">
      <Link
        href="/admin/organizations"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground transition hover:text-primary"
      >
        <ArrowRight size={14} aria-hidden />
        بازگشت به فهرست
      </Link>

      <PageHeader
        title={o.name}
        subtitle={`ثبت‌شده در ${toJalali(o.created_at)} · ${businessTypeLabel(o.business_type)}`}
        action={<Badge tone={st.tone}>{st.label}</Badge>}
      />

      {/* آمار */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat icon={Users} label="اعضا" value={toFaDigits(o.members_count)} />
        <Stat icon={ShoppingCart} label="فاکتور" value={toFaDigits(o.sales_count)} />
        <Stat icon={Package} label="کالا" value={toFaDigits(o.products_count)} />
        <Stat icon={Users} label="مخاطب" value={toFaDigits(o.contacts_count)} />
        <Stat icon={Building2} label="جمع فروش" value={money(o.sales_total)} />
        <Stat
          icon={CalendarClock}
          label="دوره آزمایشی"
          value={o.trial_days_left === null ? "—" : `${toFaDigits(Math.max(0, o.trial_days_left))} روز`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* مالک و اشتراک */}
        <Card className="space-y-3 p-4 lg:col-span-1">
          <h2 className="text-sm font-extrabold text-foreground">مالک کسب‌وکار</h2>
          <dl className="space-y-2 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">نام</dt>
              <dd className="font-bold text-foreground">{o.owner_full_name ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">حساب</dt>
              <dd className="truncate font-bold text-foreground" dir="ltr">
                {displayUsername(o.owner_email) || "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">تماس</dt>
              <dd className="font-bold text-foreground" dir="ltr">
                {o.owner_phone ? (
                  <a href={`tel:${o.owner_phone}`} className="inline-flex items-center gap-1 text-primary">
                    <Phone size={12} aria-hidden />
                    {toFaDigits(o.owner_phone)}
                  </a>
                ) : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-2 border-t border-border pt-2">
              <dt className="text-muted-foreground">پلن</dt>
              <dd className="font-bold text-foreground">{o.current_plan ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">آخرین فروش</dt>
              <dd className="font-bold text-foreground">
                {o.last_sale_at ? toJalali(o.last_sale_at) : "—"}
              </dd>
            </div>
          </dl>
          {o.rejection_note && (
            <p className="rounded-lg bg-warning-soft p-2 text-2xs leading-5 text-warning-onSoft">
              یادداشت: {o.rejection_note}
            </p>
          )}
        </Card>

        {/* عملیات */}
        <Card className="space-y-3 p-4 lg:col-span-2">
          <h2 className="text-sm font-extrabold text-foreground">عملیات مدیریتی</h2>
          <div className="flex flex-wrap gap-2">
            {can(role, "orgs.approve") && o.approval_status !== "approved" && (
              <Button
                size="sm" loading={busy === "approve"} icon={<CheckCircle2 size={14} />}
                onClick={() => act("approve", { title: `تأیید «${o.name}»؟`, description: "مالک می‌تواند وارد پنل شود." })}
              >تأیید</Button>
            )}
            {can(role, "orgs.approve") && o.approval_status !== "rejected" && (
              <Button
                size="sm" variant="danger" loading={busy === "reject"} icon={<XCircle size={14} />}
                onClick={() => act("reject", { title: `رد «${o.name}»؟`, description: "مالک اجازه ورود نخواهد داشت.", danger: true })}
              >رد</Button>
            )}
            {can(role, "orgs.suspend") && o.approval_status === "approved" && (
              <Button
                size="sm" variant="danger" loading={busy === "suspend"} icon={<PauseCircle size={14} />}
                onClick={() => act("suspend", { title: `تعلیق «${o.name}»؟`, description: "دسترسی موقتاً قطع می‌شود و بعداً قابل بازگرداندن است.", danger: true })}
              >تعلیق</Button>
            )}
            {can(role, "orgs.suspend") && o.approval_status === "suspended" && (
              <Button
                size="sm" loading={busy === "reactivate"} icon={<PlayCircle size={14} />}
                onClick={() => act("reactivate", { title: `رفع تعلیق «${o.name}»؟`, description: "دسترسی دوباره برقرار می‌شود." })}
              >رفع تعلیق</Button>
            )}
            {can(role, "trial.extend") && (
              <>
                {[7, 14, 30].map((d) => (
                  <Button
                    key={d} size="sm" variant="secondary" loading={busy === "extend_trial"}
                    icon={<CalendarClock size={14} />}
                    onClick={() => act("extend_trial", {
                      title: `تمدید ${toFaDigits(d)} روزه؟`,
                      description: `دوره آزمایشی «${o.name}» ${toFaDigits(d)} روز تمدید می‌شود.`,
                      days: d,
                    })}
                  >+{toFaDigits(d)} روز</Button>
                ))}
              </>
            )}
          </div>
          {!can(role, "orgs.suspend") && (
            <p className="text-2xs text-muted-foreground">
              برخی عملیات با سطح دسترسی شما در دسترس نیست.
            </p>
          )}

          {/* اعضا */}
          <div className="border-t border-border pt-3">
            <h3 className="mb-2 text-xs font-extrabold text-foreground">
              اعضا ({toFaDigits(data.members.length)})
            </h3>
            <ul className="space-y-1.5">
              {data.members.map((m) => (
                <li key={m.user_id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-foreground" dir="ltr">{displayUsername(m.email)}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge tone="neutral">{ROLE_LABEL[m.role] ?? m.role}</Badge>
                    <span className="text-2xs text-muted-foreground">
                      {m.last_sign_in_at ? toJalali(m.last_sign_in_at) : "بدون ورود"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      {/* تاریخچه */}
      <Card className="p-4">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-extrabold text-foreground">
          <ScrollText size={15} className="text-primary" aria-hidden />
          تاریخچه‌ی عملیات این کسب‌وکار
        </h2>
        {data.audit.length === 0 ? (
          <p className="text-xs text-muted-foreground">هنوز عملیاتی روی این کسب‌وکار ثبت نشده است.</p>
        ) : (
          <ul className="space-y-2">
            {data.audit.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 text-xs last:border-0">
                <span className="font-bold text-foreground">{a.action}</span>
                <span className="text-2xs text-muted-foreground">
                  {a.actor_email} · {toJalali(a.created_at, true)}
                  {a.reason && ` · ${a.reason}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
