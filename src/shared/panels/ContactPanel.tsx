"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, MessageCircle, Phone, ReceiptText, User } from "lucide-react";
import type { PanelInstance, PanelMode } from "@/src/core/panel-manager/types";
import { usePanelManager } from "@/src/core/panel-manager/panel-manager.store";
import { EntityLink } from "@/src/core/panel-manager/EntityLink";
import {
  useContactDocuments,
  useContactEntity,
  useContactInteractions,
  useContactTransactions,
  useCreateContact,
  useCreateContactTransaction,
  useCreateInteraction,
  useDeactivateContact,
  useReactivateContact,
  useUpdateContact,
  type ContactDocument,
  type ContactInteraction,
  type ContactTransaction,
  type ContactType,
} from "@/src/core/services/contact-service";
import { useOrg } from "@/lib/hooks/useOrg";
import { createClient } from "@/lib/supabase/client";
import { DatePicker } from "@/components/shared/date-picker";
import { Badge, Button, DataTable, EmptyState, Field, Input, NumberInput, PanelShell, Section, Select, Spinner, StatusPill, Tabs, Textarea, type Column } from "@/src/shared/ui";
import { Money, PersianDate } from "@/src/shared/format";
import { contactHelp } from "@/lib/help/contacts";
import { PanelExitLink } from "@/src/core/panel-manager/PanelExitLink";

const TYPE_LABEL: Record<ContactType, string> = {
  customer: "مشتری",
  supplier: "تأمین‌کننده",
  both: "مشتری و تأمین‌کننده",
};

function documentLabel(type: ContactDocument["doc_type"]) {
  return type === "sale" ? "فروش" : "خرید";
}

type ContactFormState = {
  firstName: string;
  lastName: string;
  name: string;
  phone: string;
  type: ContactType;
  email: string;
  birthDate: string;
  nationalCode: string;
  jobTitle: string;
  gender: string;
  address: string;
  description: string;
};

function emptyForm(): ContactFormState {
  return { firstName: "", lastName: "", name: "", phone: "", type: "customer", email: "", birthDate: "", nationalCode: "", jobTitle: "", gender: "", address: "", description: "" };
}

type InteractionFormState = {
  type: string;
  title: string;
  description: string;
  nextFollowup: string;
};

function emptyInteractionForm(): InteractionFormState {
  return { type: "note", title: "", description: "", nextFollowup: "" };
}

type TransactionFormState = {
  type: "receipt" | "payment";
  amountToman: number | null;
  accountId: string;
  method: string;
  note: string;
};

function emptyTransactionForm(): TransactionFormState {
  return { type: "receipt", amountToman: null, accountId: "", method: "cash", note: "" };
}

const INTERACTION_LABEL: Record<string, string> = {
  note: "یادداشت",
  call: "تماس",
  follow_up: "پیگیری",
  meeting: "جلسه",
  visit: "بازدید",
  email: "ایمیل",
  sms: "پیامک",
  complaint: "شکایت",
};

const TRANSACTION_LABEL: Record<string, string> = {
  receipt: "دریافت",
  payment: "پرداخت",
  income: "درآمد",
  expense: "هزینه",
  transfer: "انتقال",
};

export function ContactPanel({ panel }: { panel: PanelInstance }) {
  const { closeTop, replaceTop, resolveTop } = usePanelManager();
  const { orgId, branchId } = useOrg();
  const contactId = panel.entityId;
  const [mode, setMode] = useState<PanelMode>(panel.mode);
  const contactQuery = useContactEntity(contactId);
  const docsQuery = useContactDocuments(contactId);
  const interactionsQuery = useContactInteractions(contactId);
  const transactionsQuery = useContactTransactions(contactId);
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const createInteractionMutation = useCreateInteraction();
  const createTransactionMutation = useCreateContactTransaction();
  const deactivateContact = useDeactivateContact();
  const reactivateContact = useReactivateContact();
  const [form, setForm] = useState<ContactFormState>(emptyForm());
  const [interactionForm, setInteractionForm] = useState<InteractionFormState>(emptyInteractionForm());
  const [transactionForm, setTransactionForm] = useState<TransactionFormState>(emptyTransactionForm());
  const [formError, setFormError] = useState<string | null>(null);
  const initialTab = typeof panel.props?.initialTab === "string" ? panel.props.initialTab : undefined;

  const data = contactQuery.data;
  const contact = data?.contact;
  const accountsQuery = useQuery({
    queryKey: ["contact-panel-accounts", orgId],
    enabled: !!orgId && !!contactId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("accounts").select("id,name").eq("is_active", true).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const initialTxType = panel.props?.initialTxType === "payment" ? "payment" : panel.props?.initialTxType === "receipt" ? "receipt" : null;
    if (initialTxType) setTransactionForm((prev) => ({ ...prev, type: initialTxType }));
  }, [panel.props?.initialTxType]);

  useEffect(() => {
    if (mode === "create") {
      const initialName = typeof panel.props?.initialName === "string" ? panel.props.initialName : "";
      const initialType = panel.props?.initialType === "supplier" || panel.props?.initialType === "both" ? panel.props.initialType : "customer";
      setForm({ ...emptyForm(), name: initialName, type: initialType });
      return;
    }
    if (contact) {
      setForm({
        firstName: typeof contact.meta.first_name === "string" ? contact.meta.first_name : "",
        lastName: typeof contact.meta.last_name === "string" ? contact.meta.last_name : "",
        name: contact.name,
        phone: contact.phone ?? "",
        type: contact.type,
        email: typeof contact.meta.email === "string" ? contact.meta.email : "",
        birthDate: typeof contact.meta.birth_date === "string" ? contact.meta.birth_date : "",
        nationalCode: typeof contact.meta.national_code === "string" ? contact.meta.national_code : "",
        jobTitle: typeof contact.meta.job_title === "string" ? contact.meta.job_title : "",
        gender: typeof contact.meta.gender === "string" ? contact.meta.gender : "",
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
          first_name: form.firstName,
          last_name: form.lastName,
          email: form.email,
          birth_date: form.birthDate,
          national_code: form.nationalCode,
          job_title: form.jobTitle,
          gender: form.gender,
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
            first_name: form.firstName,
            last_name: form.lastName,
            email: form.email,
            birth_date: form.birthDate,
            national_code: form.nationalCode,
            job_title: form.jobTitle,
            gender: form.gender,
          },
        });
        setMode("view");
      }
    } catch (error) {
      setFormError((error as Error).message);
    }
  }

  async function handleCreateInteraction() {
    setFormError(null);
    if (!contactId || !orgId) return;
    if (!interactionForm.title.trim() && !interactionForm.description.trim()) {
      setFormError("برای تعامل، عنوان یا توضیح را وارد کنید.");
      return;
    }
    await createInteractionMutation.mutateAsync({
      org_id: orgId,
      contact_id: contactId,
      type: interactionForm.type,
      title: interactionForm.title,
      description: interactionForm.description,
      next_followup: interactionForm.nextFollowup,
    });
    setInteractionForm(emptyInteractionForm());
  }

  async function handleCreateTransaction() {
    setFormError(null);
    if (!contactId || !orgId) return;
    if (!transactionForm.amountToman || transactionForm.amountToman <= 0) {
      setFormError("مبلغ تراکنش را وارد کنید.");
      return;
    }
    await createTransactionMutation.mutateAsync({
      org_id: orgId,
      branch_id: branchId,
      contact_id: contactId,
      type: transactionForm.type,
      amount_toman: transactionForm.amountToman,
      account_id: transactionForm.accountId,
      method: transactionForm.method,
      note: transactionForm.note,
    });
    setTransactionForm(emptyTransactionForm());
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

  const interactionColumns: Column<ContactInteraction>[] = [
    { key: "created_at", header: "تاریخ", render: (row) => <PersianDate value={row.created_at} /> },
    { key: "type", header: "نوع", render: (row) => <Badge tone="info">{INTERACTION_LABEL[row.type] ?? row.type}</Badge> },
    { key: "title", header: "عنوان", render: (row) => row.title ?? "—" },
    { key: "description", header: "یادداشت", render: (row) => <span className="whitespace-normal">{row.description ?? "—"}</span> },
    { key: "next", header: "پیگیری بعدی", render: (row) => row.next_followup ? <PersianDate value={row.next_followup} /> : "—" },
  ];

  const transactionColumns: Column<ContactTransaction>[] = [
    { key: "date", header: "تاریخ", render: (row) => <PersianDate value={row.date} /> },
    { key: "type", header: "نوع", render: (row) => <Badge tone={row.type === "receipt" || row.type === "income" ? "success" : "danger"}>{TRANSACTION_LABEL[row.type] ?? row.type}</Badge> },
    { key: "amount", header: "مبلغ", align: "left", render: (row) => <Money value={row.amount} tone={row.type === "receipt" || row.type === "income" ? "positive" : "negative"} /> },
    { key: "method", header: "روش", render: (row) => row.method ?? "—" },
    { key: "account", header: "حساب", render: (row) => row.account?.name ?? "—" },
    { key: "note", header: "یادداشت", render: (row) => <span className="whitespace-normal">{row.note ?? "—"}</span> },
  ];

  const formContent = (
    <div className="space-y-4">
      <Section title={isCreate ? "مخاطب جدید" : "ویرایش مخاطب"} description={isCreate ? contactHelp.pageIntro : undefined}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="نام" hint={contactHelp.firstName}>
            <Input value={form.firstName} onChange={(event) => {
              const firstName = event.target.value;
              setForm((prev) => ({ ...prev, firstName, name: [firstName, prev.lastName].filter(Boolean).join(" ") || prev.name }));
            }} />
          </Field>
          <Field label="نام خانوادگی" hint={contactHelp.lastName}>
            <Input value={form.lastName} onChange={(event) => {
              const lastName = event.target.value;
              setForm((prev) => ({ ...prev, lastName, name: [prev.firstName, lastName].filter(Boolean).join(" ") || prev.name }));
            }} />
          </Field>
          <Field label="نام نمایشی" required hint={contactHelp.displayName} error={formError && !form.name.trim() ? formError : null}>
            <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
          </Field>
          <Field label="کد" hint={contactHelp.code}>
            <Input value={contact?.code ?? "تولید خودکار"} disabled />
          </Field>
          <Field label="نوع" hint={contactHelp.type}>
            <Select value={form.type} onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value as ContactType }))}>
              <option value="customer">مشتری</option>
              <option value="supplier">تأمین‌کننده</option>
              <option value="both">هر دو</option>
            </Select>
          </Field>
          <Field label="شماره تماس" hint={contactHelp.phone}>
            <Input dir="ltr" className="text-left" value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} />
          </Field>
          <Field label="ایمیل" hint={contactHelp.email}>
            <Input dir="ltr" className="text-left" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} />
          </Field>
          <Field label="تاریخ تولد" hint={contactHelp.birthDate}>
            <DatePicker value={form.birthDate} onChange={(value) => setForm((prev) => ({ ...prev, birthDate: value }))} />
          </Field>
          <Field label="کد ملی" hint={contactHelp.nationalCode}>
            <Input dir="ltr" className="text-left" value={form.nationalCode} onChange={(event) => setForm((prev) => ({ ...prev, nationalCode: event.target.value }))} />
          </Field>
          <Field label="شغل / عنوان" hint={contactHelp.jobTitle}>
            <Input value={form.jobTitle} onChange={(event) => setForm((prev) => ({ ...prev, jobTitle: event.target.value }))} />
          </Field>
          <Field label="جنسیت">
            <Select value={form.gender} onChange={(event) => setForm((prev) => ({ ...prev, gender: event.target.value }))}>
              <option value="">—</option>
              <option value="female">خانم</option>
              <option value="male">آقا</option>
              <option value="other">سایر</option>
            </Select>
          </Field>
          <Field label="آدرس" hint={contactHelp.address} className="sm:col-span-2">
            <Input value={form.address} onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))} />
          </Field>
          <Field label="توضیحات" hint={contactHelp.description} className="sm:col-span-2">
            <Textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
          </Field>
        </div>
        {formError && form.name.trim() && <div className="mt-3 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{formError}</div>}
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
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={contact!.is_active ? "success" : "neutral"}>{contact!.is_active ? "فعال" : "غیرفعال"}</Badge>
          <Badge tone="primary">{TYPE_LABEL[contact!.type]}</Badge>
          {contact!.phone && <Badge tone="neutral"><Phone size={12} /> {contact!.phone}</Badge>}
        </div>
        <div className="flex flex-wrap gap-2">
          <PanelExitLink href={`/contacts/${contact!.id}`} className="btn-secondary min-h-9 rounded-xl px-3 py-1.5 text-xs">
            مشاهده صفحه کامل
          </PanelExitLink>
          <Button size="sm" variant="secondary" onClick={() => setMode("edit")}>ویرایش</Button>
          <Button size="sm" variant={contact!.is_active ? "danger" : "secondary"} loading={isToggling} onClick={toggleActive}>{contact!.is_active ? "غیرفعال‌سازی" : "فعال‌سازی"}</Button>
        </div>

        <Tabs
          defaultValue={initialTab}
          items={[
            {
              value: "summary",
              label: "خلاصه",
              content: (
                <div className="space-y-4">
                  <Section title="اطلاعات شخص">
                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                      <div><dt className="text-muted-foreground">نام</dt><dd className="font-bold text-foreground">{contact!.name}</dd></div>
                      <div><dt className="text-muted-foreground">کد</dt><dd className="font-mono" dir="ltr">{contact!.code ?? "—"}</dd></div>
                      <div><dt className="text-muted-foreground">تلفن</dt><dd dir="ltr" className="text-left sm:text-right">{contact!.phone ?? "—"}</dd></div>
                      <div><dt className="text-muted-foreground">موبایل</dt><dd dir="ltr" className="text-left sm:text-right">{contact!.mobile ?? "—"}</dd></div>
                      <div className="sm:col-span-2"><dt className="text-muted-foreground">آدرس</dt><dd>{contact!.address ?? "—"}</dd></div>
                    </dl>
                  </Section>

                  <Section title="مانده حساب" description={contactHelp.balance}>
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
            {
              value: "interactions",
              label: "تعاملات",
              content: (
                <div className="space-y-4">
                  <Section title="افزودن تعامل" description="ثبت یادداشت، تماس یا پیگیری. اطلاعات ذخیره می‌شود تا بعداً بدانید آخرین ارتباط شما با این مشتری چه بود.">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="نوع تعامل"><Select value={interactionForm.type} onChange={(e) => setInteractionForm((p) => ({ ...p, type: e.target.value }))}>
                        <option value="note">یادداشت</option><option value="call">تماس</option><option value="follow_up">پیگیری</option><option value="meeting">جلسه</option><option value="visit">بازدید</option><option value="email">ایمیل</option><option value="sms">پیامک</option><option value="complaint">شکایت</option>
                      </Select></Field>
                      <Field label="پیگیری بعدی"><DatePicker value={interactionForm.nextFollowup} onChange={(value) => setInteractionForm((p) => ({ ...p, nextFollowup: value }))} /></Field>
                      <Field label="عنوان" className="sm:col-span-2"><Input value={interactionForm.title} onChange={(e) => setInteractionForm((p) => ({ ...p, title: e.target.value }))} /></Field>
                      <Field label="یادداشت" className="sm:col-span-2"><Textarea value={interactionForm.description} onChange={(e) => setInteractionForm((p) => ({ ...p, description: e.target.value }))} /></Field>
                    </div>
                    {formError && <div className="mt-3 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{formError}</div>}
                    <div className="mt-4"><Button loading={createInteractionMutation.isPending} onClick={handleCreateInteraction}>ثبت تعامل</Button></div>
                  </Section>
                  {interactionsQuery.isLoading ? <Spinner /> : interactionsQuery.error ? <EmptyState title="خطا در دریافت تعاملات" description={(interactionsQuery.error as Error).message} /> : <DataTable rows={interactionsQuery.data ?? []} columns={interactionColumns} keyExtractor={(row) => row.id} empty={<EmptyState title="تعاملی برای این مخاطب ثبت نشده" />} />}
                </div>
              ),
            },
            {
              value: "transactions",
              label: "تراکنش‌ها",
              content: (
                <div className="space-y-4">
                  <Section title="ثبت تراکنش مستقل" description={contactHelp.directTransaction}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="نوع"><Select value={transactionForm.type} onChange={(e) => setTransactionForm((p) => ({ ...p, type: e.target.value as TransactionFormState["type"] }))}><option value="receipt">دریافت</option><option value="payment">پرداخت</option></Select></Field>
                      <Field label="مبلغ (تومان)"><NumberInput value={transactionForm.amountToman} onValueChange={(value) => setTransactionForm((p) => ({ ...p, amountToman: value }))} /></Field>
                      <Field label="حساب"><Select value={transactionForm.accountId} onChange={(e) => setTransactionForm((p) => ({ ...p, accountId: e.target.value }))}><option value="">انتخاب...</option>{accountsQuery.data?.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</Select></Field>
                      <Field label="روش"><Select value={transactionForm.method} onChange={(e) => setTransactionForm((p) => ({ ...p, method: e.target.value }))}><option value="cash">نقد</option><option value="card">کارت</option><option value="transfer">انتقال</option><option value="cheque">چک</option><option value="other">سایر</option></Select></Field>
                      <Field label="یادداشت" className="sm:col-span-2"><Input value={transactionForm.note} onChange={(e) => setTransactionForm((p) => ({ ...p, note: e.target.value }))} /></Field>
                    </div>
                    {formError && <div className="mt-3 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{formError}</div>}
                    <div className="mt-4"><Button loading={createTransactionMutation.isPending} onClick={handleCreateTransaction}>ثبت تراکنش</Button></div>
                  </Section>
                  {transactionsQuery.isLoading ? <Spinner /> : transactionsQuery.error ? <EmptyState title="خطا در دریافت تراکنش‌ها" description={(transactionsQuery.error as Error).message} /> : <DataTable rows={transactionsQuery.data ?? []} columns={transactionColumns} keyExtractor={(row) => row.id} empty={<EmptyState title="تراکنشی برای این مخاطب ثبت نشده" />} />}
                </div>
              ),
            },
          ]}
        />
      </div>
    </PanelShell>
  );
}
