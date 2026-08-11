"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertOctagon,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  PackageX,
  ReceiptText,
} from "lucide-react";
import { Badge, Card } from "@/src/shared/ui";
import { formatToman, toFaDigits, toJalali } from "@/lib/utils/format";
import {
  daysUntil,
  dueLabel,
  isStaleInvoice,
  totalActionCount,
  type ActionCenterData,
} from "@/lib/action-center";

/**
 * «کارهای امروز» — مرکز هشدارهای عملی.
 *
 * چرا ساخته شد؟
 *   رقبا (معین، چرتکه) مرکز هشدار دارند: سررسید چک، بدهی، کسری کالا،
 *   اقساط. ما فقط یک ویجت «موجودی کم» داشتیم.
 *
 * 🔴 و آن یکی هم عملاً بی‌فایده بود. اندازه‌گیری روی داده‌ی زنده نشان
 * داد ۳۶۱ از ۳۸۶ تنوع «کم‌موجود» شمرده می‌شدند — چون ۳۴۴ تای آن‌ها
 * موجودی صفر دارند و آستانه‌ی پیش‌فرض ۳ است. هشداری که ۹۴٪ کاتالوگ را
 * قرمز کند، هشدار نیست؛ نویز است و کاربر یاد می‌گیرد نادیده‌اش بگیرد.
 *
 * اینجا فقط کالایی می‌آید که **سابقه‌ی فروش دارد** و تمام شده:
 * ۳۶۱ → ۱۱ مورد.
 *
 * هر سطر لینک دارد؛ هشداری که نشود رویش کاری کرد، فقط اضطراب می‌سازد.
 */

/** یک ردیف قابل کلیک با مبلغ در سمت چپ. */
function Row({
  href,
  title,
  subtitle,
  meta,
  amount,
  tone,
}: {
  href: string;
  title: string;
  subtitle: string;
  /**
   * تکه‌ی دوم زیرنویس (مثلاً «۴۴ روز پیش»).
   *
   * 🔴 چرا prop جدا و نه یک رشته با «·» وسطش؟
   *   دقیقاً همان باگی که در خلاصه‌ی نمودار داشبورد گرفتیم و اینجا
   *   تکرار شد. رشته‌ی «۱۴۰۵/۰۴/۰۶ · ۴۴ روز پیش» در متن راست‌به‌چپ
   *   با الگوریتم bidi بازچینش می‌شود و روی صفحه این‌طور درمی‌آید:
   *     «۴۴ · ۱۴۰۵/۰۴/۰۶ روز پیش»
   *   یعنی عدد روز به تاریخ می‌چسبد و کاربر «۴۴۰۱۴۰۵/۰۴/۰۶» می‌بیند.
   *   در DOM متن درست است و فقط در رندر خراب می‌شود، پس تست رشته‌ای
   *   نمی‌گیردش — از روی اسکرین‌شات پیدا شد.
   *
   *   با دو عنصر جدا در یک flex، هر تکه ظرف مستقل خودش را دارد و
   *   bidi نمی‌تواند بین‌شان قاطی کند.
   */
  meta?: string;
  amount?: number;
  tone?: "danger" | "warning";
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-xl px-2 py-2 transition hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-bold text-foreground">{title}</div>
        <div
          className={`flex items-center gap-1.5 text-2xs ${
            tone === "danger"
              ? "text-destructive-text"
              : tone === "warning"
                ? "text-warning-onSoft"
                : "text-muted-foreground"
          }`}
        >
          <span className="truncate">{subtitle}</span>
          {meta && (
            <>
              <span aria-hidden className="shrink-0 opacity-50">·</span>
              <span className="shrink-0 whitespace-nowrap">{meta}</span>
            </>
          )}
        </div>
      </div>
      {amount !== undefined && (
        <div className="shrink-0 text-2xs font-black tabular-nums text-foreground">
          {formatToman(amount, false)}
        </div>
      )}
      <ChevronLeft size={14} className="shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}

/** سرگروه با آیکون و شمارنده. */
function Group({
  icon: Icon,
  title,
  count,
  tone,
  children,
}: {
  icon: React.ElementType;
  title: string;
  count: number;
  tone: "danger" | "warning" | "info";
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  const toneClass =
    tone === "danger"
      ? "text-destructive-text"
      : tone === "warning"
        ? "text-warning-onSoft"
        : "text-info-onSoft";

  return (
    <section className="space-y-0.5">
      <h3 className={`flex items-center gap-1.5 px-2 text-2xs font-extrabold ${toneClass}`}>
        <Icon size={13} aria-hidden />
        {title}
        <span className="tabular-nums">({toFaDigits(count)})</span>
      </h3>
      {children}
    </section>
  );
}

export function DashboardActionCenter({
  data,
  isLoading,
}: {
  data: ActionCenterData;
  isLoading?: boolean;
}) {
  const total = totalActionCount(data);

  /*
    فقط سه مورد از هر گروه. هدف این ویجت «مرور سریع» است نه فهرست
    کامل؛ اگر ده سطر نشان بدهیم، دوباره همان دیوار متن می‌شود که
    کاربر نادیده می‌گیرد. لینک «همه» برای دیدن کامل هست.
  */
  const LIMIT = 3;

  if (isLoading) {
    return (
      <Card className="p-4 sm:p-5">
        <div className="mb-3 h-4 w-28 animate-pulse rounded bg-muted" />
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-9 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-extrabold text-foreground">
          <CalendarClock size={16} className="text-primary" aria-hidden />
          کارهای امروز
        </h2>
        {total > 0 && <Badge tone="warning">{toFaDigits(total)} مورد</Badge>}
      </div>

      {total === 0 ? (
        /*
          حالت خالی عمداً مثبت است. کاربری که هیچ کار معوقی ندارد باید
          حس خوبی بگیرد، نه یک کادر خالی بی‌معنا.
        */
        <div className="flex flex-col items-center gap-1.5 py-6 text-center">
          <CheckCircle2 size={26} className="text-success" aria-hidden />
          <p className="text-xs font-bold text-foreground">همه‌چیز مرتب است</p>
          <p className="text-2xs text-muted-foreground">
            چک سررسیدگذشته، نسیه‌ی معوق یا کالای تمام‌شده‌ای ندارید.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <Group
            icon={AlertOctagon}
            title="چک سررسید گذشته"
            count={data.checks_overdue.length}
            tone="danger"
          >
            {data.checks_overdue.slice(0, LIMIT).map((c) => (
              <Row
                key={c.id}
                href="/checks"
                tone="danger"
                title={`${c.type === "received" ? "دریافتی" : "پرداختی"} ${
                  c.check_no ? `شماره ${toFaDigits(c.check_no)}` : ""
                } ${c.contact_name ?? ""}`.trim()}
                subtitle={toJalali(c.due_date)}
                meta={dueLabel(daysUntil(c.due_date), toFaDigits)}
                amount={c.amount}
              />
            ))}
          </Group>

          <Group
            icon={CalendarClock}
            title="چک نزدیک سررسید"
            count={data.checks_soon.length}
            tone="warning"
          >
            {data.checks_soon.slice(0, LIMIT).map((c) => (
              <Row
                key={c.id}
                href="/checks"
                tone="warning"
                title={`${c.type === "received" ? "دریافتی" : "پرداختی"} ${
                  c.contact_name ?? ""
                }`.trim()}
                subtitle={toJalali(c.due_date)}
                meta={dueLabel(daysUntil(c.due_date), toFaDigits)}
                amount={c.amount}
              />
            ))}
          </Group>

          <Group
            icon={PackageX}
            title="کالای تمام‌شده"
            count={data.out_of_stock.length}
            tone="warning"
          >
            {data.out_of_stock.slice(0, LIMIT).map((v) => (
              <Row
                key={v.variant_id}
                href={v.product_id ? `/products/${v.product_id}` : "/products"}
                tone="warning"
                title={`${v.product_name}${v.label ? ` — ${v.label}` : ""}`}
                /* «قبلاً فروش رفته» دلیل حضورش در این فهرست را توضیح می‌دهد. */
                subtitle="موجودی صفر"
                meta={`${toFaDigits(v.sold_qty)} عدد فروش رفته`}
              />
            ))}
          </Group>

          <Group
            icon={ReceiptText}
            title="فاکتور نسیه‌ی تسویه‌نشده"
            count={data.unpaid_invoices.length}
            tone="info"
          >
            {data.unpaid_invoices.slice(0, LIMIT).map((s) => (
              <Row
                key={s.id}
                href={`/sales/${s.id}`}
                tone={isStaleInvoice(s.days_old) ? "danger" : undefined}
                title={`${s.invoice_no ?? "فاکتور"} — ${s.contact_name ?? "مشتری نقدی"}`}
                subtitle={toJalali(s.date)}
                meta={`${toFaDigits(s.days_old)} روز پیش`}
                amount={s.amount}
              />
            ))}
          </Group>

          <Group
            icon={ClipboardList}
            title="سفارش در انتظار"
            count={data.pending_orders.length}
            tone="info"
          >
            {data.pending_orders.slice(0, LIMIT).map((o) => (
              <Row
                key={o.id}
                href="/sales/orders"
                title={`${o.order_no ?? "سفارش"} — ${o.contact_name ?? "بدون مشتری"}`}
                subtitle={toJalali(o.date)}
                amount={o.total}
              />
            ))}
          </Group>
        </div>
      )}
    </Card>
  );
}
