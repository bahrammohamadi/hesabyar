"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Info,
  RotateCcw, Upload, XCircle,
} from "lucide-react";
import { Badge, Button, Card, Select, useConfirm, useToast } from "@/src/shared/ui";
import { Spinner, EmptyState } from "@/components/shared/ui";
import { toFaDigits, toJalali } from "@/lib/utils/format";
import { COLUMNS, KIND_LABEL, MAX_ROWS, type ImportKind } from "@/lib/import/schema";
import { cn } from "@/lib/utils/cn";

/**
 * ورود دسته‌جمعی داده از فایل اکسل.
 *
 * یک کامپوننت مشترک برای دو مسیر:
 *   • کاربر برای سازمان خودش  (/settings/import)
 *   • ادمین برای یک کسب‌وکار  (/admin/import)
 * تفاوت فقط در آدرس API و «دلیل اجباری» است، نه در جریان کار.
 *
 * جریان عمدی سه‌مرحله‌ای: قالب → بررسی → ثبت.
 * مرحله‌ی «بررسی» (پیش‌نمایش) حذف‌شدنی نبود: کاربر باید *پیش از*
 * نوشتن بداند چند سطر سالم است. بدون آن، تنها راه فهمیدن، انجام‌دادن
 * است — و آن وقت باید ۴۰۰ رکورد را برگرداند.
 */

type Job = {
  id: string;
  kind: string;
  fileName: string | null;
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  status: string;
  isAdminImport: boolean;
  errors: { row: number; column?: string; message: string }[];
  createdAt: string;
  rolledBackAt: string | null;
};

type RunResult = {
  ok: boolean;
  jobId?: string;
  dryRun?: boolean;
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: { row: number; column?: string; message: string }[];
  warnings: string[];
  error?: string;
};

export function DataImport({
  apiBase,
  templateUrl,
  orgId,
  requireReason = false,
  canRollback = true,
}: {
  /** آدرس پایه‌ی API — `/api/import` یا `/api/admin/import`. */
  apiBase: string;
  templateUrl: (kind: ImportKind) => string;
  /** برای مسیر ادمین: سازمان مقصد. */
  orgId?: string;
  requireReason?: boolean;
  canRollback?: boolean;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const confirm = useConfirm();
  const fileInput = useRef<HTMLInputElement>(null);

  const [kind, setKind] = useState<ImportKind>("products");
  const [mode, setMode] = useState<"skip" | "update">("skip");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<RunResult | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);

  const listKey = ["import-jobs", apiBase, orgId ?? ""];
  const { data: jobs, isLoading } = useQuery({
    queryKey: listKey,
    queryFn: async (): Promise<Job[]> => {
      const url = orgId ? `${apiBase}?org_id=${orgId}` : apiBase;
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا در دریافت فهرست");
      return json.jobs as Job[];
    },
  });

  function buildForm(dryRun: boolean) {
    const fd = new FormData();
    fd.append("file", file!);
    fd.append("kind", kind);
    fd.append("mode", mode);
    if (dryRun) fd.append("dry_run", "1");
    if (orgId) fd.append("org_id", orgId);
    if (requireReason) fd.append("reason", reason);
    return fd;
  }

  const check = useMutation({
    mutationFn: async (): Promise<RunResult> => {
      const res = await fetch(apiBase, { method: "POST", body: buildForm(true) });
      return (await res.json()) as RunResult;
    },
    onSuccess: (r) => {
      setPreview(r);
      setResult(null);
      if (!r.ok) toast({ tone: "error", title: "فایل ایراد دارد", description: r.error });
    },
    onError: (e: Error) => toast({ tone: "error", title: "بررسی ناموفق", description: e.message }),
  });

  const submit = useMutation({
    mutationFn: async (): Promise<RunResult> => {
      const res = await fetch(apiBase, { method: "POST", body: buildForm(false) });
      return (await res.json()) as RunResult;
    },
    onSuccess: (r) => {
      setResult(r);
      setPreview(null);
      qc.invalidateQueries({ queryKey: listKey });
      if (r.ok) {
        toast({
          tone: "success",
          title: "ورود داده انجام شد",
          description: `${toFaDigits(r.created)} رکورد جدید ثبت شد`,
        });
        setFile(null);
        if (fileInput.current) fileInput.current.value = "";
      } else {
        toast({ tone: "error", title: "ورود ناموفق", description: r.error });
      }
    },
    onError: (e: Error) => toast({ tone: "error", title: "ورود ناموفق", description: e.message }),
  });

  const rollback = useMutation({
    mutationFn: async (job: Job) => {
      const url = orgId ? `${apiBase}/${job.id}?org_id=${orgId}` : `${apiBase}/${job.id}`;
      const res = await fetch(url, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "برگرداندن ناموفق بود");
      return json.result as { products: number; contacts: number; kept: number };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: listKey });
      toast({
        tone: "success",
        title: "ورود برگردانده شد",
        description:
          r.kept > 0
            ? `${toFaDigits(r.kept)} رکورد که استفاده شده بود فقط غیرفعال شد`
            : undefined,
      });
    },
    onError: (e: Error) => toast({ tone: "error", title: e.message }),
  });

  async function confirmRollback(job: Job) {
    const ok = await confirm({
      title: "برگرداندن این ورود",
      description:
        `تمام رکوردهایی که از فایل «${job.fileName ?? "بدون نام"}» وارد شده‌اند حذف می‌شوند. ` +
        "رکوردهایی که در فاکتور یا تراکنش استفاده شده‌اند حذف نمی‌شوند و فقط غیرفعال می‌گردند. این کار برگشت‌ناپذیر است.",
      tone: "danger",
      confirmLabel: "بله، برگردان",
      cancelLabel: "انصراف",
    });
    if (ok) rollback.mutate(job);
  }

  const busy = check.isPending || submit.isPending;
  const canSubmit =
    Boolean(file) && !busy && (!requireReason || reason.trim().length >= 5);

  return (
    <div className="space-y-4">
      {/* ── راهنمای کوتاه ── */}
      <Card className="border-info/25 bg-info-soft/40 p-4">
        <div className="flex gap-3">
          <Info size={18} className="mt-0.5 shrink-0 text-info-onSoft" aria-hidden />
          <div className="min-w-0 text-xs leading-6 text-foreground">
            <p className="font-extrabold">پیش از شروع، از داده‌های خود پشتیبان بگیرید.</p>
            <ol className="mt-1.5 list-decimal space-y-0.5 pr-4 text-muted-foreground">
              <li>قالب خام را دانلود کنید (برای همین کسب‌وکار ساخته می‌شود).</li>
              <li>سطر نمونه را پاک کنید و داده‌ی خودتان را از سطر دوم بنویسید.</li>
              <li>فایل را انتخاب و «بررسی فایل» را بزنید — هنوز چیزی ثبت نمی‌شود.</li>
              <li>اگر گزارش درست بود، «ثبت نهایی» را بزنید.</li>
            </ol>
          </div>
        </div>
      </Card>

      {/* ── مرحله ۱: قالب ── */}
      <Card className="p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-extrabold text-primary">
            {toFaDigits(1)}
          </span>
          <h2 className="text-sm font-extrabold text-foreground">قالب خام را بگیرید</h2>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block flex-1 space-y-1.5">
            <span className="text-xs font-bold text-muted-foreground">چه چیزی وارد می‌کنید؟</span>
            <Select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as ImportKind);
                setPreview(null);
                setResult(null);
              }}
            >
              {(Object.keys(KIND_LABEL) as ImportKind[]).map((k) => (
                <option key={k} value={k}>{KIND_LABEL[k]}</option>
              ))}
            </Select>
          </label>
          <a href={templateUrl(kind)} download className="sm:w-auto">
            <Button variant="secondary" className="w-full" icon={<Download size={15} />}>
              دانلود قالب {KIND_LABEL[kind]}
            </Button>
          </a>
        </div>

        <details className="mt-3 rounded-xl border border-border bg-muted/30 p-3">
          <summary className="cursor-pointer text-xs font-bold text-foreground">
            ستون‌های این قالب چیست؟
          </summary>
          <ul className="mt-2 space-y-1.5">
            {COLUMNS[kind].map((c) => (
              <li key={c.key} className="text-2xs leading-5">
                <span className="font-extrabold text-foreground">{c.header}</span>
                {c.required && <span className="mr-1 text-destructive">(اجباری)</span>}
                <span className="text-muted-foreground"> — {c.hint}</span>
              </li>
            ))}
          </ul>
        </details>
      </Card>

      {/* ── مرحله ۲: آپلود ── */}
      <Card className="p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-extrabold text-primary">
            {toFaDigits(2)}
          </span>
          <h2 className="text-sm font-extrabold text-foreground">فایل پرشده را بفرستید</h2>
        </div>

        <div className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-muted-foreground">فایل اکسل یا CSV</span>
            <input
              ref={fileInput}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setPreview(null);
                setResult(null);
              }}
              className="block w-full cursor-pointer rounded-xl border border-border bg-card p-2.5 text-xs text-foreground file:ml-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-bold file:text-primary-foreground"
            />
            <span className="block text-2xs text-muted-foreground">
              حداکثر {toFaDigits(MAX_ROWS)} سطر و ۵ مگابایت
            </span>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-muted-foreground">
              اگر رکوردی از قبل وجود داشت
            </span>
            <Select value={mode} onChange={(e) => setMode(e.target.value as "skip" | "update")}>
              <option value="skip">رد کن و دست نزن (پیشنهاد می‌شود)</option>
              <option value="update">اطلاعاتش را با فایل به‌روز کن</option>
            </Select>
            <span className="block text-2xs leading-5 text-muted-foreground">
              {mode === "skip"
                ? "امن‌ترین حالت: هیچ داده‌ی موجودی تغییر نمی‌کند."
                : "⚠️ اطلاعات موجود با مقادیر فایل جایگزین می‌شود. ستون‌های خالی فایل دست‌نخورده می‌مانند."}
            </span>
          </label>

          {requireReason && (
            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-muted-foreground">
                دلیل ورود داده <span className="text-destructive">*</span>
              </span>
              <input
                className="input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="مثلاً: درخواست تیکت شماره ۱۲ — انتقال داده از نرم‌افزار قبلی"
                maxLength={500}
              />
              <span className="block text-2xs text-muted-foreground">
                در گزارش ممیزی ثبت می‌شود. حداقل ۵ نویسه.
              </span>
            </label>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              disabled={!file || busy}
              loading={check.isPending}
              onClick={() => check.mutate()}
              icon={<FileSpreadsheet size={15} />}
            >
              بررسی فایل (بدون ثبت)
            </Button>
            <Button
              disabled={!canSubmit || !preview?.ok}
              loading={submit.isPending}
              onClick={() => submit.mutate()}
              icon={<Upload size={15} />}
            >
              ثبت نهایی
            </Button>
          </div>
          {!preview?.ok && file && (
            <p className="text-2xs text-muted-foreground">
              برای فعال‌شدن «ثبت نهایی»، اول فایل را بررسی کنید.
            </p>
          )}
        </div>
      </Card>

      {/* ── گزارش ── */}
      {(preview || result) && (
        <ResultCard result={(result ?? preview)!} isPreview={Boolean(preview && !result)} />
      )}

      {/* ── تاریخچه ── */}
      <Card className="p-4 sm:p-5">
        <h2 className="mb-3 text-sm font-extrabold text-foreground">ورودهای قبلی</h2>
        {isLoading ? (
          <Spinner />
        ) : (jobs ?? []).length === 0 ? (
          <EmptyState
            icon={FileSpreadsheet}
            title="هنوز فایلی وارد نشده"
            description="پس از اولین ورود، تاریخچه اینجا نمایش داده می‌شود."
          />
        ) : (
          <ul className="divide-y divide-border">
            {(jobs ?? []).map((job) => (
              <li key={job.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-xs font-bold text-foreground">
                      {job.fileName ?? "بدون نام"}
                    </span>
                    <Badge tone={job.kind === "products" ? "info" : "primary"}>
                      {KIND_LABEL[job.kind as ImportKind] ?? job.kind}
                    </Badge>
                    {job.rolledBackAt ? (
                      <Badge tone="neutral">برگردانده شد</Badge>
                    ) : job.status === "failed" ? (
                      <Badge tone="danger">ناموفق</Badge>
                    ) : (
                      <Badge tone="success">انجام شد</Badge>
                    )}
                    {job.isAdminImport && <Badge tone="warning">توسط پشتیبانی</Badge>}
                  </div>
                  <p className="mt-1 text-2xs text-muted-foreground">
                    {toFaDigits(job.created)} جدید
                    {job.updated > 0 && ` · ${toFaDigits(job.updated)} به‌روز`}
                    {job.skipped > 0 && ` · ${toFaDigits(job.skipped)} رد`}
                    {job.failed > 0 && ` · ${toFaDigits(job.failed)} ناموفق`}
                    {" · "}
                    {toJalali(job.createdAt, true)}
                  </p>
                </div>
                {canRollback && !job.rolledBackAt && job.created > 0 && (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={rollback.isPending}
                    onClick={() => confirmRollback(job)}
                    icon={<RotateCcw size={13} />}
                  >
                    برگرداندن
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ─────────────────────── گزارش نتیجه ─────────────────────── */

function ResultCard({ result, isPreview }: { result: RunResult; isPreview: boolean }) {
  const hasErrors = result.errors.length > 0;

  return (
    <Card
      className={cn(
        "p-4 sm:p-5",
        result.ok ? "border-success/25" : "border-destructive/25"
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        {result.ok ? (
          <CheckCircle2 size={18} className="text-success-onSoft" aria-hidden />
        ) : (
          <XCircle size={18} className="text-destructive-text" aria-hidden />
        )}
        {/*
          h2 و نه h3 — صفحه با h1 (PageHeader) شروع می‌شود و پرش
          مستقیم به h3 ساختار عناوین را می‌شکند. axe آن را
          `heading-order` گزارش کرد و صفحه‌خوان سلسله‌مراتب را اشتباه
          اعلام می‌کند. همان قاعده‌ای که در کامپوننت Section رعایت شده.
        */}
        <h2 className="text-sm font-extrabold text-foreground">
          {isPreview ? "نتیجه‌ی بررسی (هنوز چیزی ثبت نشده)" : "گزارش ورود داده"}
        </h2>
      </div>

      {result.error && (
        <p className="mb-3 rounded-xl bg-destructive/10 p-3 text-xs leading-6 text-destructive-text">
          {result.error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="کل سطرها" value={result.totalRows} />
        <Stat
          label={isPreview ? "آماده‌ی ثبت" : "ثبت شد"}
          value={result.created}
          tone="success"
        />
        {result.updated > 0 && <Stat label="به‌روز شد" value={result.updated} tone="info" />}
        {result.skipped > 0 && <Stat label="رد شد (تکراری)" value={result.skipped} />}
        {result.failed > 0 && <Stat label="ایراد داشت" value={result.failed} tone="danger" />}
      </div>

      {result.warnings.length > 0 && (
        <ul className="mt-3 space-y-1">
          {result.warnings.map((w, i) => (
            <li key={i} className="flex gap-2 text-2xs leading-5 text-warning-onSoft">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden />
              {w}
            </li>
          ))}
        </ul>
      )}

      {hasErrors && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-bold text-foreground">
            فهرست ایرادها ({toFaDigits(result.errors.length)} مورد)
          </p>
          {/*
            ناحیه‌ی اسکرول باید با صفحه‌کلید قابل پیمایش باشد.
            axe این را در نوار قیمت‌ها و پنل اعلان‌ها گرفته بود.
          */}
          <div
            className="max-h-64 overflow-y-auto rounded-xl border border-border"
            tabIndex={0}
            role="region"
            aria-label="فهرست ایرادهای فایل"
          >
            <table className="w-full text-2xs">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  <th scope="col" className="p-2 text-right font-extrabold text-foreground">سطر</th>
                  <th scope="col" className="p-2 text-right font-extrabold text-foreground">ستون</th>
                  <th scope="col" className="p-2 text-right font-extrabold text-foreground">ایراد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.errors.slice(0, 200).map((e, i) => (
                  <tr key={i}>
                    <td className="p-2 tabular-nums text-foreground">
                      {e.row > 0 ? toFaDigits(e.row) : "—"}
                    </td>
                    <td className="p-2 text-muted-foreground">{e.column ?? "—"}</td>
                    <td className="p-2 leading-5 text-foreground">{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-2xs text-muted-foreground">
            شماره‌ی سطر با همان شماره‌ای که در اکسل می‌بینید یکی است.
          </p>
        </div>
      )}
    </Card>
  );
}

function Stat({
  label, value, tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "success" | "info" | "danger";
}) {
  const cls = {
    neutral: "bg-muted text-foreground",
    success: "bg-success-soft text-success-onSoft",
    info: "bg-info-soft text-info-onSoft",
    danger: "bg-destructive/10 text-destructive-text",
  }[tone];
  return (
    <div className={cn("rounded-xl p-2.5", cls)}>
      <div className="text-lg font-extrabold tabular-nums">{toFaDigits(value)}</div>
      <div className="text-2xs">{label}</div>
    </div>
  );
}
