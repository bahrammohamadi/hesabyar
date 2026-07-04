"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FileText, MoreVertical, Phone, User } from "lucide-react";
import type { PanelInstance, PanelMode } from "@/src/core/panel-manager/types";
import { usePanelManager } from "@/src/core/panel-manager/panel-manager.store";
import { EntityLink } from "@/src/core/panel-manager/EntityLink";
import {
  useContactDocuments,
  useContactEntity,
  useCreateContact,
  useDeactivateContact,
  useReactivateContact,
  useUpdateContact,
  type ContactDocument,
  type ContactType,
} from "@/src/core/services/contact-service";
import { useOrg } from "@/lib/hooks/useOrg";
import { Badge, Button, DataTable, EmptyState, Field, IconButton, Input, PanelShell, Section, Select, Spinner, StatusPill, Tabs, Textarea, type Column } from "@/src/shared/ui";
import { Money, PersianDate } from "@/src/shared/format";

const TYPE_LABEL: Record<ContactType, string> = {
  customer: "مشتری",
  supplier: "تأمین‌کننده",
  both: "مشتری و تأمین‌کننده",
};

function documentLabel(type: ContactDocument["doc_type"]) {
  return type === "sale" ? "فروش" : "خرید";
}

type ContactFormState = {
  name: string;
  phone: string;
  type: ContactType;
  address: string;
  description: string;
};

function emptyForm(): ContactFormState {
  return { name: "", phone: "", type: "customer", address: "", description: "" };
}

export function ContactPanel({ panel }: { panel: PanelInstance }) {
  const { closeTop, replaceTop, resolveTop } = usePanelManager();
  const { orgId, branchId } = useOrg();
  const contactId = panel.entityId;
  const [mode, setMode] = useState<PanelMode>(panel.mode);
  const contactQuery = useContactEntity(contactId);
  const docsQuery = useContactDocuments(contactId);
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const deactivateContact = useDeactivateContact();
  const reactivateContact = useReactivateContact();
  const [form, setForm] = useState<ContactFormState>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);

  const data = contactQuery.data;
  const contact = data?.contact;

  useEffect(() => {
    if (mode === "create") {
      const initialName = typeof panel.props?.initialName === "string" ? panel.props.initialName : "";
      const initialType = panel.props?.initialType === "supplier" || panel.props?.initialType === "both" ? panel.props.initialType : "customer";
      setForm({ ...emptyForm(), name: initialName, type: initialType });
      return;
    }
    if (contact) {
      setForm({
        name: contact.name,
        phone: contact.phone ?? "",
        type: contact.type,
        address: contact.address ?? "",
        description: contact.description ?? "",
      });
    }
  }, [contact, mode]);

  async function handleSave() {
    setFormError(null);
    if (!form.name.trim()) {
      setFormError("نام مخاطب الزامی است.");
      return;
    }
    try {
      if (mode === "create") {
        if (!orgId) {
          setFormError("سازمان فعال یافت نشد.");
          return;
        }
        const created = await createContact.mutateAsync({
          org_id: orgId,
          branch_id: branchId,
          name: form.name,
          type: form.type,
          phone: form.phone,
          address: form.address,
          description: form.description,
        });
        if (typeof panel.props?.resultRequestId === "string") {
          resolveTop({ id: created.id, type: "contact", title: created.name, data: created });
        } else {
          replaceTop({ type: "contact", entityId: created.id, mode: "view", title: created.name, context: panel.context });
        }
      } else if (contactId) {
        await updateContact.mutateAsync({
          id: contactId,
          patch: {
            name: form.name,
            type: form.type,
            phone: form.phone,
            address: form.address,
            description: form.description,
          },
        });
        setMode("view");
      }
    } catch (error) {
      setFormError((error as Error).message);
    }
  }

  async function toggleActive() {
    if (!contactId || !contact) return;
    const ok = window.confirm(contact.is_active ? "مخاطب غیرفعال شود؟" : "مخاطب فعال شود؟");
    if (!ok) return;
    if (contact.is_active) await deactivateContact.mutateAsync(contactId);
    else await reactivateContact.mutateAsync(contactId);
  }

  const isSaving = createContact.isPending || updateContact.isPending;
  const isToggling = deactivateContact.isPending || reactivateContact.isPending;
  const isCreate = mode === "create";

  if (!isCreate && !contactId) {
    return (
      <PanelShell title="مخاطب" subtitle="شناسه موجود نیست" icon={<User size={20} />} onClose={closeTop}>
        <EmptyState title="شناسه مخاطب مشخص نیست" />
      </PanelShell>
    );
  }

  if (!isCreate && contactQuery.isLoading) {
    return <PanelShell title="در حال بارگذاری مخاطب" icon={<User size={20} />} onClose={closeTop}><Spinner /></PanelShell>;
  }

  if (!isCreate && contactQuery.error) {
    return <PanelShell title="خطا" icon={<User size={20} />} onClose={closeTop}><EmptyState title="خطا در دریافت مخاطب" description={(contactQuery.error as Error).message} /></PanelShell>;
  }

  if (!isCreate && !data) {
    return <PanelShell title="مخاطب یافت نشد" icon={<User size={20} />} onClose={closeTop}><EmptyState title="موجودیت یافت نشد" /></PanelShell>;
  }

  const balance = data?.balance;
  const balanceTone = (balance?.balance ?? 0) > 0 ? "debt" : (balance?.balance ?? 0) < 0 ? "credit" : "neutral";

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

  const formContent = (
    <div className="space-y-4">
      <Section title={isCreate ? "مخاطب جدید" : "ویرایش مخاطب"} description="کد مخاطب در صورت خالی بودن توسط دیتابیس تولید می‌شود.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="نام نمایشی" required error={formError && !form.name.trim() ? formError : null}>
            <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
          </Field>
          <Field label="کد" hint="خواندنی / تولید خودکار">
            <Input value={contact?.code ?? "تولید خودکار"} disabled />
          </Field>
          <Field label="نوع">
            <Select value={form.type} onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value as ContactType }))}>
              <option value="customer">مشتری</option>
              <option value="supplier">تأمین‌کننده</option>
              <option value="both">هر دو</option>
            </Select>
          </Field>
          <Field label="شماره تماس">
            <Input dir="ltr" className="text-left" value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} />
          </Field>
          <Field label="آدرس" className="sm:col-span-2">
            <Input value={form.address} onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))} />
          </Field>
          <Field label="توضیحات" className="sm:col-span-2">
            <Textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
          </Field>
        </div>
        {formError && form.name.trim() && <div className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-destructive">{formError}</div>}
        <div className="mt-4 flex gap-2">
          <Button loading={isSaving} onClick={handleSave}>ذخیره</Button>
          <Button variant="secondary" onClick={() => (isCreate ? closeTop() : setMode("view"))}>انصراف</Button>
        </div>
      </Section>
    </div>
  );

  if (mode === "create" || mode === "edit") {
    return <PanelShell title={isCreate ? "مخاطب جدید" : contact?.name ?? "ویرایش مخاطب"} subtitle={isCreate ? "Create Contact" : contact?.code ?? undefined} icon={<User size={20} />} onClose={closeTop}>{formContent}</PanelShell>;
  }

  return (
    <PanelShell
      title={contact!.name}
      subtitle={contact!.code ? `کد: ${contact!.code}` : TYPE_LABEL[contact!.type]}
      icon={<User size={20} />}
      onClose={closeTop}
      actions={<IconButton aria-label="گزینه‌های مخاطب"><MoreVertical size={18} /></IconButton>}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={contact!.is_active ? "success" : "neutral"}>{contact!.is_active ? "فعال" : "غیرفعال"}</Badge>
          <Badge tone="primary">{TYPE_LABEL[contact!.type]}</Badge>
          {contact!.phone && <Badge tone="neutral"><Phone size={12} /> {contact!.phone}</Badge>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/contacts/${contact!.id}`} className="btn-secondary min-h-9 rounded-xl px-3 py-1.5 text-xs">
            مشاهده صفحه کامل
          </Link>
          <Button size="sm" variant="secondary" onClick={() => setMode("edit")}>ویرایش</Button>
          <Button size="sm" variant={contact!.is_active ? "danger" : "secondary"} loading={isToggling} onClick={toggleActive}>{contact!.is_active ? "غیرفعال‌سازی" : "فعال‌سازی"}</Button>
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
                      <div><dt className="text-muted-foreground">نام</dt><dd className="font-bold text-slate-800">{contact!.name}</dd></div>
                      <div><dt className="text-muted-foreground">کد</dt><dd className="font-mono" dir="ltr">{contact!.code ?? "—"}</dd></div>
                      <div><dt className="text-muted-foreground">تلفن</dt><dd dir="ltr" className="text-left sm:text-right">{contact!.phone ?? "—"}</dd></div>
                      <div><dt className="text-muted-foreground">موبایل</dt><dd dir="ltr" className="text-left sm:text-right">{contact!.mobile ?? "—"}</dd></div>
                      <div className="sm:col-span-2"><dt className="text-muted-foreground">آدرس</dt><dd>{contact!.address ?? "—"}</dd></div>
                    </dl>
                  </Section>

                  <Section title="مانده حساب" description="قرارداد: مثبت = بدهکار، منفی = بستانکار">
                    <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted p-4">
                      <span className="text-sm font-bold text-muted-foreground">مانده</span>
                      <Money value={balance?.balance ?? 0} tone={balanceTone} className="text-lg" />
                    </div>
                    <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                      <div className="rounded-xl border border-border p-3"><div className="text-muted-foreground">جمع فروش</div><Money value={balance?.total_sales ?? 0} /></div>
                      <div className="rounded-xl border border-border p-3"><div className="text-muted-foreground">جمع دریافتی</div><Money value={balance?.total_received ?? 0} tone="positive" /></div>
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
                <DataTable rows={docsQuery.data ?? []} columns={documentColumns} keyExtractor={(row) => row.doc_id} empty={<EmptyState title="سندی برای این شخص یافت نشد" />} />
              ),
            },
          ]}
        />
      </div>
    </PanelShell>
  );
}
