"use client";

import { useState } from "react";
import { useOrgPrefs } from "@/lib/hooks/useOrgPrefs";
import { useQuery } from "@tanstack/react-query";
import { Activity, Filter, History } from "lucide-react";
import { PageHeader, Spinner, EmptyState } from "@/components/shared/ui";
import { Card, Select, DateRangeFilter, EMPTY_RANGE, hasRange, type DateRange } from "@/src/shared/ui";
import {
  ActionBadge,
  ActivityFeedCard,
  ActivityTimelineItem,
  ActorAvatar,
  relativeTimeFa,
} from "./components/ActivityPieces";
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
  stock_adjust: "انبارگردانی",
  stock_in: "ورود موجودی",
  stock_out: "خروج موجودی",
  stock_waste: "ضایعات",
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

/**
 * توضیح کوتاه یک رویداد.
 *
 * 🔴 `money` به‌صورت پارامتر می‌آید، نه از hook.
 *   این تابع داخل `map` صدا زده می‌شود و hook آنجا نقض قواعد
 *   React است. اسکریپت مهاجرت خودکار یک بار اشتباهاً hook را
 *   اینجا گذاشت و بازرسی خودکار گرفتش.
 */
function describe(log: ActivityLog, money: (v: number | null | undefined) => string) {
  const data = log.new_data ?? {};
  if (typeof data.total === "number") return `مبلغ: ${money(data.total)}`;
  if (typeof data.amount === "number") return `مبلغ: ${money(data.amount)}`;
  if (typeof data.qty === "number") return `تعداد: ${toFaDigits(data.qty)}`;
  if (data.note) return String(data.note);
  if (data.reason) return String(data.reason);
  return "—";
}

export default function ActivityPage() {
  /* واحد پول سازمان — به `describe` پاس داده می‌شود. */
  const { money } = useOrgPrefs();
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  // بازه سمت سرور اعمال می‌شود؛ این فهرست limit 100 دارد و فیلتر
  // محلی فقط ۱۰۰ رکورد آخر را می‌دید.
  const [range, setRange] = useState<DateRange>(EMPTY_RANGE);

  const { data, isLoading, error } = useQuery({
    queryKey: ["activity-logs", entityType, action, range.from, range.to],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (entityType) params.set("entity_type", entityType);
      if (action) params.set("action", action);
      if (range.from) params.set("from", range.from);
      if (range.to) params.set("to", range.to);
      if (hasRange(range)) params.set("limit", "200");
      const res = await fetch(`/api/activity?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "خطا در دریافت گزارش فعالیت");
      return json.logs as ActivityLog[];
    },
  });

  return (
    <div className="space-y-4">
      <PageHeader title="گزارش فعالیت کاربران" subtitle="مشاهده اینکه چه کسی فاکتور زده، پرداخت ثبت کرده یا عملیات انجام داده است" />

      {/* فیلترها */}
      <Card className="p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex shrink-0 items-center gap-2 text-sm font-bold text-muted-foreground">
            <Filter size={16} /> فیلتر
          </div>
          <Select
            className="sm:w-48"
            aria-label="فیلتر بخش"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
          >
            <option value="">همه بخش‌ها</option>
            <option value="sale">فروش</option>
            <option value="purchase">خرید</option>
            <option value="transaction">مالی</option>
            <option value="stock_movement">انبار</option>
            <option value="product">کالا</option>
            <option value="contact">اشخاص</option>
          </Select>
          <Select
            className="sm:w-48"
            aria-label="فیلتر عملیات"
            value={action}
            onChange={(e) => setAction(e.target.value)}
          >
            <option value="">همه عملیات</option>
            <option value="create">ثبت</option>
            <option value="update">ویرایش</option>
            <option value="payment">پرداخت</option>
            <option value="price_change">تغییر قیمت</option>
            <option value="stock_adjust">انبارگردانی</option>
            <option value="stock_in">ورود موجودی</option>
            <option value="stock_out">خروج موجودی</option>
          </Select>
        </div>

        <div className="mt-3 border-t border-border pt-3">
          <DateRangeFilter value={range} onChange={setRange} />
        </div>
      </Card>

      {isLoading ? (
        <Spinner />
      ) : error ? (
        <div className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">{(error as Error).message}</div>
      ) : !data?.length ? (
        <EmptyState icon={Activity} title={hasRange(range) ? "در این بازه فعالیتی ثبت نشده" : "فعالیتی ثبت نشده"} />
      ) : (
        <ActivityFeedCard title="آخرین فعالیت‌های سیستم" icon={History}>
          <ul className="relative">
            {data.map((log, index) => {
              const linkType = entityTypeForLink(log.entity_type) as any;
              const actorName = log.user?.name || log.user?.email || "سیستم";
              const detailText = describe(log, money);
              return (
                <ActivityTimelineItem
                  key={log.id}
                  action={log.action}
                  isLast={index === data.length - 1}
                  time={relativeTimeFa(log.created_at)}
                  meta={
                    <span className="flex items-center gap-1.5">
                      <ActorAvatar name={actorName} className="h-5 w-5 text-2xs" />
                      {actorName}
                    </span>
                  }
                  title={
                    <>
                      <ActionBadge action={log.action} label={ACTION_LABEL[log.action] ?? log.action} />
                      <span className="text-sm font-bold text-foreground">
                        {ENTITY_LABEL[log.entity_type] ?? log.entity_type}
                      </span>
                      {linkType && log.entity_id && (
                        <EntityLink type={linkType} id={log.entity_id}>
                          مشاهده
                        </EntityLink>
                      )}
                    </>
                  }
                  detail={detailText !== "—" ? detailText : undefined}
                  trailing={
                    <span className="shrink-0 text-2xs tabular-nums text-muted-foreground">
                      {toJalali(log.created_at, true)}
                    </span>
                  }
                />
              );
            })}
          </ul>
        </ActivityFeedCard>
      )}
    </div>
  );
}
