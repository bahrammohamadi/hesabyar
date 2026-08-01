"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Receipt } from "lucide-react";
import type { PanelInstance } from "@/src/core/panel-manager/types";
import { usePanelManager } from "@/src/core/panel-manager/panel-manager.store";
import { EntityLink } from "@/src/core/panel-manager/EntityLink";
import { useDocumentEntity, useRegisterPayment, useTransitionDocument, type DocumentLine, type DocumentTransitionStatus, type InvoiceDocType, type PaymentMethod } from "@/src/core/services/invoice-service";
import { Badge, Button, DataTable, EmptyState, Field, NumberInput, PanelShell, Section, Select, Spinner, StatusPill, Tabs, useConfirm, type Column } from "@/src/shared/ui";
import { Money, PersianDate, toPersianDigits } from "@/src/shared/format";
import { rialToToman, tomanToRial } from "@/lib/utils/format";
import { PanelExitLink } from "@/src/core/panel-manager/PanelExitLink";

function docTypeLabel(type: InvoiceDocType) {
  return type === "sale" ? "فروش" : "خرید";
}

function docTone(type: InvoiceDocType) {
  return type === "sale" ? "primary" : "info";
}

export function InvoicePanel({ panel }: { panel: PanelInstance }) {
  const { closeTop } = usePanelManager();
  const confirm = useConfirm();
  const docType = panel.docType ?? "sale";
  const docId = panel.entityId;
  const invoiceQuery = useDocumentEntity(docType, docId);
  const transitionMutation = useTransitionDocument();
  const paymentMutation = useRegisterPayment();
  const [paymentAmountToman, setPaymentAmountToman] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");

  useEffect(() => {
    const remaining = invoiceQuery.data?.balance?.remaining ?? 0;
    if (remaining > 0) setPaymentAmountToman(rialToToman(remaining));
  }, [invoiceQuery.data?.balance?.remaining]);

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
  const affectedProductIds = Array.from(new Set(lines.map((line) => line.product_id).filter((id): id is string => !!id)));
  const mutationContext = { docType: document.doc_type, docId: document.doc_id, affectedProductIds, contactId: document.contact_id };
  const status = document.status;
  const remaining = balance?.remaining ?? Math.max(0, document.total - document.paid_amount);
  const canConfirm = status === "draft";
  const canPay = remaining > 0 && (status === "confirmed" || status === "paid");
  const canSettle = status === "confirmed" || status === "paid";
  const canReverse = status === "confirmed" || status === "paid" || status === "settled";
  const isBusy = transitionMutation.isPending || paymentMutation.isPending;

  async function runTransition(newStatus: DocumentTransitionStatus) {
    const message = newStatus === "confirmed"
      ? "با تأیید سند، موجودی انبار کم/زیاد می‌شود. ادامه می‌دهید؟"
      : newStatus === "reversed"
        ? "⚠️ این عملیات موجودی را برمی‌گرداند و سند دیگر قابل ویرایش نیست. مطمئن هستید؟"
        : "سند به وضعیت تسویه‌شده تغییر کند؟";
    const ok = await confirm({
      title: newStatus === "reversed" ? "برگشت سند" : newStatus === "confirmed" ? "تأیید سند" : "تسویه سند",
      description: message,
      tone: newStatus === "reversed" ? "danger" : "default",
      confirmLabel: newStatus === "reversed" ? "برگشت سند" : "تأیید",
      cancelLabel: "انصراف",
    });
    if (!ok) return;
    await transitionMutation.mutateAsync({ ...mutationContext, newStatus });
  }

  async function submitPayment() {
    const amountRial = tomanToRial(paymentAmountToman ?? 0);
    if (amountRial <= 0) {
      window.alert("مبلغ پرداخت باید بزرگتر از صفر باشد.");
      return;
    }
    if (amountRial > remaining) {
      const ok = await confirm({
        title: "پرداخت بیشتر از مانده",
        description: "مبلغ واردشده بیشتر از مانده سند است. ادامه می‌دهید؟",
        tone: "default",
        confirmLabel: "ادامه",
        cancelLabel: "انصراف",
      });
      if (!ok) return;
    }
    await paymentMutation.mutateAsync({ ...mutationContext, amountRial, method: paymentMethod });
  }

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
    >
      <div className="space-y-4">
        <Section title="دسترسی کامل" description="برای ویرایش اقلام، چاپ، CSV و عملیات legacy از صفحه کامل استفاده کنید.">
          <PanelExitLink href={`/${document.doc_type === "sale" ? "sales" : "purchases"}/${document.doc_id}`} className="btn-secondary inline-flex min-h-9 rounded-xl px-3 py-1.5 text-xs">
            مشاهده/ویرایش کامل در صفحه اختصاصی
          </PanelExitLink>
        </Section>

        <Section title="طرف حساب" description="از این لینک می‌توانید به ContactPanel برگردید.">
          {document.contact_id && contact ? (
            <div className="flex flex-wrap items-center gap-2">
              <EntityLink type="contact" id={document.contact_id}>{contact.contact.name}</EntityLink>
              {contact.contact.phone && <Badge tone="neutral">{contact.contact.phone}</Badge>}
              <Badge tone={contact.contact.type === "supplier" ? "info" : "primary"}>{contact.contact.type === "supplier" ? "تأمین‌کننده" : contact.contact.type === "both" ? "هر دو" : "مشتری"}</Badge>
            </div>
          ) : (
            <div className="text-sm font-bold text-muted-foreground">مشتری نقدی / پیش‌فرض</div>
          )}
        </Section>

        {(canConfirm || canPay || canSettle || canReverse) && (
          <Section title="اکشن‌های سند" description="هر اکشن حساس قبل از اجرا تأیید می‌خواهد و قوانین در RPC دیتابیس enforce می‌شود.">
            <div className="flex flex-wrap gap-2">
              {canConfirm && <Button loading={isBusy} onClick={() => runTransition("confirmed")}>تأیید سند</Button>}
              {canPay && <Button variant="secondary" onClick={() => window.document.getElementById("invoice-payment-form")?.scrollIntoView({ behavior: "smooth", block: "center" })}>ثبت پرداخت</Button>}
              {canSettle && <Button variant="secondary" loading={isBusy} onClick={() => runTransition("settled")}>تسویه</Button>}
              {canReverse && <Button variant="danger" loading={isBusy} onClick={() => runTransition("reversed")}>برگشت سند</Button>}
            </div>
          </Section>
        )}

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
                  {canPay && (
                    <Section title="ثبت پرداخت" description="پرداخت از مسیر fn_register_payment ثبت می‌شود و در صورت تسویه کامل، سند خودکار settled می‌شود." className="scroll-mt-24" >
                      <div id="invoice-payment-form" className="grid gap-4 sm:grid-cols-2">
                        <Field label="مبلغ پرداخت (تومان)">
                          <NumberInput value={paymentAmountToman} onValueChange={setPaymentAmountToman} />
                        </Field>
                        <Field label="روش پرداخت">
                          <Select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}>
                            <option value="cash">نقد</option>
                            <option value="card">کارت</option>
                            <option value="credit">اعتباری</option>
                            <option value="transfer">انتقال</option>
                          </Select>
                        </Field>
                      </div>
                      {tomanToRial(paymentAmountToman ?? 0) > remaining && (
                        <div className="mt-3 rounded-xl bg-warning-soft p-3 text-sm text-warning">مبلغ واردشده بیشتر از مانده سند است و قبل از ارسال دوباره تأیید می‌گیرد.</div>
                      )}
                      <div className="mt-4">
                        <Button loading={paymentMutation.isPending} onClick={submitPayment}>ثبت پرداخت</Button>
                      </div>
                    </Section>
                  )}
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
