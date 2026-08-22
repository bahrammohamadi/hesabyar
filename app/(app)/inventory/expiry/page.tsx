"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { useOrgPrefs } from "@/lib/hooks/useOrgPrefs";
import { EmptyState, PageHeader, Spinner } from "@/components/shared/ui";
import { Badge, Card, Field, Select } from "@/src/shared/ui";
import { EntityLink } from "@/components/shared/entity-link";
import { downloadCsv } from "@/lib/export/download";
import { toFaDigits, toJalali } from "@/lib/utils/format";
import { formatQty } from "@/lib/units";
import {
  batchTokens,
  daysLeftText,
  EXPIRY_META,
  expiryLevel,
  summarizeExpiry,
} from "@/lib/batches";

type Row = {
  batch_id: string;
  variant_id: string;
  product_name: string;
  variant_label: string | null;
  lot_no: string | null;
  expiry_date: string;
  days_left: number;
  qty: number;
};

/**
 * گزارش انقضای نزدیک.
 *
 * 🔴 دو ادعای سایت را می‌بندد: «مدیریت تاریخ انقضا» (سوپرمارکت) و
 * «کنترل تاریخ انقضا» (داروخانه).
 *
 * ⚠️ فقط بچ‌هایی که **موجودی دارند** نمایش داده می‌شوند. بچ
 * تمام‌شده‌ی منقضی هیچ اهمیتی ندارد و فقط گزارش را شلوغ می‌کند.
 */
export default function ExpiryReportPage() {
  const { orgId } = useOrg();
  const { productWord } = useOrgPrefs();
  const [days, setDays] = useState("60");

  const { data, isLoading, error } = useQuery({
    queryKey: ["expiring-batches", orgId, days],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data: rows, error: e } = await supabase.rpc("expiring_batches", {
        p_org: orgId,
        p_days: Number(days) || 60,
      });
      if (e) throw e;
      return (rows ?? []) as Row[];
    },
  });

  const rows = data ?? [];
  const stats = useMemo(() => summarizeExpiry(rows), [rows]);

  function exportCsv() {
    downloadCsv(
      `expiry-${days}days.csv`,
      rows.map((r) => ({
        "کالا": r.product_name,
        "تنوع": r.variant_label ?? "",
        "سری ساخت": r.lot_no ?? "",
        "تاریخ انقضا": toJalali(r.expiry_date),
        "روز باقی‌مانده": r.days_left,
        "موجودی": r.qty,
      }))
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="انقضای نزدیک"
        subtitle={`${productWord}هایی که تاریخ انقضایشان نزدیک یا گذشته است`}
        action={
          rows.length > 0 ? (
            <button onClick={exportCsv} className="btn-secondary">
              <Download size={16} /> خروجی اکسل
            </button>
          ) : undefined
        }
      />

      <Card className="p-3 sm:p-4">
        <Field label="بازه‌ی هشدار">
          <Select value={days} onChange={(e) => setDays(e.target.value)} className="w-full sm:w-56">
            <option value="7">تا ۷ روز آینده</option>
            <option value="30">تا ۳۰ روز آینده</option>
            <option value="60">تا ۶۰ روز آینده</option>
            <option value="90">تا ۹۰ روز آینده</option>
            <option value="180">تا ۶ ماه آینده</option>
          </Select>
        </Field>
      </Card>

      {/*
        🔴 خلاصه با span جدا و جداکننده‌ی aria-hidden.
        رشته‌ی `${عدد} · ${عدد}` در متن راست‌به‌چپ بازچینش می‌شود و
        اعداد به هم می‌چسبند — در DOM درست است و فقط رندر خراب
        می‌شود، پس تست رشته‌ای نمی‌گیردش.
      */}
      {stats.total > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 text-center">
            <div className="text-2xl font-black tabular-nums text-destructive">
              {toFaDigits(stats.expired)}
            </div>
            <div className="mt-0.5 text-2xs text-muted-foreground">منقضی شده</div>
          </Card>
          <Card className="p-3 text-center">
            <div className="text-2xl font-black tabular-nums text-destructive">
              {toFaDigits(stats.critical)}
            </div>
            <div className="mt-0.5 text-2xs text-muted-foreground">تا یک هفته</div>
          </Card>
          <Card className="p-3 text-center">
            <div className="text-2xl font-black tabular-nums text-warning-onSoft">
              {toFaDigits(stats.warning)}
            </div>
            <div className="mt-0.5 text-2xs text-muted-foreground">تا یک ماه</div>
          </Card>
        </div>
      )}

      {isLoading ? (
        <Spinner label="در حال بارگذاری..." />
      ) : error ? (
        <div className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive-text">
          {(error as Error).message}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="چیزی نزدیک به انقضا نیست"
          description="هنگام ثبت خرید می‌توانید برای هر قلم سری ساخت و تاریخ انقضا وارد کنید تا اینجا رصد شود."
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const level = expiryLevel(r.days_left);
            const meta = EXPIRY_META[level];
            const tokens = batchTokens(r);
            return (
              <li
                key={r.batch_id}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3 ${
                  level === "expired" || level === "critical"
                    ? "border-destructive/30 bg-destructive/[0.04]"
                    : level === "warning"
                      ? "border-warning/40 bg-warning/[0.06]"
                      : "border-border"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <EntityLink type="product" id={r.variant_id}>
                      {r.product_name}
                    </EntityLink>
                    {r.variant_label && (
                      <span className="text-2xs text-muted-foreground">{r.variant_label}</span>
                    )}
                  </div>
                  {/*
                    توکن‌های بچ هرکدام span جدا — `batchTokens` عمداً
                    آرایه برمی‌گرداند نه رشته، تا امکان ساختن الگوی
                    مشکل‌دار وجود نداشته باشد.
                  */}
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-muted-foreground">
                    {tokens.map((t, i) => (
                      <span key={t} className="contents">
                        {i > 0 && <span aria-hidden="true">·</span>}
                        <span className="tabular-nums">
                          {i === tokens.length - 1 && r.expiry_date ? toJalali(r.expiry_date) : t}
                        </span>
                      </span>
                    ))}
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      موجودی {toFaDigits(formatQty(r.qty, "count"))}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {toFaDigits(daysLeftText(r.days_left))}
                  </span>
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
