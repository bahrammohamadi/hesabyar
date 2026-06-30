"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Gift, Plus, Search, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { EmptyState, Modal, PageHeader, Spinner } from "@/components/shared/ui";
import { EntityActionMenu } from "@/components/shared/entity-action-menu";
import { EntityLink } from "@/components/shared/entity-link";
import { PhoneLink } from "@/components/shared/phone-link";
import { formatToman, toFaDigits, toJalali } from "@/lib/utils/format";

type CrmMode = "overview" | "interactions" | "segments" | "loyalty";

const MODE: Record<CrmMode, { title: string; subtitle: string }> = {
  overview: { title: "CRM و باشگاه مشتریان", subtitle: "نمای کلی مشتریان، تعاملات، امتیاز و گروه‌بندی" },
  interactions: { title: "تعاملات مشتریان", subtitle: "تماس‌ها، یادداشت‌ها، پیگیری‌ها و سوابق ارتباط" },
  segments: { title: "گروه‌بندی مشتریان", subtitle: "VIP، وفادار، عادی و غیرفعال بر اساس خرید" },
  loyalty: { title: "باشگاه مشتریان", subtitle: "امتیاز خرید و ارزش مشتری بر اساس فاکتورهای ثبت‌شده" },
};

export function CrmPage({ mode }: { mode: CrmMode }) {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
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
      return `${row.contact.name} ${row.contact.phone ?? ""}`.toLowerCase().includes(t);
    }).sort((a, b) => b.total - a.total);
  }, [data, search]);

  if (isLoading) return <Spinner label="در حال بارگذاری CRM..." />;
  if (error) return <div className="rounded-xl bg-rose-50 text-rose-700 p-4 text-sm">{(error as Error).message}</div>;

  const vipCount = rows.filter((r) => r.segment === "VIP").length;
  const inactiveCount = rows.filter((r) => r.segment === "غیرفعال").length;
  const totalValue = rows.reduce((sum, row) => sum + row.total, 0);

  return (
    <div>
      <PageHeader
        title={MODE[mode].title}
        subtitle={MODE[mode].subtitle}
        action={<button onClick={() => setInteractionOpen(true)} className="btn-primary"><Plus size={16} /> تعامل جدید</button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="card p-4"><div className="text-xs text-slate-500">کل مشتریان</div><div className="text-xl font-bold text-slate-800 mt-1">{toFaDigits(rows.length)}</div></div>
        <div className="card p-4"><div className="text-xs text-slate-500">مشتریان VIP</div><div className="text-xl font-bold text-brand-600 mt-1">{toFaDigits(vipCount)}</div></div>
        <div className="card p-4"><div className="text-xs text-slate-500">غیرفعال</div><div className="text-xl font-bold text-rose-600 mt-1">{toFaDigits(inactiveCount)}</div></div>
        <div className="card p-4"><div className="text-xs text-slate-500">ارزش خرید</div><div className="text-xl font-bold text-emerald-600 mt-1">{formatToman(totalValue, false)}</div></div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
        <input className="input pr-10" placeholder="جستجوی نام یا تلفن مشتری..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {mode === "interactions" ? (
        <InteractionsList interactions={data?.interactions ?? []} contacts={data?.contacts ?? []} />
      ) : (
        <div className="space-y-2">
          {rows.length === 0 ? <EmptyState icon={Users} title="مشتری یافت نشد" /> : rows.map((row) => (
            <div key={row.contact.id} className="card p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <EntityLink type="contact" id={row.contact.id}>{row.contact.name}</EntityLink>
                  <span className="badge bg-brand-100 text-brand-700">{row.segment}</span>
                  <span className="badge bg-amber-100 text-amber-700"><Gift size={12} /> {toFaDigits(row.points)} امتیاز</span>
                </div>
                <div className="text-xs text-slate-400 mt-1 flex flex-wrap gap-3">
                  {row.contact.phone && <PhoneLink phone={row.contact.phone} />}
                  <span>فاکتور: {toFaDigits(row.count)}</span>
                  <span>آخرین خرید: {row.lastDate ? toJalali(row.lastDate) : "—"}</span>
                  <span>آخرین تعامل: {row.lastInteraction?.title ?? row.lastInteraction?.type ?? "—"}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-left"><div className="font-bold text-slate-800">{formatToman(row.total, false)}</div><div className="text-xs text-slate-400">مجموع خرید</div></div>
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

function InteractionsList({ interactions, contacts }: { interactions: any[]; contacts: any[] }) {
  const contactMap = new Map(contacts.map((c: any) => [c.id, c]));
  if (!interactions.length) return <EmptyState icon={Activity} title="تعامل ثبت نشده" />;
  return (
    <div className="space-y-2">
      {interactions.map((interaction) => {
        const contact = contactMap.get(interaction.contact_id);
        return (
          <div key={interaction.id} className="card p-4 flex items-center justify-between gap-3">
            <div>
              <div className="font-medium text-slate-800">{interaction.title || interaction.type}</div>
              <div className="text-xs text-slate-400 mt-1">{contact ? <EntityLink type="contact" id={contact.id}>{contact.name}</EntityLink> : "—"} • {toJalali(interaction.created_at, true)}</div>
              {interaction.description && <div className="text-sm text-slate-500 mt-2">{interaction.description}</div>}
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
        <div><label className="label">مشتری</label><select className="input" value={contactId} onChange={(e) => setContactId(e.target.value)}><option value="">انتخاب...</option>{contacts.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><label className="label">نوع تعامل</label><select className="input" value={type} onChange={(e) => setType(e.target.value)}><option value="note">یادداشت</option><option value="call">تماس</option><option value="sms">پیامک</option><option value="follow_up">پیگیری</option><option value="complaint">شکایت</option></select></div>
        <div><label className="label">عنوان</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div><label className="label">توضیحات</label><textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        {error && <div className="rounded-xl bg-rose-50 text-rose-700 text-sm p-3">{error}</div>}
        <div className="flex gap-2"><button onClick={save} disabled={saving} className="btn-primary flex-1">ثبت</button><button onClick={onClose} className="btn-secondary">انصراف</button></div>
      </div>
    </Modal>
  );
}
