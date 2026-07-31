"use client";

import { useMemo, useState } from "react";
import dayjs from "dayjs";
import jalaliday from "jalaliday";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Download, Gift, Plus, Search, Star, UserMinus, Users, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { EmptyState, Modal, PageHeader, Spinner } from "@/components/shared/ui";
import { EntityActionMenu } from "@/components/shared/entity-action-menu";
import { Badge } from "@/src/shared/ui";
import { CrmKpiCard, CustomerTierBadge } from "@/app/(app)/contacts/components/ContactsPieces";
import { EntityLink } from "@/components/shared/entity-link";
import { PhoneLink } from "@/components/shared/phone-link";
import { formatToman, normalizeSearchText, toFaDigits, toJalali } from "@/lib/utils/format";

dayjs.extend(jalaliday);

type CrmMode = "overview" | "interactions" | "segments" | "loyalty";

const MODE: Record<CrmMode, { title: string; subtitle: string }> = {
  overview: { title: "CRM و باشگاه مشتریان", subtitle: "نمای کلی مشتریان، تعاملات، امتیاز و گروه‌بندی" },
  interactions: { title: "تعاملات مشتریان", subtitle: "تماس‌ها، یادداشت‌ها، پیگیری‌ها و سوابق ارتباط" },
  segments: { title: "گروه‌بندی مشتریان", subtitle: "VIP، وفادار، عادی و غیرفعال بر اساس خرید" },
  loyalty: { title: "باشگاه مشتریان", subtitle: "امتیاز خرید و ارزش مشتری بر اساس فاکتورهای ثبت‌شده" },
};

function downloadCsv(filename: string, rows: { name: string; phone: string | null }[]) {
  const csvRows = ["name,phone", ...rows.map((row) => `"${String(row.name ?? "").replace(/"/g, '""')}","${String(row.phone ?? "").replace(/"/g, '""')}"`)];
  const blob = new Blob(["\ufeff" + csvRows.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function normalizePhone(phone?: string | null) {
  const digits = String(phone ?? "").replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))).replace(/[^0-9]/g, "");
  if (!digits) return null;
  if (digits.startsWith("9") && digits.length === 10) return `0${digits}`;
  return digits;
}

function daysUntilJalaliBirthday(birthDate?: string | null) {
  if (!birthDate) return null;
  const normalized = String(birthDate).replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
  const match = normalized.match(/^(13|14)\d{2}[/-](\d{2})[/-](\d{2})$/);
  if (!match) return null;
  const month = Number(match[2]);
  const day = Number(match[3]);
  // @ts-ignore - jalaliday calendar typing is incomplete
  const today = (dayjs() as any).calendar("jalali");
  const thisYear = today.year();
  const make = (year: number) => {
    // @ts-ignore
    return (dayjs() as any).calendar("jalali").set("year", year).set("month", month - 1).set("date", day).startOf("day");
  };
  let next = make(thisYear);
  if (next.diff(today.startOf("day"), "day") < 0) next = make(thisYear + 1);
  return next.diff(today.startOf("day"), "day");
}

export function CrmPage({ mode }: { mode: CrmMode }) {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [birthdayDays, setBirthdayDays] = useState(30);
  const [inactiveDays, setInactiveDays] = useState(90);
  const [walletThresholdToman, setWalletThresholdToman] = useState(50000);
  const [interactionOpen, setInteractionOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["crm-overview", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const [{ data: contacts, error: contactsError }, { data: sales, error: salesError }, { data: interactions, error: interactionsError }] = await Promise.all([
        supabase.from("contacts").select("id,name,phone,type,created_at,meta").eq("is_active", true).order("created_at", { ascending: false }).limit(1000),
        supabase.from("sales").select("id,customer_id,total,date").eq("status", "confirmed").order("date", { ascending: false }).limit(5000),
        supabase.from("contact_interactions").select("id,contact_id,type,title,description,next_followup,created_at").order("created_at", { ascending: false }).limit(500),
      ]);
      if (contactsError) throw contactsError;
      if (salesError) throw salesError;
      if (interactionsError) throw interactionsError;
      return { contacts: contacts ?? [], sales: sales ?? [], interactions: interactions ?? [] };
    },
  });

  const rows = useMemo(() => {
    const contacts = data?.contacts ?? [];
    const sales = data?.sales ?? [];
    const interactions = data?.interactions ?? [];
    const salesByContact = new Map<string, { total: number; count: number; lastDate: string | null }>();
    sales.forEach((sale: any) => {
      if (!sale.customer_id) return;
      const current = salesByContact.get(sale.customer_id) ?? { total: 0, count: 0, lastDate: null };
      current.total += sale.total ?? 0;
      current.count += 1;
      if (!current.lastDate || new Date(sale.date) > new Date(current.lastDate)) current.lastDate = sale.date;
      salesByContact.set(sale.customer_id, current);
    });
    const lastInteraction = new Map<string, any>();
    interactions.forEach((interaction: any) => {
      if (!lastInteraction.has(interaction.contact_id)) lastInteraction.set(interaction.contact_id, interaction);
    });

    return contacts.map((contact: any) => {
      const stat = salesByContact.get(contact.id) ?? { total: 0, count: 0, lastDate: null };
      const daysSince = stat.lastDate ? Math.floor((Date.now() - new Date(stat.lastDate).getTime()) / 86400000) : null;
      const segment = stat.total >= 50_000_000 ? "VIP" : stat.count >= 3 ? "وفادار" : daysSince !== null && daysSince > 90 ? "غیرفعال" : "عادی";
      const points = Math.floor(stat.total / 1_000_000);
      return { contact, ...stat, segment, points, lastInteraction: lastInteraction.get(contact.id) ?? null };
    }).filter((row) => {
      const t = search.trim().toLowerCase();
      if (!t) return true;
      return normalizeSearchText(`${row.contact.name} ${row.contact.phone ?? ""}`).includes(t);
    }).sort((a, b) => b.total - a.total);
  }, [data, search]);

  if (isLoading) return <Spinner label="در حال بارگذاری CRM..." />;
  if (error) return <div className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">{(error as Error).message}</div>;

  const vipCount = rows.filter((r) => r.segment === "VIP").length;
  const inactiveCount = rows.filter((r) => r.segment === "غیرفعال").length;
  const totalValue = rows.reduce((sum, row) => sum + row.total, 0);
  const birthdaySegment = rows.filter((row) => {
    const days = daysUntilJalaliBirthday(row.contact.meta?.birth_date);
    return days !== null && days >= 0 && days <= birthdayDays && normalizePhone(row.contact.phone);
  });
  const inactiveSegment = rows.filter((row) => (!row.lastDate || new Date(row.lastDate).getTime() < Date.now() - inactiveDays * 86400000) && normalizePhone(row.contact.phone));
  const walletSegment = rows.filter((row) => {
    const credit = Number(row.contact.meta?.wallet_credit ?? 0) || 0;
    return credit > 0 && credit <= walletThresholdToman * 10 && normalizePhone(row.contact.phone);
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title={MODE[mode].title}
        subtitle={MODE[mode].subtitle}
        action={<button onClick={() => setInteractionOpen(true)} className="btn-primary"><Plus size={16} /> تعامل جدید</button>}
      />

      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
        <CrmKpiCard label="کل مشتریان" value={toFaDigits(rows.length)} icon={Users} tone="primary" />
        <CrmKpiCard label="مشتریان VIP" value={toFaDigits(vipCount)} chip="ویژه" icon={Star} tone="accent" />
        <CrmKpiCard label="غیرفعال" value={toFaDigits(inactiveCount)} chip="بدون خرید" icon={UserMinus} tone="danger" />
        <CrmKpiCard label="ارزش خرید" value={formatToman(totalValue, false)} icon={Wallet} tone="info" />
      </div>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={17} />
        <input className="input pr-10" placeholder="جستجوی نام یا تلفن مشتری..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {mode === "segments" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <SegmentExportCard title="مشتریانی که تولدشان نزدیک است" value={birthdayDays} options={[7,14,30,60]} onChange={setBirthdayDays} rows={birthdaySegment.map((row) => ({ name: row.contact.name, phone: normalizePhone(row.contact.phone) }))} filename="birthday-segment.csv" emptyText="مشتری با تولد نزدیک یافت نشد" />
          <SegmentExportCard title="مشتریان غیرفعال / بدون خرید اخیر" value={inactiveDays} options={[30,60,90,180]} onChange={setInactiveDays} rows={inactiveSegment.map((row) => ({ name: row.contact.name, phone: normalizePhone(row.contact.phone) }))} filename="inactive-customers.csv" emptyText="مشتری غیرفعال در این بازه یافت نشد" />
          <SegmentExportCard title="اعتبار/کیف پول رو به اتمام" value={walletThresholdToman} options={[50000,100000,250000,500000]} onChange={setWalletThresholdToman} rows={walletSegment.map((row) => ({ name: row.contact.name, phone: normalizePhone(row.contact.phone) }))} filename="wallet-low-credit.csv" emptyText="داده‌ای یافت نشد" suffix="تومان" />
        </div>
      ) : mode === "interactions" ? (
        <InteractionsList interactions={data?.interactions ?? []} contacts={data?.contacts ?? []} />
      ) : (
        <div className="space-y-2">
          {rows.length === 0 ? <EmptyState icon={Users} title="مشتری یافت نشد" /> : rows.map((row) => (
            <div key={row.contact.id} className="flex items-center justify-between gap-3 rounded-[1.75rem] border border-border bg-card p-4 shadow-sm transition hover:border-primary/25 hover:bg-primary/[0.03]">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <EntityLink type="contact" id={row.contact.id}>{row.contact.name}</EntityLink>
                  <CustomerTierBadge tier={row.segment} />
                  <Badge tone="warning"><Gift size={12} /> {toFaDigits(row.points)} امتیاز</Badge>
                </div>
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {row.contact.phone && <PhoneLink phone={row.contact.phone} />}
                  <span>فاکتور: {toFaDigits(row.count)}</span>
                  <span>آخرین خرید: {row.lastDate ? toJalali(row.lastDate) : "—"}</span>
                  <span>آخرین تعامل: {row.lastInteraction?.title ?? row.lastInteraction?.type ?? "—"}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-left"><div className="font-extrabold tabular-nums text-foreground">{formatToman(row.total, false)}</div><div className="text-xs text-muted-foreground">مجموع خرید</div></div>
                <EntityActionMenu type="contact" id={row.contact.id} label={row.contact.name} phone={row.contact.phone} />
                <button onClick={() => { setSelectedContact(row.contact); setInteractionOpen(true); }} className="btn-secondary text-sm"><Activity size={14}/> تعامل</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {interactionOpen && <InteractionModal contact={selectedContact} contacts={data?.contacts ?? []} onClose={() => { setInteractionOpen(false); setSelectedContact(null); qc.invalidateQueries({ queryKey: ["crm-overview"] }); }} />}
    </div>
  );
}

function SegmentExportCard({ title, value, options, onChange, rows, filename, emptyText, suffix = "روز" }: { title: string; value: number; options: number[]; onChange: (value: number) => void; rows: { name: string; phone: string | null }[]; filename: string; emptyText: string; suffix?: string }) {
  const exportRows = rows.filter((row) => row.phone);
  return (
    <div className="rounded-[24px] border border-white/80 bg-white/90 p-5 shadow-sm shadow-slate-900/[0.04] backdrop-blur">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-black text-foreground">{title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{toFaDigits(exportRows.length)} مشتری یافت شد</p>
        </div>
        <Download className="text-primary" size={20} />
      </div>
      <select aria-label="انتخاب بازه" className="input mb-3" value={value} onChange={(event) => onChange(Number(event.target.value))}>
        {options.map((option) => <option key={option} value={option}>{toFaDigits(option)} {suffix}</option>)}
      </select>
      {exportRows.length === 0 ? <div className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">{emptyText}</div> : (
        <div className="mb-3 rounded-2xl bg-muted p-3 text-xs text-muted-foreground">
          نمونه: {exportRows.slice(0, 3).map((row) => `${row.name} (${row.phone})`).join("، ")}
        </div>
      )}
      <button className="btn-primary w-full" disabled={exportRows.length === 0} onClick={() => downloadCsv(filename, exportRows)}>دانلود CSV</button>
    </div>
  );
}

function InteractionsList({ interactions, contacts }: { interactions: any[]; contacts: any[] }) {
  const contactMap = new Map(contacts.map((c: any) => [c.id, c]));
  if (!interactions.length) return <EmptyState icon={Activity} title="تعامل ثبت نشده" />;
  return (
    <div className="space-y-2">
      {interactions.map((interaction) => {
        const contact = contactMap.get(interaction.contact_id);
        return (
          <div key={interaction.id} className="flex items-center justify-between gap-3 rounded-[1.75rem] border border-border bg-card p-4 shadow-sm transition hover:border-primary/25 hover:bg-primary/[0.03]">
            <div>
              <div className="font-medium text-foreground">{interaction.title || interaction.type}</div>
              <div className="text-xs text-muted-foreground mt-1">{contact ? <EntityLink type="contact" id={contact.id}>{contact.name}</EntityLink> : "—"} • {toJalali(interaction.created_at, true)}</div>
              {interaction.description && <div className="text-sm text-muted-foreground mt-2">{interaction.description}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function InteractionModal({ contact, contacts, onClose }: { contact: any | null; contacts: any[]; onClose: () => void }) {
  const { orgId } = useOrg();
  const [contactId, setContactId] = useState(contact?.id ?? "");
  const [type, setType] = useState("note");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!orgId || !contactId) { setError("مشتری را انتخاب کنید."); return; }
    setSaving(true);
    const supabase = createClient();
    try {
      const { error } = await supabase.from("contact_interactions").insert({ org_id: orgId, contact_id: contactId, type, title: title.trim() || null, description: description.trim() || null });
      if (error) throw error;
      onClose();
    } catch (e) { setError((e as Error).message); setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title="ثبت تعامل مشتری" size="md">
      <div className="space-y-4">
        <div><label className="label">مشتری</label><select aria-label="مشتری" className="input" value={contactId} onChange={(e) => setContactId(e.target.value)}><option value="">انتخاب...</option>{contacts.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><label className="label">نوع تعامل</label><select aria-label="نوع تعامل" className="input" value={type} onChange={(e) => setType(e.target.value)}><option value="note">یادداشت</option><option value="call">تماس</option><option value="sms">پیامک</option><option value="follow_up">پیگیری</option><option value="complaint">شکایت</option></select></div>
        <div><label className="label">عنوان</label><input aria-label="عنوان" className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div><label className="label">توضیحات</label><textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        {error && <div className="rounded-xl bg-destructive/10 text-destructive text-sm p-3">{error}</div>}
        <div className="flex gap-2"><button onClick={save} disabled={saving} className="btn-primary flex-1">ثبت</button><button onClick={onClose} className="btn-secondary">انصراف</button></div>
      </div>
    </Modal>
  );
}
