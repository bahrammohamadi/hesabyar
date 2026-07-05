"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { EmptyState, PageHeader, Spinner } from "@/components/shared/ui";
import { DataTable } from "@/src/shared/ui";
import { DatePicker } from "@/components/shared/date-picker";
import { EntityActionMenu } from "@/components/shared/entity-action-menu";
import { EntityLink } from "@/components/shared/entity-link";
import { PhoneLink } from "@/components/shared/phone-link";
import { formatToman, toFaDigits, toJalali } from "@/lib/utils/format";

function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return alert("داده‌ای برای خروجی وجود ندارد.");
  const headers = Object.keys(rows[0]);
  const csv = "\ufeff" + [headers.map(csvEscape).join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function scoreDescending(value: number, values: number[]) {
  if (!values.length) return 1;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = sorted.findIndex((x) => value <= x);
  const pct = rank < 0 ? 1 : rank / Math.max(sorted.length - 1, 1);
  return Math.min(5, Math.max(1, Math.ceil(pct * 5)));
}

function scoreAscending(value: number, values: number[]) {
  if (!values.length) return 1;
  const sorted = [...values].sort((a, b) => b - a);
  const rank = sorted.findIndex((x) => value >= x);
  const pct = rank < 0 ? 1 : rank / Math.max(sorted.length - 1, 1);
  return Math.min(5, Math.max(1, Math.ceil(pct * 5)));
}

function labelFor(r: number, f: number, m: number) {
  const sum = r + f + m;
  if (r >= 4 && f >= 4 && m >= 4) return { label: "قهرمان", hint: "حفظ با مزایا و پیام اختصاصی", tone: "bg-emerald-100 text-emerald-700" };
  if (r >= 4 && f >= 3) return { label: "وفادار", hint: "پیشنهاد خرید مکمل", tone: "bg-primary/10 text-primary" };
  if (r <= 2 && f >= 4) return { label: "در خطر ریزش", hint: "کمپین بازگشت فوری", tone: "bg-rose-100 text-rose-700" };
  if (r <= 2 && m >= 4) return { label: "ارزشمند خوابیده", hint: "پیام شخصی‌سازی‌شده", tone: "bg-amber-100 text-amber-700" };
  if (sum <= 5) return { label: "کم‌فعال", hint: "کمپین معرفی/تخفیف سبک", tone: "bg-slate-100 text-slate-600" };
  return { label: "عادی", hint: "نگهداری و پیگیری معمول", tone: "bg-blue-100 text-blue-700" };
}

export default function RfmPage() {
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const { data, isLoading, error } = useQuery({
    queryKey: ["crm-rfm", from, to],
    queryFn: async () => {
      const supabase = createClient();
      let salesQuery = supabase
        .from("sales")
        .select("id,customer_id,total,date,customer:contacts(id,name,phone)")
        .eq("status", "confirmed")
        .not("customer_id", "is", null)
        .order("date", { ascending: false })
        .limit(5000);
      if (from) salesQuery = salesQuery.gte("date", new Date(`${from}T00:00:00`).toISOString());
      if (to) salesQuery = salesQuery.lte("date", new Date(`${to}T23:59:59`).toISOString());
      const { data, error } = await salesQuery;
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = useMemo(() => {
    const map = new Map<string, any>();
    (data ?? []).forEach((sale: any) => {
      const current = map.get(sale.customer_id) ?? { contact: sale.customer, recencyDays: 9999, frequency: 0, monetary: 0, lastDate: null };
      current.frequency += 1;
      current.monetary += sale.total ?? 0;
      if (!current.lastDate || new Date(sale.date) > new Date(current.lastDate)) current.lastDate = sale.date;
      map.set(sale.customer_id, current);
    });

    const base = Array.from(map.values()).map((row) => ({
      ...row,
      recencyDays: row.lastDate ? Math.max(0, Math.floor((Date.now() - new Date(row.lastDate).getTime()) / 86400000)) : 9999,
    }));
    const recencies = base.map((r) => r.recencyDays);
    const frequencies = base.map((r) => r.frequency);
    const monetaries = base.map((r) => r.monetary);

    return base.map((row) => {
      const rScore = 6 - scoreDescending(row.recencyDays, recencies);
      const fScore = scoreAscending(row.frequency, frequencies);
      const mScore = scoreAscending(row.monetary, monetaries);
      const segment = labelFor(rScore, fScore, mScore);
      return { ...row, rScore, fScore, mScore, rfm: `${rScore}${fScore}${mScore}`, segment };
    }).sort((a, b) => Number(b.rfm) - Number(a.rfm));
  }, [data]);

  function exportExcel() {
    downloadCsv(`rfm-${from}-${to}.csv`, rows.map((row) => ({
      customer: row.contact?.name,
      phone: row.contact?.phone,
      recency_days: row.recencyDays,
      frequency: row.frequency,
      monetary: row.monetary,
      r_score: row.rScore,
      f_score: row.fScore,
      m_score: row.mScore,
      rfm: row.rfm,
      segment: row.segment.label,
      action: row.segment.hint,
      last_purchase: row.lastDate,
    })));
  }

  return (
    <div>
      <PageHeader
        title="تحلیل RFM مشتریان"
        subtitle="تحلیل Recency, Frequency, Monetary برای کمپین‌های هوشمند مشتریان"
        action={<button onClick={exportExcel} className="btn-secondary"><Download size={16} /> Excel</button>}
      />

      <div className="card p-4 mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div><label className="label">از تاریخ</label><DatePicker value={from} onChange={setFrom} /></div>
        <div><label className="label">تا تاریخ</label><DatePicker value={to} onChange={setTo} /></div>
        <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">مشتریان تحلیل‌شده</div><div className="font-bold text-slate-800 mt-1">{toFaDigits(rows.length)}</div></div>
        <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">قهرمان‌ها</div><div className="font-bold text-emerald-600 mt-1">{toFaDigits(rows.filter((r) => r.segment.label === "قهرمان").length)}</div></div>
      </div>

      {isLoading ? <Spinner /> : error ? <div className="rounded-xl bg-rose-50 text-rose-700 p-4 text-sm">{(error as Error).message}</div> : rows.length === 0 ? <EmptyState icon={Target} title="داده‌ای برای تحلیل وجود ندارد" /> : (
        <DataTable
          rows={rows}
          keyExtractor={(row) => row.contact?.id ?? row.contact?.name ?? "unknown"}
          className="bg-white/90"
          columns={[
            { key: "contact", header: "مشتری", render: (row) => <><EntityLink type="contact" id={row.contact?.id}>{row.contact?.name ?? "مشتری"}</EntityLink>{row.contact?.phone && <div className="text-xs text-slate-400"><PhoneLink phone={row.contact.phone} /></div>}</> },
            { key: "last", header: "آخرین خرید", render: (row) => <>{row.lastDate ? toJalali(row.lastDate) : "—"}<div className="text-xs text-slate-400">{toFaDigits(row.recencyDays)} روز قبل</div></> },
            { key: "r", header: "R", render: (row) => toFaDigits(row.rScore) },
            { key: "f", header: "F", render: (row) => toFaDigits(row.fScore) },
            { key: "m", header: "M", render: (row) => toFaDigits(row.mScore) },
            { key: "rfm", header: "کد RFM", render: (row) => <span className="font-bold text-slate-800">{toFaDigits(row.rfm)}</span> },
            { key: "segment", header: "گروه", render: (row) => <span className={`badge ${row.segment.tone}`}>{row.segment.label}</span> },
            { key: "hint", header: "اقدام پیشنهادی", render: (row) => <span className="text-slate-500 text-sm">{row.segment.hint}</span> },
            { key: "action", header: "عملیات", render: (row) => <EntityActionMenu type="contact" id={row.contact?.id} label={row.contact?.name} phone={row.contact?.phone} /> },
          ]}
        />
      )}
    </div>
  );
}
