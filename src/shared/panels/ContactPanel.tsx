"use client";

import { FileText, MoreVertical, Phone, User } from "lucide-react";
import type { PanelInstance } from "@/src/core/panel-manager/types";
import { usePanelManager } from "@/src/core/panel-manager/panel-manager.store";
import { EntityLink } from "@/src/core/panel-manager/EntityLink";
import { useContactDocuments, useContactEntity, type ContactDocument } from "@/src/core/services/contact-service";
import { Badge, DataTable, EmptyState, IconButton, PanelShell, Section, Spinner, StatusPill, Tabs, type Column } from "@/src/shared/ui";
import { Money, PersianDate } from "@/src/shared/format";

const TYPE_LABEL = {
  customer: "مشتری",
  supplier: "تأمین‌کننده",
  both: "مشتری و تأمین‌کننده",
} as const;

function documentLabel(type: ContactDocument["doc_type"]) {
  return type === "sale" ? "فروش" : "خرید";
}

export function ContactPanel({ panel }: { panel: PanelInstance }) {
  const { closeTop } = usePanelManager();
  const contactId = panel.entityId;
  const contactQuery = useContactEntity(contactId);
  const docsQuery = useContactDocuments(contactId);

  if (!contactId) {
    return (
      <PanelShell title="مشتری جدید" subtitle="حالت ایجاد در مرحله بعد فعال می‌شود" icon={<User size={20} />} onClose={closeTop}>
        <EmptyState title="حالت ایجاد هنوز فعال نیست" description="این زیرمرحله فقط view-mode است." />
      </PanelShell>
    );
  }

  if (contactQuery.isLoading) {
    return <PanelShell title="در حال بارگذاری مشتری" icon={<User size={20} />} onClose={closeTop}><Spinner /></PanelShell>;
  }

  if (contactQuery.error) {
    return <PanelShell title="خطا" icon={<User size={20} />} onClose={closeTop}><EmptyState title="خطا در دریافت مشتری" description={(contactQuery.error as Error).message} /></PanelShell>;
  }

  const data = contactQuery.data;
  if (!data) {
    return <PanelShell title="مشتری یافت نشد" icon={<User size={20} />} onClose={closeTop}><EmptyState title="موجودیت یافت نشد" /></PanelShell>;
  }

  const { contact, balance } = data;
  const balanceTone = balance.balance > 0 ? "debt" : balance.balance < 0 ? "credit" : "neutral";

  const documentColumns: Column<ContactDocument>[] = [
    {
      key: "invoice_no",
      header: "شماره سند",
      render: (row) => (
        <EntityLink type="invoice" docType={row.doc_type} id={row.doc_id}>
          {row.invoice_no ?? row.doc_id.slice(0, 8)}
        </EntityLink>
      ),
    },
    { key: "type", header: "نوع", render: (row) => <Badge tone={row.doc_type === "sale" ? "primary" : "info"}>{documentLabel(row.doc_type)}</Badge> },
    { key: "date", header: "تاریخ", render: (row) => <PersianDate value={row.doc_date} /> },
    { key: "total", header: "مبلغ", align: "left", render: (row) => <Money value={row.total} /> },
    { key: "status", header: "وضعیت", render: (row) => <StatusPill status={row.status} /> },
  ];

  return (
    <PanelShell
      title={contact.name}
      subtitle={contact.code ? `کد: ${contact.code}` : TYPE_LABEL[contact.type]}
      icon={<User size={20} />}
      onClose={closeTop}
      actions={<IconButton aria-label="گزینه‌های مشتری"><MoreVertical size={18} /></IconButton>}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={contact.is_active ? "success" : "neutral"}>{contact.is_active ? "فعال" : "غیرفعال"}</Badge>
          <Badge tone="primary">{TYPE_LABEL[contact.type]}</Badge>
          {contact.phone && <Badge tone="neutral"><Phone size={12} /> {contact.phone}</Badge>}
        </div>

        <Tabs
          items={[
            {
              value: "summary",
              label: "خلاصه",
              content: (
                <div className="space-y-4">
                  <Section title="اطلاعات شخص">
                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                      <div><dt className="text-muted-foreground">نام</dt><dd className="font-bold text-slate-800">{contact.name}</dd></div>
                      <div><dt className="text-muted-foreground">کد</dt><dd className="font-mono" dir="ltr">{contact.code ?? "—"}</dd></div>
                      <div><dt className="text-muted-foreground">تلفن</dt><dd dir="ltr" className="text-left sm:text-right">{contact.phone ?? "—"}</dd></div>
                      <div><dt className="text-muted-foreground">موبایل</dt><dd dir="ltr" className="text-left sm:text-right">{contact.mobile ?? "—"}</dd></div>
                      <div className="sm:col-span-2"><dt className="text-muted-foreground">آدرس</dt><dd>{contact.address ?? "—"}</dd></div>
                    </dl>
                  </Section>

                  <Section title="مانده حساب" description="قرارداد: مثبت = بدهکار، منفی = بستانکار">
                    <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted p-4">
                      <span className="text-sm font-bold text-muted-foreground">مانده</span>
                      <Money value={balance.balance} tone={balanceTone} className="text-lg" />
                    </div>
                    <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                      <div className="rounded-xl border border-border p-3"><div className="text-muted-foreground">جمع فروش</div><Money value={balance.total_sales} /></div>
                      <div className="rounded-xl border border-border p-3"><div className="text-muted-foreground">جمع دریافتی</div><Money value={balance.total_received} tone="positive" /></div>
                    </div>
                  </Section>
                </div>
              ),
            },
            {
              value: "documents",
              label: "اسناد",
              content: docsQuery.isLoading ? (
                <Spinner />
              ) : docsQuery.error ? (
                <EmptyState title="خطا در دریافت اسناد" description={(docsQuery.error as Error).message} />
              ) : (
                <DataTable
                  rows={docsQuery.data ?? []}
                  columns={documentColumns}
                  keyExtractor={(row) => row.doc_id}
                  empty={<EmptyState title="سندی برای این شخص یافت نشد" />}
                />
              ),
            },
          ]}
        />
      </div>
    </PanelShell>
  );
}
