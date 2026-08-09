"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity, AlertOctagon, Bug, Database, GitCommitHorizontal, HardDrive,
  RefreshCw, Search, Server, Trash2, Users,
} from "lucide-react";
import { PageHeader, Spinner, EmptyState } from "@/components/shared/ui";
import {
  Badge, Button, Card, Field, Input, Section, useConfirm, useToast,
} from "@/src/shared/ui";
import { toFaDigits, toJalali } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/**
 * وضعیت فنی سرویس و خطاهای زنده.
 *
 * قاعده‌ی حاکم بر این صفحه: هر عددی که نشان می‌دهد باید یک
 * *اندازه‌گیری واقعی* باشد. صفحه‌ی وضعیتی که همیشه سبز است یا اعداد
 * تقریبی نشان می‌دهد، بدتر از نداشتنش است — چون موقع خرابی هم به آن
 * نگاه می‌کنیم و خیالمان راحت می‌شود.
 */

type Health = {
  db: {
    version: string; size_bytes: number; size_pretty: string; quota_bytes: number;
    connections: number; active_queries: number; longest_query_sec: number;
  };
  tables: Record<string, number>;
  errors: {
    last_1h: number; last_24h: number; last_7d: number;
    total: number; newest_at: string | null;
  };
  auth: {
    unconfirmed: number; active_24h: number; never_signed_in: number;
    accounts_failing_1h: number; accounts_locked: number;
  };
  activity: {
    last_sale_at: string | null; sales_24h: number; open_tickets: number;
    oldest_unanswered_hours: number; trials_expiring_3d: number;
  };
  measured_at: string;
};

type ErrorRow = {
  id: string; ref: string; context: string; message: string | null;
  detail: Record<string, unknown> | null;
  path: string | null; method: string | null; status: number | null;
  created_at: string;
};

const TABLE_LABEL: Record<string, string> = {
  organizations: "کسب‌وکارها",
  users: "کاربران",
  sales: "فاکتور فروش",
  products: "کالاها",
  contacts: "اشخاص",
  stock_movements: "حرکات انبار",
  transactions: "تراکنش مالی",
  audit_logs: "رویداد ممیزی",
};

export default function AdminSystemPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["admin-system", search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      const res = await fetch(`/api/admin/system?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا در دریافت وضعیت سرویس");
      return json as {
        health: Health;
        errors: ErrorRow[];
        canSeeErrors: boolean;
        build: { version: string; sha: string; builtAt: string };
      };
    },
    // وضعیت سرویس باید تازه بماند، ولی نه آن‌قدر که خودش بار بسازد.
    refetchInterval: 60_000,
  });

  const prune = useMutation({
    mutationFn: async (days: number) => {
      const res = await fetch("/api/admin/system", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا در پاک‌سازی");
      return json as { removed: number; days: number };
    },
    onSuccess: (json) => {
      toast({
        title: `${toFaDigits(json.removed)} خطای قدیمی پاک شد`,
        tone: "success",
      });
      qc.invalidateQueries({ queryKey: ["admin-system"] });
    },
    onError: (e) => toast({ title: (e as Error).message, tone: "error" }),
  });

  if (isLoading) return <Spinner label="در حال اندازه‌گیری وضعیت سرویس..." />;

  if (error) {
    return (
      <div className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive-text">
        {(error as Error).message}
      </div>
    );
  }

  const h = data!.health;
  const dbPercent = Math.min(100, Math.round((h.db.size_bytes / h.db.quota_bytes) * 100));
  const errors = data!.errors;

  return (
    <div className="space-y-4">
      <PageHeader
        title="وضعیت فنی سرویس"
        subtitle="اندازه‌گیری زنده‌ی دیتابیس، احراز هویت و خطاهای سرور"
        action={
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={14} className={cn(isFetching && "animate-spin")} />}
            onClick={() => refetch()}
          >
            به‌روزرسانی
          </Button>
        }
      />

      {/* ── نوار سلامت کلی ── */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
            <HardDrive size={14} aria-hidden />
            فضای دیتابیس
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold tabular-nums text-foreground">
              {toFaDigits(h.db.size_pretty.replace(/[^\d]/g, ""))}
            </span>
            <span className="text-xs text-muted-foreground">
              مگابایت از {toFaDigits(Math.round(h.db.quota_bytes / 1024 / 1024))}
            </span>
          </div>
          {/*
            نوار پیشرفت با رنگ آستانه‌ای. هشدار از ۷۵٪ شروع می‌شود نه
            ۹۰٪: در پلن رایگان وقتی به سقف بخوریم نوشتن متوقف می‌شود و
            آن لحظه دیگر برای واکنش دیر است.
          */}
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                dbPercent >= 90 ? "bg-destructive" : dbPercent >= 75 ? "bg-warning" : "bg-success"
              )}
              style={{ width: `${Math.max(dbPercent, 2)}%` }}
            />
          </div>
          <p className="mt-1.5 text-2xs text-muted-foreground">
            {toFaDigits(dbPercent)}٪ مصرف‌شده · پلن رایگان Supabase
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
            <AlertOctagon size={14} aria-hidden />
            خطاهای سرور
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={cn(
                "text-2xl font-extrabold tabular-nums",
                h.errors.last_1h > 0 ? "text-destructive-text" : "text-foreground"
              )}
            >
              {toFaDigits(h.errors.last_1h)}
            </span>
            <span className="text-xs text-muted-foreground">در یک ساعت اخیر</span>
          </div>
          <p className="mt-2 text-2xs text-muted-foreground">
            ۲۴ ساعت: {toFaDigits(h.errors.last_24h)} · ۷ روز: {toFaDigits(h.errors.last_7d)} ·
            کل: {toFaDigits(h.errors.total)}
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
            <GitCommitHorizontal size={14} aria-hidden />
            نسخه‌ی در حال اجرا
          </div>
          <div className="mt-2 text-2xl font-extrabold tabular-nums text-foreground">
            {toFaDigits(data!.build.version)}
          </div>
          <p className="mt-2 font-mono text-2xs text-muted-foreground" dir="ltr">
            {data!.build.sha}
          </p>
        </Card>
      </div>

      {/* ── دیتابیس ── */}
      <Section title="دیتابیس" description="اتصال‌ها و کوئری‌های در حال اجرا">
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <Metric icon={Database} label="نسخه‌ی Postgres" value={toFaDigits(h.db.version)} />
          <Metric icon={Server} label="اتصال‌های باز" value={toFaDigits(h.db.connections)} />
          <Metric icon={Activity} label="کوئری فعال" value={toFaDigits(h.db.active_queries)} />
          <Metric
            icon={Activity}
            label="طولانی‌ترین کوئری"
            value={`${toFaDigits(h.db.longest_query_sec)} ثانیه`}
            tone={h.db.longest_query_sec > 30 ? "danger" : "neutral"}
          />
        </div>
      </Section>

      {/* ── حجم داده ── */}
      <Section title="حجم داده" description="تعداد رکورد در جدول‌های اصلی">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {Object.entries(h.tables).map(([key, value]) => (
            <div key={key} className="rounded-xl border border-border bg-card p-3">
              <div className="text-lg font-extrabold tabular-nums text-foreground">
                {toFaDigits(value)}
              </div>
              <div className="mt-0.5 text-2xs text-muted-foreground">
                {TABLE_LABEL[key] ?? key}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── احراز هویت و فعالیت ── */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Section title="احراز هویت" description="وضعیت حساب‌ها در ۲۴ ساعت اخیر">
          <div className="grid grid-cols-2 gap-2.5">
            <Metric icon={Users} label="فعال ۲۴ ساعت" value={toFaDigits(h.auth.active_24h)} />
            <Metric
              icon={Users}
              label="ایمیل تأییدنشده"
              value={toFaDigits(h.auth.unconfirmed)}
              tone={h.auth.unconfirmed > 0 ? "warning" : "neutral"}
            />
            <Metric
              icon={Users}
              label="هرگز وارد نشده"
              value={toFaDigits(h.auth.never_signed_in)}
            />
            <Metric
              icon={AlertOctagon}
              label="حساب قفل‌شده"
              value={toFaDigits(h.auth.accounts_locked)}
              tone={h.auth.accounts_locked > 0 ? "danger" : "neutral"}
            />
          </div>
        </Section>

        <Section title="فعالیت محصول" description="آیا کاربران واقعاً دارند کار می‌کنند؟">
          <div className="grid grid-cols-2 gap-2.5">
            <Metric icon={Activity} label="فروش ۲۴ ساعت" value={toFaDigits(h.activity.sales_24h)} />
            <Metric
              icon={Activity}
              label="آخرین فروش"
              value={h.activity.last_sale_at ? toJalali(h.activity.last_sale_at) : "—"}
            />
            <Metric
              icon={Bug}
              label="تیکت باز"
              value={toFaDigits(h.activity.open_tickets)}
              tone={h.activity.open_tickets > 0 ? "warning" : "neutral"}
            />
            <Metric
              icon={AlertOctagon}
              label="قدیمی‌ترین بی‌پاسخ"
              value={`${toFaDigits(h.activity.oldest_unanswered_hours)} ساعت`}
              tone={h.activity.oldest_unanswered_hours > 24 ? "danger" : "neutral"}
            />
          </div>
        </Section>
      </div>

      {/* ── خطاهای زنده ── */}
      {!data!.canSeeErrors ? (
        <Section title="خطاهای زنده">
          <p className="text-xs text-muted-foreground">
            نقش شما اجازه‌ی مشاهده‌ی جزئیات خطا را ندارد. برای دسترسی، مجوز «خطاهای زنده»
            باید به نقشتان اضافه شود.
          </p>
        </Section>
      ) : (
        <Section
          title="خطاهای زنده"
          description="هر خطای سرور با یک کد پیگیری ثبت می‌شود؛ همان کدی که کاربر در پیام خطا می‌بیند"
          action={
            <Button
              variant="secondary"
              size="sm"
              icon={<Trash2 size={14} />}
              loading={prune.isPending}
              onClick={async () => {
                const ok = await confirm({
                  title: "پاک‌سازی خطاهای قدیمی",
                  description:
                    "خطاهای قدیمی‌تر از ۳۰ روز برای همیشه حذف می‌شوند. خطاهای اخیر دست‌نخورده می‌مانند.",
                  tone: "danger",
                  confirmLabel: "پاک کن",
                });
                if (ok) prune.mutate(30);
              }}
            >
              پاک‌سازی قدیمی‌ها
            </Button>
          }
        >
          <div className="space-y-3">
            <Field label="جستجو با کد پیگیری یا نام بخش">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="مثلاً a3f9c1b2 یا admin/invoices"
                dir="ltr"
                className="text-left"
              />
            </Field>

            {errors.length === 0 ? (
              <EmptyState
                icon={Bug}
                title={search ? "خطایی با این مشخصات یافت نشد" : "هیچ خطایی ثبت نشده"}
                description={
                  search
                    ? "کد پیگیری را دوباره بررسی کنید."
                    : "این خبر خوبی است — از آخرین پاک‌سازی، سرور خطای مهارنشده‌ای نداشته."
                }
              />
            ) : (
              <div className="space-y-2">
                {errors.map((row) => (
                  <ErrorCard
                    key={row.id}
                    row={row}
                    open={expanded === row.id}
                    onToggle={() => setExpanded(expanded === row.id ? null : row.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </Section>
      )}

      <p className="text-center text-2xs text-muted-foreground">
        آخرین اندازه‌گیری: {toJalali(h.measured_at, true)}
      </p>
    </div>
  );
}

function Metric({
  icon: Icon, label, value, tone = "neutral",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone?: "neutral" | "warning" | "danger";
}) {
  const toneCls = {
    neutral: "text-foreground",
    warning: "text-warning-onSoft",
    danger: "text-destructive-text",
  }[tone];

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
        <Icon size={12} aria-hidden />
        {label}
      </div>
      <div className={cn("mt-1 truncate text-sm font-extrabold tabular-nums", toneCls)}>
        {value}
      </div>
    </div>
  );
}

/**
 * کارت یک خطا.
 *
 * جزئیات فنی پیش‌فرض جمع است. باز بودنِ همه‌ی stack traceها صفحه را
 * غیرقابل مرور می‌کند، در حالی که ۹۰٪ مواقع فقط دنبال «کدام بخش و
 * چند بار» هستیم.
 */
function ErrorCard({
  row, open, onToggle,
}: {
  row: ErrorRow;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 p-3 text-right"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="danger">{row.context}</Badge>
            <code className="font-mono text-2xs text-muted-foreground" dir="ltr">
              {row.ref}
            </code>
            {row.status && (
              <span className="text-2xs text-muted-foreground">
                کد {toFaDigits(row.status)}
              </span>
            )}
          </div>
          <p className="mt-1.5 line-clamp-2 text-xs text-foreground" dir="auto">
            {row.message || "بدون پیام"}
          </p>
        </div>
        <span className="shrink-0 text-2xs text-muted-foreground">
          {toJalali(row.created_at, true)}
        </span>
      </button>

      {open && (
        <div className="border-t border-border p-3">
          {row.path && (
            <p className="mb-2 font-mono text-2xs text-muted-foreground" dir="ltr">
              {row.method} {row.path}
            </p>
          )}
          {/*
            متن خام خطا در <pre> با dir="ltr": پیام‌های Postgres و
            stack traceها انگلیسی‌اند و در جهت راست‌به‌چپ به‌هم می‌ریزند.
          */}
          <pre
            dir="ltr"
            className="max-h-64 overflow-auto rounded-lg bg-muted p-2.5 text-left font-mono text-2xs leading-5 text-foreground"
          >
            {JSON.stringify(row.detail ?? {}, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
