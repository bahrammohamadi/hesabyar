"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Activity, BarChart3, Building2, Search } from "lucide-react";
import { PageHeader, Spinner, EmptyState } from "@/components/shared/ui";
import { Badge, Card } from "@/src/shared/ui";
import { businessTypeLabel } from "@/lib/business-types";
import { formatToman, toFaDigits, toJalali } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/**
 * آمار مصرف کسب‌وکارها.
 *
 * هدف اصلی: تشخیص کسب‌وکار فعال از رهاشده. سازمانی که ۳۰ روز است
 * فاکتوری نزده احتمالاً دارد از دست می‌رود — و این را باید *پیش از*
 * پایان اشتراک فهمید، نه بعدش.
 */

type OrgUsage = {
  orgId: string;
  orgName: string;
  approvalStatus: string | null;
  businessType: string | null;
  ownerName: string | null;
  createdAt: string;
  users: number;
  products: number;
  variants: number;
  contacts: number;
  sales: number;
  purchases: number;
  transactions: number;
  movements: number;
  sales30d: number;
  revenue30d: number;
  lastActivityAt: string | null;
  lastLoginAt: string | null;
  daysIdle: number | null;
  health: "active" | "quiet" | "idle" | "new" | "empty";
};

const HEALTH: Record<
  OrgUsage["health"],
  { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral"; hint: string }
> = {
  active: { label: "فعال", tone: "success", hint: "در ۳۰ روز اخیر فروش داشته" },
  new:    { label: "تازه", tone: "info",    hint: "کمتر از یک هفته از ثبت‌نام گذشته" },
  quiet:  { label: "کم‌تحرک", tone: "warning", hint: "فعالیت دارد ولی در ۳۰ روز اخیر فروشی ثبت نکرده" },
  idle:   { label: "رهاشده", tone: "danger", hint: "بیش از ۳۰ روز است هیچ عملیاتی انجام نداده" },
  empty:  { label: "شروع نکرده", tone: "neutral", hint: "از ثبت‌نام تاکنون هیچ داده‌ای وارد نکرده" },
};

export default function AdminUsagePage() {
  const [term, setTerm] = useState("");
  const [filter, setFilter] = useState<"all" | OrgUsage["health"]>("all");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-usage"],
    queryFn: async (): Promise<OrgUsage[]> => {
      const res = await fetch("/api/admin/usage");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا در دریافت آمار");
      return json.orgs as OrgUsage[];
    },
  });

  const orgs = data ?? [];

  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase();
    return orgs.filter((o) => {
      if (filter !== "all" && o.health !== filter) return false;
      if (!t) return true;
      return `${o.orgName} ${o.ownerName ?? ""}`.toLowerCase().includes(t);
    });
  }, [orgs, term, filter]);

  /* جمع کل — یک نگاه به وضعیت پلتفرم. */
  const totals = useMemo(
    () =>
      orgs.reduce(
        (acc, o) => ({
          orgs: acc.orgs + 1,
          users: acc.users + o.users,
          products: acc.products + o.products,
          sales: acc.sales + o.sales,
          revenue30d: acc.revenue30d + o.revenue30d,
          active: acc.active + (o.health === "active" ? 1 : 0),
        }),
        { orgs: 0, users: 0, products: 0, sales: 0, revenue30d: 0, active: 0 }
      ),
    [orgs]
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const o of orgs) c[o.health] = (c[o.health] ?? 0) + 1;
    return c;
  }, [orgs]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="آمار مصرف کسب‌وکارها"
        subtitle="حجم داده، فعالیت اخیر و تشخیص کسب‌وکارهای رهاشده"
      />

      {isLoading ? (
        <Spinner />
      ) : error ? (
        <div className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive-text">
          {(error as Error).message}
        </div>
      ) : (
        <>
          {/* خلاصه‌ی پلتفرم */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            <SummaryTile label="کسب‌وکار" value={toFaDigits(totals.orgs)} />
            <SummaryTile label="فعال (۳۰ روز)" value={toFaDigits(totals.active)} tone="success" />
            <SummaryTile label="کاربر" value={toFaDigits(totals.users)} />
            <SummaryTile label="کالا" value={toFaDigits(totals.products)} />
            <SummaryTile label="فاکتور" value={toFaDigits(totals.sales)} />
            <SummaryTile label="فروش ۳۰ روز" value={formatToman(totals.revenue30d, false)} />
          </div>

          {/* فیلترها */}
          <Card className="p-3 sm:p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <Search
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  size={16}
                  aria-hidden
                />
                <input
                  className="input pr-9"
                  placeholder="جستجوی نام کسب‌وکار یا مالک…"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  aria-label="جستجوی کسب‌وکار"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
                  همه ({toFaDigits(orgs.length)})
                </FilterChip>
                {(Object.keys(HEALTH) as OrgUsage["health"][]).map((k) =>
                  counts[k] ? (
                    <FilterChip key={k} active={filter === k} onClick={() => setFilter(k)}>
                      {HEALTH[k].label} ({toFaDigits(counts[k])})
                    </FilterChip>
                  ) : null
                )}
              </div>
            </div>
          </Card>

          {filtered.length === 0 ? (
            <EmptyState icon={Building2} title="کسب‌وکاری با این فیلتر پیدا نشد" />
          ) : (
            <div className="space-y-2.5">
              {filtered.map((o) => (
                <OrgCard key={o.orgId} org={o} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="text-2xs text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-0.5 truncate text-lg font-black tabular-nums",
          tone === "success" ? "text-success-onSoft" : "text-foreground"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "min-h-9 rounded-xl px-2.5 text-2xs font-bold transition",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
      )}
    >
      {children}
    </button>
  );
}

function OrgCard({ org }: { org: OrgUsage }) {
  const h = HEALTH[org.health];
  return (
    <Card className="p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/admin/organizations/${org.orgId}`}
              className="truncate text-sm font-bold text-primary hover:underline"
            >
              {org.orgName}
            </Link>
            <Badge tone={h.tone}>{h.label}</Badge>
            {org.businessType && (
              <span className="text-2xs text-muted-foreground">
                {businessTypeLabel(org.businessType)}
              </span>
            )}
          </div>

          <div className="mt-1 text-2xs text-muted-foreground">
            {h.hint}
            {org.daysIdle !== null && org.daysIdle > 0 && ` · ${toFaDigits(org.daysIdle)} روز بی‌فعالیتی`}
          </div>

          {/* شمارنده‌ها */}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-2xs">
            <Metric label="کاربر" value={org.users} />
            <Metric label="کالا" value={org.products} />
            <Metric label="تنوع" value={org.variants} />
            <Metric label="مخاطب" value={org.contacts} />
            <Metric label="فروش" value={org.sales} highlight={org.sales30d > 0} suffix={org.sales30d > 0 ? ` (${toFaDigits(org.sales30d)} اخیر)` : ""} />
            <Metric label="خرید" value={org.purchases} />
            <Metric label="تراکنش" value={org.transactions} />
            <Metric label="گردش انبار" value={org.movements} />
          </div>
        </div>

        <div className="shrink-0 text-left">
          {org.revenue30d > 0 && (
            <div className="text-sm font-black tabular-nums text-foreground">
              {formatToman(org.revenue30d, false)}
              <span className="mr-1 text-2xs font-normal text-muted-foreground">۳۰ روز</span>
            </div>
          )}
          <div className="mt-0.5 text-[10px] text-muted-foreground">
            {org.lastLoginAt ? `آخرین ورود: ${toJalali(org.lastLoginAt)}` : "هرگز وارد نشده"}
          </div>
        </div>
      </div>
    </Card>
  );
}

function Metric({
  label,
  value,
  highlight,
  suffix,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  suffix?: string;
}) {
  return (
    <span className="text-muted-foreground">
      {label}:{" "}
      <span className={cn("font-bold tabular-nums", highlight ? "text-success-onSoft" : "text-foreground")}>
        {toFaDigits(value)}
        {suffix}
      </span>
    </span>
  );
}
