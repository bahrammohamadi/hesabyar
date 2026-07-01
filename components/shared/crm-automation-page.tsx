"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, CalendarDays, Gift, MessageCircle, Plus, Target, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { EmptyState, Modal, PageHeader, Spinner } from "@/components/shared/ui";
import { DatePicker } from "@/components/shared/date-picker";
import { EntityActionMenu } from "@/components/shared/entity-action-menu";
import { EntityLink } from "@/components/shared/entity-link";
import { PhoneLink } from "@/components/shared/phone-link";
import { formatToman, toFaDigits, toJalali } from "@/lib/utils/format";
import { logActivity } from "@/lib/utils/activity-log";

type AutomationType = "inactive" | "birthday" | "vip" | "wallet" | "followup";

type CampaignRow = {
  contact: any;
  reason: string;
  message: string;
  lastDate?: string | null;
  total?: number;
  walletCredit?: number;
  interaction?: any;
};

const DEFAULT_SETTINGS = { inactive_days: 90, vip_amount: 50_000_000 };

const AUTOMATIONS: { id: AutomationType; title: string; hint: string; icon: typeof Bell }[] = [
  { id: "inactive", title: "مشتریان خوابیده", hint: "مدتی خرید نکرده‌اند و باید پیگیری شوند", icon: Bell },
  { id: "birthday", title: "تولدهای نزدیک", hint: "مناسب پیام تبریک و هدیه", icon: CalendarDays },
  { id: "vip", title: "مشتریان VIP", hint: "مناسب پیشنهاد اختصاصی و حفظ مشتری", icon: Gift },
  { id: "wallet", title: "اعتبار استفاده‌نشده", hint: "اعتبار دارند؛ پیام یادآوری مصرف اعتبار", icon: Wallet },
  { id: "followup", title: "پیگیری‌های سررسید", hint: "تعاملاتی که موعد پیگیری‌شان رسیده", icon: Target },
];

function normalizePhone(phone?: string | null) {
  const clean = (phone ?? "").trim().replace(/[^\d+]/g, "");
  return clean.replace(/^0/, "98").replace(/^\+/, "");
}

function daysUntil(date: string) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const monthDay = date.slice(5, 10);
  let next = new Date(`${currentYear}-${monthDay}T12:00:00`);
  if (next.getTime() < now.getTime()) next = new Date(`${currentYear + 1}-${monthDay}T12:00:00`);
  return Math.ceil((next.getTime() - now.getTime()) / 86400000);
}

export function CrmAutomationPage() {
  const { orgId } = useOrg();
  const [active, setActive] = useState<AutomationType>("inactive");
  const [followupContact, setFollowupContact] = useState<CampaignRow | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["crm-automation", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const [{ data: contacts, error: contactsError }, { data: sales, error: salesError }, { data: interactions, error: interactionsError }, { data: settingsRow }] = await Promise.all([
        supabase.from("contacts").select("id,name,phone,type,meta,created_at").eq("is_active", true).order("created_at", { ascending: false }).limit(1000),
        supabase.from("sales").select("id,customer_id,total,date").eq("status", "confirmed").order("date", { ascending: false }).limit(5000),
        supabase.from("contact_interactions").select("id,contact_id,type,title,description,next_followup,created_at").order("created_at", { ascending: false }).limit(1000),
        supabase.from("settings").select("value").eq("key", "loyalty_settings").maybeSingle(),
      ]);
      if (contactsError) throw contactsError;
      if (salesError) throw salesError;
      if (interactionsError) throw interactionsError;
      return { contacts: contacts ?? [], sales: sales ?? [], interactions: interactions ?? [], settings: { ...DEFAULT_SETTINGS, ...((settingsRow?.value as any) ?? {}) } };
    },
  });

  const rowsByType = useMemo<Record<AutomationType, CampaignRow[]>>(() => {
    const contacts = data?.contacts ?? [];
    const sales = data?.sales ?? [];
    const interactions = data?.interactions ?? [];
    const inactiveDays = Number(data?.settings?.inactive_days ?? 90);
    const vipAmount = Number(data?.settings?.vip_amount ?? 50_000_000);
    const salesByContact = new Map<string, { total: number; count: number; lastDate: string | null }>();
    sales.forEach((sale: any) => {
      if (!sale.customer_id) return;
      const current = salesByContact.get(sale.customer_id) ?? { total: 0, count: 0, lastDate: null };
      current.total += sale.total ?? 0;
      current.count += 1;
      if (!current.lastDate || new Date(sale.date) > new Date(current.lastDate)) current.lastDate = sale.date;
      salesByContact.set(sale.customer_id, current);
    });
    const contactMap = new Map(contacts.map((c: any) => [c.id, c]));
    const now = Date.now();
    const inactive: CampaignRow[] = [];
    const birthday: CampaignRow[] = [];
    const vip: CampaignRow[] = [];
    const wallet: CampaignRow[] = [];
    const followup: CampaignRow[] = [];
    contacts.forEach((contact: any) => {
      const stat = salesByContact.get(contact.id) ?? { total: 0, count: 0, lastDate: null };
      const lastDays = stat.lastDate ? Math.floor((now - new Date(stat.lastDate).getTime()) / 86400000) : null;
      if (lastDays !== null && lastDays >= inactiveDays) inactive.push({ contact, lastDate: stat.lastDate, total: stat.total, reason: `${toFaDigits(lastDays)} روز از آخرین خرید گذشته`, message: `${contact.name} عزیز، مدتیه از خرید قبلی شما گذشته. برای شما پیشنهاد ویژه داریم.` });
      const birth = contact.meta?.birth_date;
      if (birth) {
        const days = daysUntil(String(birth));
        if (days <= 30) birthday.push({ contact, reason: `تولد تا ${toFaDigits(days)} روز آینده`, message: `${contact.name} عزیز، تولدتون نزدیکه؛ هدیه ویژه مهرجامه برای شما آماده است.` });
      }
      if (stat.total >= vipAmount) vip.push({ contact, total: stat.total, lastDate: stat.lastDate, reason: `خرید کل ${formatToman(stat.total)}`, message: `${contact.name} عزیز، شما از مشتریان ویژه ما هستید. پیشنهاد اختصاصی برای شما داریم.` });
      const credit = Number(contact.meta?.wallet_credit ?? 0) || 0;
      if (credit > 0) wallet.push({ contact, walletCredit: credit, reason: `اعتبار قابل استفاده ${formatToman(credit)}`, message: `${contact.name} عزیز، شما ${formatToman(credit)} اعتبار قابل استفاده دارید. فرصت استفاده را از دست ندهید.` });
    });
    interactions.forEach((interaction: any) => {
      if (!interaction.next_followup) return;
      if (new Date(interaction.next_followup).getTime() > now) return;
      const contact = contactMap.get(interaction.contact_id);
      if (!contact) return;
      followup.push({ contact, interaction, reason: `پیگیری سررسید: ${interaction.title ?? interaction.type}`, message: `${contact.name} عزیز، برای پیگیری سفارش/خرید قبلی با شما در تماس هستیم.` });
    });
    return { inactive, birthday, vip, wallet, followup };
  }, [data]);

  if (isLoading) return <Spinner label="در حال ساخت لیست‌های هوشمند..." />;
  if (error) return <div className="rounded-xl bg-rose-50 text-rose-700 p-4 text-sm">{(error as Error).message}</div>;
  const rows = rowsByType[active] ?? [];
  const activeDef = AUTOMATIONS.find((item) => item.id === active)!;
  const ActiveIcon = activeDef.icon;

  return (
    <div>
      <PageHeader title="اتوماسیون کمپین‌ها" subtitle="لیست‌های هوشمند مشتریان برای پیامک، واتساپ و پیگیری فروش" />
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-5">
        {AUTOMATIONS.map((item) => {
          const Icon = item.icon;
          const count = rowsByType[item.id]?.length ?? 0;
          return <button key={item.id} onClick={() => setActive(item.id)} className={`card p-4 text-right hover:border-primary/30 transition ${active === item.id ? "border-primary/40 bg-primary/[0.06]" : ""}`}><div className="flex items-center gap-2 mb-2"><Icon size={18} className="text-primary" /><span className="font-bold text-slate-800">{item.title}</span></div><div className="text-xs text-slate-500 leading-5">{item.hint}</div><div className="text-lg font-bold text-primary mt-3">{toFaDigits(count)}</div></button>;
        })}
      </div>
      <div className="card p-4 mb-4"><div className="flex items-center gap-2"><ActiveIcon size={18} className="text-primary" /><div><h2 className="font-bold text-slate-800">{activeDef.title}</h2><p className="text-xs text-slate-400 mt-1">{activeDef.hint}</p></div></div></div>
      {!rows.length ? <EmptyState icon={Bell} title="مشتری در این لیست نیست" /> : <div className="space-y-2">{rows.map((row) => <CampaignCard key={`${active}-${row.contact.id}-${row.interaction?.id ?? ""}`} row={row} onFollowup={setFollowupContact} />)}</div>}
      {followupContact && <FollowupModal row={followupContact} onClose={() => setFollowupContact(null)} />}
    </div>
  );
}

function CampaignCard({ row, onFollowup }: { row: CampaignRow; onFollowup: (row: CampaignRow) => void }) {
  const phone = normalizePhone(row.contact.phone);
  const sms = row.contact.phone ? `sms:${row.contact.phone}` : "#";
  const whatsapp = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(row.message)}` : "#";
  return <div className="card p-4 flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2 flex-wrap"><EntityLink type="contact" id={row.contact.id}>{row.contact.name}</EntityLink><span className="badge bg-primary/10 text-primary">{row.reason}</span></div><div className="text-sm text-slate-500 mt-2">{row.message}</div><div className="text-xs text-slate-400 mt-1 flex flex-wrap gap-3">{row.contact.phone && <PhoneLink phone={row.contact.phone} />}{row.lastDate && <span>آخرین خرید: {toJalali(row.lastDate)}</span>}{typeof row.total === "number" && <span>خرید: {formatToman(row.total, false)}</span>}{typeof row.walletCredit === "number" && <span>اعتبار: {formatToman(row.walletCredit, false)}</span>}</div></div><div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">{row.contact.phone && <a href={sms} className="btn-secondary text-sm">پیامک</a>}{phone && <a href={whatsapp} target="_blank" rel="noreferrer" className="btn-secondary text-sm">واتساپ</a>}<button onClick={() => onFollowup(row)} className="btn-primary text-sm"><Plus size={14} /> ثبت پیگیری</button><EntityActionMenu type="contact" id={row.contact.id} label={row.contact.name} phone={row.contact.phone} /></div></div>;
}

function FollowupModal({ row, onClose }: { row: CampaignRow; onClose: () => void }) {
  const { orgId } = useOrg();
  const [title, setTitle] = useState(row.reason);
  const [description, setDescription] = useState(row.message);
  const [nextDate, setNextDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  async function save() {
    if (!orgId) return;
    const supabase = createClient();
    try {
      const { error } = await supabase.from("contact_interactions").insert({ org_id: orgId, contact_id: row.contact.id, type: "follow_up", title, description, next_followup: nextDate ? new Date(`${nextDate}T12:00:00`).toISOString() : null });
      if (error) throw error;
      await logActivity({ orgId, action: "create", entityType: "interaction", entityId: row.contact.id, newData: { title, campaign: row.reason } });
      onClose();
    } catch (e) { setError((e as Error).message); }
  }
  return <Modal open onClose={onClose} title="ثبت پیگیری کمپین" size="md"><div className="space-y-4"><div className="rounded-xl bg-slate-50 p-3"><EntityLink type="contact" id={row.contact.id}>{row.contact.name}</EntityLink><div className="text-xs text-slate-400 mt-1">{row.reason}</div></div><div><label className="label">عنوان</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></div><div><label className="label">متن پیام/پیگیری</label><textarea className="input" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} /></div><div><label className="label">تاریخ پیگیری بعدی</label><DatePicker value={nextDate} onChange={setNextDate} /></div>{error && <div className="rounded-xl bg-rose-50 text-rose-700 p-3 text-sm">{error}</div>}<div className="flex gap-2"><button onClick={save} className="btn-primary flex-1">ثبت</button><button onClick={onClose} className="btn-secondary">انصراف</button></div></div></Modal>;
}
