"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Filter } from "lucide-react";
import { PageHeader, Spinner, EmptyState } from "@/components/shared/ui";
import { EntityLink } from "@/components/shared/entity-link";
import { toJalali, formatToman, toFaDigits } from "@/lib/utils/format";

type ActivityLog = {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_data: any;
  new_data: any;
  user: { email: string; name: string } | null;
  created_at: string;
};

const ACTION_LABEL: Record<string, string> = {
  create: "ثبت",
  update: "ویرایش",
  delete: "حذف",
  cancel: "ابطال",
  payment: "پرداخت",
  price_change: "تغییر قیمت",
  stock_adjust: "تعدیل موجودی",
  stock_in: "ورود موجودی",
  stock_out: "خروج موجودی",
};

const ENTITY_LABEL: Record<string, string> = {
  sale: "فاکتور فروش",
  purchase: "خرید",
  transaction: "تراکنش مالی",
  stock_movement: "گردش انبار",
  product: "کالا",
  contact: "شخص",
  check: "چک",
  interaction: "تعامل CRM",
};

function entityTypeForLink(type: string) {
  if (type === "sale") return "sale";
  if (type === "purchase") return "purchase";
  if (type === "product") return "product";
  if (type === "contact") return "contact";
  return null;
}

function describe(log: ActivityLog) {
  const data = log.new_data ?? {};
  if (typeof data.total === "number") return `مبلغ: ${formatToman(data.total)}`;
  if (typeof data.amount === "number") return `مبلغ: ${formatToman(data.amount)}`;
  if (typeof data.qty === "number") return `تعداد: ${toFaDigits(data.qty)}`;
  if (data.note) return String(data.note);
  if (data.reason) return String(data.reason);
  return "—";
}

export default function ActivityPage() {
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["activity-logs", entityType, action],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (entityType) params.set("entity_type", entityType);
      if (action) params.set("action", action);
      const res = await fetch(`/api/activity?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "خطا در دریافت گزارش فعالیت");
      return json.logs as ActivityLog[];
    },
  });

  return (
    <div>
      <PageHeader title="گزارش فعالیت کاربران" subtitle="مشاهده اینکه چه کسی فاکتور زده، پرداخت ثبت کرده یا عملیات انجام داده است" />

      <div className="card p-4 mb-4 flex flex-col sm:flex-row gap-2">
        <div className="flex items-center gap-2 text-sm text-slate-500"><Filter size={16} /> فیلتر</div>
        <select className="input sm:w-48" value={entityType} onChange={(e) => setEntityType(e.target.value)}>
          <option value="">همه بخش‌ها</option>
          <option value="sale">فروش</option>
          <option value="purchase">خرید</option>
          <option value="transaction">مالی</option>
          <option value="stock_movement">انبار</option>
          <option value="product">کالا</option>
          <option value="contact">اشخاص</option>
        </select>
        <select className="input sm:w-48" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">همه عملیات</option>
          <option value="create">ثبت</option>
          <option value="update">ویرایش</option>
          <option value="payment">پرداخت</option>
          <option value="price_change">تغییر قیمت</option>
          <option value="stock_adjust">تعدیل موجودی</option>
          <option value="stock_in">ورود موجودی</option>
          <option value="stock_out">خروج موجودی</option>
        </select>
      </div>

      {isLoading ? <Spinner /> : error ? (
        <div className="rounded-xl bg-rose-50 text-rose-700 p-4 text-sm">{(error as Error).message}</div>
      ) : !data?.length ? <EmptyState icon={Activity} title="فعالیتی ثبت نشده" /> : (
        <div className="space-y-2">
          {data.map((log) => {
            const linkType = entityTypeForLink(log.entity_type) as any;
            return (
              <div key={log.id} className="card p-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="badge bg-brand-100 text-brand-700">{ACTION_LABEL[log.action] ?? log.action}</span>
                    <span className="text-sm font-semibold text-slate-800">{ENTITY_LABEL[log.entity_type] ?? log.entity_type}</span>
                    {linkType && log.entity_id && <EntityLink type={linkType} id={log.entity_id}>مشاهده</EntityLink>}
                  </div>
                  <div className="text-sm text-slate-500 mt-2">{describe(log)}</div>
                  <div className="text-xs text-slate-400 mt-1">کاربر: {log.user?.name || log.user?.email || log.user_id || "نامشخص"}</div>
                </div>
                <div className="shrink-0 text-left text-xs text-slate-400">{toJalali(log.created_at, true)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
