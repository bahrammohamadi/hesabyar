"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Building2, Users, Clock, AlertTriangle, TicketCheck,
  Activity, TrendingUp, ShieldCheck,
} from "lucide-react";
import { PageHeader, Spinner } from "@/components/shared/ui";
import { Card } from "@/src/shared/ui";
import { toFaDigits } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

type Stats = Record<string, number>;

/** کاشی شاخص. tone فقط زمانی رنگی می‌شود که عدد نیاز به توجه دارد. */
function Stat({
  icon: Icon, label, value, hint, href, tone = "neutral",
}: {
  icon: React.ElementType;
  label: string;
  value: number | undefined;
  hint?: string;
  href?: string;
  tone?: "neutral" | "warning" | "danger" | "success";
}) {
  const toneCls = {
    neutral: "text-muted-foreground bg-muted",
    warning: "text-warning-onSoft bg-warning-soft",
    danger: "text-destructive-text bg-destructive/10",
    success: "text-success-onSoft bg-success-soft",
  }[tone];

  const body = (
    <Card className="h-full p-4 transition hover:border-primary/30">
      <div className="flex items-start justify-between gap-2">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", toneCls)}>
          <Icon size={17} aria-hidden />
        </div>
        <span className="text-2xl font-extrabold tabular-nums text-foreground">
          {value === undefined ? "—" : toFaDigits(value)}
        </span>
      </div>
      <p className="mt-2 text-xs font-bold text-foreground">{label}</p>
      {hint && <p className="mt-0.5 text-2xs text-muted-foreground">{hint}</p>}
    </Card>
  );

  return href ? <Link href={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-2xl">{body}</Link> : body;
}

export default function AdminDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async (): Promise<Stats> => {
      const res = await fetch("/api/admin/stats");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "خطا در دریافت آمار");
      return json.stats as Stats;
    },
  });

  const s = data ?? {};

  return (
    <div className="space-y-4">
      <PageHeader
        title="داشبورد مدیریت پلتفرم"
        subtitle="نمای کلی کسب‌وکارها، کاربران و فعالیت ادمین‌ها"
      />

      {isLoading ? (
        <Spinner label="در حال بارگذاری آمار..." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat icon={Building2} label="کل کسب‌وکارها" value={s.orgs_total} href="/admin/organizations" />
            <Stat icon={ShieldCheck} label="تأیید شده" value={s.orgs_approved} tone="success" href="/admin/organizations?status=approved" />
            <Stat icon={Clock} label="در انتظار تأیید" value={s.orgs_pending}
                  tone={s.orgs_pending > 0 ? "warning" : "neutral"} href="/admin/organizations?status=pending" />
            <Stat icon={AlertTriangle} label="معلق" value={s.orgs_suspended}
                  tone={s.orgs_suspended > 0 ? "danger" : "neutral"} href="/admin/organizations?status=suspended" />
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat icon={TrendingUp} label="تست‌های فعال" value={s.trials_active} />
            <Stat icon={Clock} label="تست رو به پایان" value={s.trials_expiring}
                  hint="کمتر از ۳ روز" tone={s.trials_expiring > 0 ? "warning" : "neutral"} />
            <Stat icon={Users} label="کل کاربران" value={s.users_total} href="/admin/users" />
            <Stat icon={Users} label="ثبت‌نام ۷ روز اخیر" value={s.signups_7d} href="/admin/users" />
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat icon={Activity} label="کاربر فعال ۷ روز" value={s.active_7d} />
            <Stat icon={TicketCheck} label="تیکت باز" value={s.tickets_open}
                  tone={s.tickets_open > 0 ? "warning" : "neutral"} />
            <Stat icon={Building2} label="کل فاکتورها" value={s.sales_total} />
            <Stat icon={ShieldCheck} label="عملیات ادمین ۷ روز" value={s.admin_actions_7d} href="/admin/audit" />
          </div>
        </>
      )}
    </div>
  );
}
