"use client";

import { MoreVertical, Receipt } from "lucide-react";
import type { PanelInstance } from "@/src/core/panel-manager/types";
import { usePanelManager } from "@/src/core/panel-manager/panel-manager.store";
import { EntityLink } from "@/src/core/panel-manager/EntityLink";
import { useDocumentEntity, type DocumentLine, type InvoiceDocType } from "@/src/core/services/invoice-service";
import { Badge, DataTable, EmptyState, IconButton, PanelShell, Section, Spinner, StatusPill, Tabs, type Column } from "@/src/shared/ui";
import { Money, PersianDate, toPersianDigits } from "@/src/shared/format";

function docTypeLabel(type: InvoiceDocType) {
  return type === "sale" ? "فروش" : "خرید";
}

function docTone(type: InvoiceDocType) {
  return type === "sale" ? "primary" : "info";
}

export function InvoicePanel({ panel }: { panel: PanelInstance }) {
  const { closeTop } = usePanelManager();
  const docType = panel.docType ?? "sale";
  const docId = panel.entityId;
  const invoiceQuery = useDocumentEntity(docType, docId);

  if (!docId) {
    return (
      <PanelShell title="سند جدید" subtitle="حالت ایجاد در مرحله بعد فعال می‌شود" icon={<Receipt size={20} />} onClose={closeTop}>
        <EmptyState title="حالت ایجاد هنوز فعال نیست" description="این زیرمرحله فقط view-mode است." />
      </PanelShell>
    );
  }

  if (invoiceQuery.isLoading) {
    return <PanelShell title="در حال بارگذاری سند" icon={<Receipt size={20} />} onClose={closeTop}><Spinner /></PanelShell>;
  }

  if (invoiceQuery.error) {
    return <PanelShell title="خطا" icon={<Receipt size={20} />} onClose={closeTop}><EmptyState title="خطا در دریافت سند" description={(invoiceQuery.error as Error).message} /></PanelShell>;
  }

  const data = invoiceQuery.data;
  if (!data) {
    return <PanelShell title="سند یافت نشد" icon={<Receipt size={20} />} onClose={closeTop}><EmptyState title="سند مورد نظر یافت نشد" /></PanelShell>;
  }

  const { document, lines, balance, contact } = data;
  const displayNo = document.invoice_no ?? document.doc_id.slice(0, 8);

  const lineColumns: Column<DocumentLine>[] = [
    {
      key: "product",
      header: "کالا",
      render: (row) => row.product_id ? (
        <EntityLink type="product" id={row.product_id}>{row.product_name}</EntityLink>
      ) : row.product_name,
    },
    { key: "sku", header: "SKU", render: (row) => <span className="font-mono" dir="ltr">{row.sku ?? row.barcode ?? "—"}</span> },
    { key: "qty", header: "تعداد", align: "center", render: (row) => toPersianDigits(row.qty) },
    { key: "unit", header: "قیمت واحد", align: "left", render: (row) => <Money value={row.unit_price} /> },
    { key: "discount", header: "تخفیف", align: "left", render: (row) => <Money value={row.discount} /> },
    { key: "total", header: "جمع", align: "left", render: (row) => <Money value={row.line_total} /> },
  ];

  return (
    <PanelShell
      title={`سند ${docTypeLabel(document.doc_type)} ${displayNo}`}
      subtitle={<span className="inline-flex items-center gap-2"><Badge tone={docTone(document.doc_type)}>{docTypeLabel(document.doc_type)}</Badge><StatusPill status={document.status} /></span>}
      icon={<Receipt size={20} />}
      onClose={closeTop}
      actions={<IconButton aria-label="گزینه‌های سند"><MoreVertical size={18} /></IconButton>}
    >
      <div className="space-y-4">
        <Section title="طرف حساب" description="از این لینک می‌توانید به ContactPanel برگردید.">
          {document.contact_id && contact ? (
            <div className="flex flex-wrap items-center gap-2">
              <EntityLink type="contact" id={document.contact_id}>{contact.contact.name}</EntityLink>
              {contact.contact.phone && <Badge tone="neutral">{contact.contact.phone}</Badge>}
              <Badge tone={contact.contact.type === "supplier" ? "info" : "primary"}>{contact.contact.type === "supplier" ? "تأمین‌کننده" : contact.contact.type === "both" ? "هر دو" : "مشتری"}</Badge>
            </div>
          ) : (
            <div className="text-sm font-bold text-slate-600">مشتری نقدی / پیش‌فرض</div>
          )}
        </Section>

        <Tabs
          items={[
            {
              value: "lines",
              label: "اقلام",
              content: (
                <DataTable
                  rows={lines}
                  columns={lineColumns}
                  keyExtractor={(row) => row.line_id}
                  empty={<EmptyState title="قلمی برای این سند ثبت نشده" />}
                />
              ),
            },
            {
              value: "finance",
              label: "مالی",
              content: (
                <div className="space-y-4">
                  <Section title="خلاصه مالی سند">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-border p-3"><div className="text-sm text-muted-foreground">جمع قبل تخفیف</div><Money value={document.subtotal} /></div>
                      <div className="rounded-xl border border-border p-3"><div className="text-sm text-muted-foreground">تخفیف</div><Money value={document.discount_amount} tone="credit" /></div>
                      <div className="rounded-xl border border-border p-3"><div className="text-sm text-muted-foreground">مبلغ کل</div><Money value={document.total} /></div>
                      <div className="rounded-xl border border-border p-3"><div className="text-sm text-muted-foreground">پرداخت‌شده</div><Money value={balance?.paid_amount ?? document.paid_amount} tone="positive" /></div>
                      <div className="rounded-xl border border-border p-3"><div className="text-sm text-muted-foreground">مانده</div><Money value={balance?.remaining ?? Math.max(0, document.total - document.paid_amount)} tone={(balance?.remaining ?? 0) > 0 ? "debt" : "neutral"} /></div>
                      <div className="rounded-xl border border-border p-3"><div className="text-sm text-muted-foreground">وضعیت پرداخت</div><div className="mt-1"><StatusPill kind="payment" status={balance?.payment_status ?? "unpaid"} /></div></div>
                    </div>
                  </Section>
                </div>
              ),
            },
            {
              value: "details",
              label: "جزئیات",
              content: (
                <Section title="جزئیات سند">
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div><dt className="text-muted-foreground">شماره سند</dt><dd className="font-mono" dir="ltr">{displayNo}</dd></div>
                    <div><dt className="text-muted-foreground">نوع</dt><dd><Badge tone={docTone(document.doc_type)}>{docTypeLabel(document.doc_type)}</Badge></dd></div>
                    <div><dt className="text-muted-foreground">تاریخ</dt><dd><PersianDate value={document.doc_date} withTime /></dd></div>
                    <div><dt className="text-muted-foreground">وضعیت</dt><dd><StatusPill status={document.status} /></dd></div>
                    <div className="sm:col-span-2"><dt className="text-muted-foreground">توضیحات</dt><dd>{document.note ?? "—"}</dd></div>
                  </dl>
                </Section>
              ),
            },
          ]}
        />
      </div>
    </PanelShell>
  );
}
