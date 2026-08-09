"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban, Building2, FileText, Receipt, Search, ShieldAlert, User, Wallet,
} from "lucide-react";
import { PageHeader, Spinner, EmptyState } from "@/components/shared/ui";
import {
  Badge, Button, Card, DateRangeFilter, EMPTY_RANGE, Field, Input,
  Modal, Select, Textarea, useToast, type DateRange,
} from "@/src/shared/ui";
import { formatToman, toFaDigits, toJalali } from "@/lib/utils/format";
import {
  INVOICE_STATUSES, INVOICE_STATUS_LABEL, MIN_REASON_LENGTH,
  isReasonValid, type InvoiceStatus,
} from "@/lib/admin/invoices";
import { cn } from "@/lib/utils/cn";

/**
 * فاکتورهای همه‌ی کسب‌وکارها — پنل سوپرادمین.
 *
 * کاربر خواسته بود: «به فاکتورهای هر کسب‌وکار دسترسی داشته باشم،
 * تأیید/حذف/اصلاح فاکتور».
 *
 * صادقانه درباره‌ی «حذف»: حذف واقعی سطر انجام نمی‌شود و نباید بشود.
 * توضیح کامل در app/api/admin/invoices/[id]/route.ts — خلاصه اینکه
 * فاکتور به موجودی انبار و مانده‌ی حساب گره خورده و حذفش موجودی را
 * برای همیشه غلط می‌کند. «ابطال» همان نتیجه را بدون خرابی داده
 * می‌دهد و ردّ ممیزی نگه می‌دارد.
 */

type Invoice = {
  id: string;
  org_id: string;
  org_name: string | null;
  invoice_no: string | null;
  date: string;
  status: InvoiceStatus;
  total: number;
  paid_amount: number;
  paid_credit: number;
  customer_name: string | null;
  customer_phone: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  item_count: number;
};

type Summary = {
  count: number;
  totalAmount: number;
  cancelled: number;
  truncated: boolean;
};

const STATUS_TONE: Record<string, "success" | "info" | "warning" | "danger" | "neutral"> = {
  draft: "neutral",
  confirmed: "info",
  paid: "success",
  settled: "success",
  reversed: "danger",
  cancelled: "danger",
  returned: "warning",
};

export default function AdminInvoicesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [range, setRange] = useState<DateRange>(EMPTY_RANGE);
  const [cancelTarget, setCancelTarget] = useState<Invoice | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-invoices", search, status, range.from, range.to],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (status) params.set("status", status);
      if (range.from) params.set("from", range.from);
      if (range.to) params.set("to", range.to);

      const res = await fetch(`/api/admin/invoices?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا در دریافت فاکتورها");
      return json as { invoices: Invoice[]; summary: Summary; viewerRole: string };
    },
  });

  const invoices = data?.invoices ?? [];
  const s = data?.summary;
  // فقط مدیر ارشد اجازه‌ی ابطال دارد؛ باید با ماتریس دیتابیس یکی باشد.
  const canModify = data?.viewerRole === "super_admin";

  return (
    <div className="space-y-4">
      <PageHeader
        title="فاکتورهای کسب‌وکارها"
        subtitle="مشاهده و ابطال فاکتور فروش در همه‌ی کسب‌وکارها — هر عملیات در گزارش فعالیت ثبت می‌شود"
      />

      {/* ── فیلترها ── */}
      <Card className="space-y-3 p-3 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Field label="جستجو">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="شماره فاکتور، نام کسب‌وکار، نام یا تلفن مشتری"
            />
          </Field>
          <Field label="وضعیت">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">همه</option>
              {INVOICE_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {INVOICE_STATUS_LABEL[st]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <DateRangeFilter value={range} onChange={setRange} />
      </Card>

      {isLoading ? (
        <Spinner label="در حال بارگذاری فاکتورها..." />
      ) : error ? (
        <div className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive-text">
          {(error as Error).message}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <Tile icon={Receipt} label="تعداد فاکتور" value={toFaDigits(s?.count ?? 0)} />
            <Tile
              icon={Wallet}
              label="جمع مبلغ (بدون باطل‌شده)"
              value={formatToman(s?.totalAmount ?? 0)}
            />
            <Tile
              icon={Ban}
              label="باطل‌شده"
              value={toFaDigits(s?.cancelled ?? 0)}
              tone={(s?.cancelled ?? 0) > 0 ? "warning" : "neutral"}
            />
            <Tile
              icon={ShieldAlert}
              label="سطح دسترسی شما"
              value={canModify ? "ابطال مجاز" : "فقط مشاهده"}
              tone={canModify ? "danger" : "neutral"}
            />
          </div>

          {/*
            هشدار برش نتیجه.
            بدون این، ادمین فکر می‌کند همه‌ی فاکتورها را می‌بیند و
            ممکن است بر اساس جمعِ ناقص تصمیم بگیرد.
          */}
          {s?.truncated && (
            <div className="rounded-xl bg-warning-soft px-4 py-2.5 text-xs font-bold text-warning-onSoft">
              نتیجه به سقف نمایش رسیده است. برای دیدن بقیه، بازه‌ی تاریخ یا جستجو را محدودتر کنید.
            </div>
          )}

          {invoices.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="فاکتوری یافت نشد"
              description="فیلترها را تغییر دهید یا بازه‌ی تاریخ را بازتر کنید."
            />
          ) : (
            <div className="space-y-2.5">
              {invoices.map((inv) => (
                <InvoiceRow
                  key={inv.id}
                  invoice={inv}
                  canModify={canModify}
                  onCancel={() => setCancelTarget(inv)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {cancelTarget && (
        <CancelModal
          invoice={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onDone={(message) => {
            toast({ title: message, tone: "success" });
            setCancelTarget(null);
            qc.invalidateQueries({ queryKey: ["admin-invoices"] });
          }}
        />
      )}
    </div>
  );
}

function Tile({
  icon: Icon, label, value, tone = "neutral",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone?: "neutral" | "warning" | "danger";
}) {
  const toneCls = {
    neutral: "text-muted-foreground bg-muted",
    warning: "text-warning-onSoft bg-warning-soft",
    danger: "text-destructive-text bg-destructive/10",
  }[tone];

  return (
    <Card className="p-3">
      <div className={cn("mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg", toneCls)}>
        <Icon size={15} aria-hidden />
      </div>
      <p className="truncate text-sm font-extrabold tabular-nums text-foreground">{value}</p>
      <p className="mt-0.5 text-2xs text-muted-foreground">{label}</p>
    </Card>
  );
}

/**
 * یک ردیف فاکتور.
 *
 * چرا کارت و نه سطر جدول؟ هر فاکتور شش قلم اطلاعات دارد (کسب‌وکار،
 * مشتری، تاریخ، مبلغ، وضعیت، عملیات) و روی موبایل جدول شش‌ستونه
 * یعنی اسکرول افقی. کارت روی هر سه اندازه بدون بریدگی کار می‌کند.
 */
function InvoiceRow({
  invoice, canModify, onCancel,
}: {
  invoice: Invoice;
  canModify: boolean;
  onCancel: () => void;
}) {
  const isCancelled = invoice.status === "cancelled";

  return (
    <Card className={cn("p-3 sm:p-4", isCancelled && "opacity-70")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-extrabold text-foreground">
              {invoice.invoice_no ?? "بدون شماره"}
            </span>
            <Badge tone={STATUS_TONE[invoice.status] ?? "neutral"}>
              {INVOICE_STATUS_LABEL[invoice.status] ?? invoice.status}
            </Badge>
            <span className="text-2xs text-muted-foreground">
              {toFaDigits(invoice.item_count)} قلم
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Building2 size={13} aria-hidden />
              {invoice.org_name ?? "—"}
            </span>
            <span className="inline-flex items-center gap-1">
              <User size={13} aria-hidden />
              {invoice.customer_name ?? "مشتری متفرقه"}
            </span>
            <span>{toJalali(invoice.date)}</span>
          </div>

          {isCancelled && invoice.cancel_reason && (
            <p className="text-2xs text-destructive-text">
              دلیل ابطال: {invoice.cancel_reason}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="text-left">
            <div
              className={cn(
                "text-sm font-extrabold tabular-nums",
                isCancelled ? "text-muted-foreground line-through" : "text-foreground"
              )}
            >
              {formatToman(invoice.total)}
            </div>
            {invoice.paid_credit > 0 && !isCancelled && (
              <div className="text-2xs text-warning-onSoft">
                نسیه: {formatToman(invoice.paid_credit)}
              </div>
            )}
          </div>

          {canModify && !isCancelled && (
            <Button variant="danger" size="sm" icon={<Ban size={14} />} onClick={onCancel}>
              ابطال
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

/** پنجره‌ی ابطال — دلیل اجباری است. */
function CancelModal({
  invoice, onClose, onDone,
}: {
  invoice: Invoice;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [reason, setReason] = useState("");
  const valid = isReasonValid(reason);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/invoices/${invoice.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", reason: reason.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا در ابطال فاکتور");
      return json as { message: string };
    },
    onSuccess: (json) => onDone(json.message),
  });

  return (
    <Modal open onClose={onClose} title={`ابطال فاکتور ${invoice.invoice_no ?? ""}`}>
      <div className="space-y-4">
        <div className="rounded-xl bg-warning-soft p-3 text-xs leading-6 text-warning-onSoft">
          <p className="font-extrabold">این عمل برگشت‌پذیر نیست.</p>
          <p className="mt-1">
            موجودی کالاهای این فاکتور به انبار برمی‌گردد و دریافت‌های ثبت‌شده خنثی می‌شوند.
            فاکتور حذف نمی‌شود بلکه با برچسب «باطل‌شده» باقی می‌ماند تا سابقه‌ی حسابداری
            کسب‌وکار سالم بماند.
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <dt className="text-muted-foreground">کسب‌وکار</dt>
            <dd className="font-bold text-foreground">{invoice.org_name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">مبلغ</dt>
            <dd className="font-bold tabular-nums text-foreground">{formatToman(invoice.total)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">مشتری</dt>
            <dd className="font-bold text-foreground">{invoice.customer_name ?? "متفرقه"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">تاریخ</dt>
            <dd className="font-bold text-foreground">{toJalali(invoice.date)}</dd>
          </div>
        </dl>

        <Field
          label="دلیل ابطال"
          required
          hint={`این متن در گزارش فعالیت و روی خود فاکتور ثبت می‌شود. حداقل ${toFaDigits(MIN_REASON_LENGTH)} نویسه.`}
        >
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="مثلاً: درخواست مالک کسب‌وکار طی تیکت ۱۲۳ — فاکتور اشتباهی ثبت شده بود"
          />
        </Field>

        {mutation.isError && (
          <p className="rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive-text">
            {(mutation.error as Error).message}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            انصراف
          </Button>
          <Button
            variant="danger"
            disabled={!valid}
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            ابطال فاکتور
          </Button>
        </div>
      </div>
    </Modal>
  );
}
