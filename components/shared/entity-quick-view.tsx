"use client";

import Link from "next/link";
import { Activity, ArrowDownCircle, Boxes, CalendarClock, CreditCard, Edit, Eye, FileText, Package, Phone, Plus, Receipt, ShoppingCart, User } from "lucide-react";
import { EmptyState, Modal, Spinner } from "./ui";
import { PhoneLink } from "./phone-link";
import type { EntityType } from "@/lib/entities/types";
import { getEntityHref } from "@/lib/entities/routes";
import { useContactSummary } from "@/lib/hooks/useContactSummary";
import { useProductSummary } from "@/lib/hooks/useProductSummary";
import { useEntityTimeline, type EntityTimelineItem } from "@/lib/hooks/useEntityTimeline";
import { formatToman, toFaDigits, toJalali } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

function SummaryCell({ label, value, tone = "default" }: { label: string; value: React.ReactNode; tone?: "default" | "green" | "red" | "amber" | "blue" }) {
  const tones = {
    default: "bg-slate-50 text-slate-800",
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-rose-50 text-rose-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-primary/[0.06] text-primary",
  };
  return (
    <div className={cn("rounded-xl p-3", tones[tone])}>
      <div className="text-xs opacity-70 mb-1">{label}</div>
      <div className="text-sm font-bold truncate">{value}</div>
    </div>
  );
}

function TimelineIcon({ item }: { item: EntityTimelineItem }) {
  if (item.kind === "sale") return <Receipt size={15} />;
  if (item.kind === "purchase") return <ShoppingCart size={15} />;
  if (item.kind === "payment") return <CreditCard size={15} />;
  if (item.kind === "check") return <FileText size={15} />;
  if (item.kind === "stock-in" || item.kind === "stock-out" || item.kind === "stock-adjust") return <Boxes size={15} />;
  if (item.kind === "price-change") return <Edit size={15} />;
  return <Activity size={15} />;
}

function TimelineList({ items }: { items?: EntityTimelineItem[] }) {
  if (!items || items.length === 0) {
    return <div className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-400">تایملاینی برای نمایش وجود ندارد.</div>;
  }

  return (
    <div className="space-y-2">
      {items.slice(0, 8).map((item) => {
        const content = (
          <div className="flex items-start gap-3 rounded-xl border border-slate-100 p-3 hover:bg-slate-50 transition">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
              <TimelineIcon item={item} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="truncate text-sm font-medium text-slate-800">{item.title}</div>
                <div className="shrink-0 text-[11px] text-slate-400">{toJalali(item.date)}</div>
              </div>
              {(item.description || item.amount || item.qty) && (
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                  {item.description && <span className="truncate">{item.description}</span>}
                  {typeof item.amount === "number" && item.amount !== 0 && <span>{formatToman(item.amount, false)}</span>}
                  {typeof item.qty === "number" && <span>تعداد: {toFaDigits(item.qty)}</span>}
                </div>
              )}
            </div>
          </div>
        );

        return item.href ? (
          <Link key={item.id} href={item.href} className="block no-underline">
            {content}
          </Link>
        ) : (
          <div key={item.id}>{content}</div>
        );
      })}
    </div>
  );
}

function QuickAction({ href, children, tone = "default" }: { href: string; children: React.ReactNode; tone?: "default" | "primary" | "green" }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition",
        tone === "primary" ? "bg-primary text-white hover:bg-primary" :
        tone === "green" ? "bg-emerald-600 text-white hover:bg-emerald-700" :
        "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      )}
    >
      {children}
    </Link>
  );
}

function ContactQuickView({ id, open }: { id?: string | null; open: boolean }) {
  const summary = useContactSummary(id, { enabled: open });
  const timeline = useEntityTimeline("contact", id, { enabled: open, limit: 12 });

  if (summary.isLoading) return <Spinner label="در حال بارگذاری اطلاعات مشتری..." />;
  if (summary.error) return <EmptyState title="خطا در دریافت اطلاعات مشتری" description={(summary.error as Error).message} />;
  if (!summary.data) return <EmptyState title="مشتری یافت نشد" />;

  const contact = summary.data;
  const detailHref = getEntityHref("contact", contact.id) ?? "#";

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/[0.06] text-primary">
          <User size={25} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-bold text-slate-800">{contact.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span className="badge bg-slate-100 text-slate-600">{contact.type === "customer" ? "مشتری" : contact.type === "supplier" ? "تأمین‌کننده" : "مشتری/تأمین‌کننده"}</span>
            {contact.phone && <PhoneLink phone={contact.phone} />}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <SummaryCell label="مانده حساب" value={formatToman(Math.abs(contact.balance), false)} tone={contact.balance > 0 ? "red" : contact.balance < 0 ? "green" : "default"} />
        <SummaryCell label="تعداد فاکتور" value={toFaDigits(contact.invoiceCount)} tone="blue" />
        <SummaryCell label="مجموع خرید" value={formatToman(contact.totalSales, false)} tone="green" />
        <SummaryCell label="آخرین خرید" value={contact.lastSaleDate ? toJalali(contact.lastSaleDate) : "—"} />
        <SummaryCell label="آخرین پرداخت" value={contact.lastPaymentDate ? toJalali(contact.lastPaymentDate) : "—"} tone="amber" />
        <SummaryCell label="آخرین تعامل CRM" value={contact.lastInteractionTitle ?? "—"} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {contact.phone && (
          <a href={`tel:${contact.phone.trim().replace(/[^\d+]/g, "")}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700">
            <Phone size={16} /> تماس
          </a>
        )}
        <QuickAction href={`/contacts/${contact.id}?action=interaction`}>
          <Plus size={16} /> ثبت تعامل
        </QuickAction>
        <QuickAction href={`/sales?contact=${contact.id}`} tone="primary">
          <ShoppingCart size={16} /> فروش جدید
        </QuickAction>
        <QuickAction href={detailHref}>
          <Eye size={16} /> مشاهده جزئیات
        </QuickAction>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <CalendarClock size={16} /> تایملاین مشتری
        </div>
        {timeline.isLoading ? <Spinner /> : <TimelineList items={timeline.data} />}
      </div>
    </div>
  );
}

function ProductQuickView({ id, open }: { id?: string | null; open: boolean }) {
  const summary = useProductSummary(id, { enabled: open });
  const timeline = useEntityTimeline("product", id, { enabled: open, limit: 12 });

  if (summary.isLoading) return <Spinner label="در حال بارگذاری اطلاعات کالا..." />;
  if (summary.error) return <EmptyState title="خطا در دریافت اطلاعات کالا" description={(summary.error as Error).message} />;
  if (!summary.data) return <EmptyState title="کالا یافت نشد" />;

  const product = summary.data;
  const detailHref = getEntityHref("product", product.id) ?? "#";

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 text-slate-400">
          {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" /> : <Package size={28} />}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-bold text-slate-800">{product.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            {product.code && <span className="rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-xs text-primary">{product.code}</span>}
            <span>{toFaDigits(product.variantCount)} تنوع</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <SummaryCell label="قیمت خرید" value={formatToman(product.currentPurchasePrice, false)} />
        <SummaryCell label="قیمت فروش" value={formatToman(product.currentSalePrice, false)} tone="blue" />
        <SummaryCell label="موجودی" value={toFaDigits(product.stock)} tone={product.stock > 0 ? "green" : "red"} />
        <SummaryCell label="تعداد گردش" value={toFaDigits(product.movementCount)} />
        <SummaryCell label="آخرین فروش" value={product.lastSaleDate ? toJalali(product.lastSaleDate) : "—"} tone="green" />
        <SummaryCell label="آخرین خرید" value={product.lastPurchaseDate ? toJalali(product.lastPurchaseDate) : "—"} tone="amber" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <QuickAction href={`/products/${product.id}?action=edit`}>
          <Edit size={16} /> ویرایش
        </QuickAction>
        <QuickAction href={`/inventory/adjust?product=${product.id}`} tone="primary">
          <ArrowDownCircle size={16} /> تعدیل موجودی
        </QuickAction>
        <QuickAction href={`/products/${product.id}?tab=movements`}>
          <Boxes size={16} /> گردش کالا
        </QuickAction>
        <QuickAction href={detailHref}>
          <Eye size={16} /> مشاهده کالا
        </QuickAction>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <CalendarClock size={16} /> تایملاین کالا
        </div>
        {timeline.isLoading ? <Spinner /> : <TimelineList items={timeline.data} />}
      </div>
    </div>
  );
}

export function EntityQuickView({
  open,
  onClose,
  type,
  id,
}: {
  open: boolean;
  onClose: () => void;
  type: EntityType;
  id?: string | null;
}) {
  return (
    <Modal open={open} onClose={onClose} title={type === "contact" ? "نمای سریع مشتری" : type === "product" ? "نمای سریع کالا" : "نمای سریع"} size="lg" mobileFullscreen>
      {!id ? (
        <EmptyState title="شناسه موجودیت موجود نیست" />
      ) : type === "contact" ? (
        <ContactQuickView id={id} open={open} />
      ) : type === "product" ? (
        <ProductQuickView id={id} open={open} />
      ) : (
        <EmptyState title="نمای سریع برای این موجودیت هنوز فعال نیست" />
      )}
    </Modal>
  );
}
