"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift, MessageCircle, Plus, Search, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { EmptyState, Modal, PageHeader, Spinner } from "@/components/shared/ui";
import { EntityActionMenu } from "@/components/shared/entity-action-menu";
import { EntityLink } from "@/components/shared/entity-link";
import { PhoneLink } from "@/components/shared/phone-link";
import { formatToman, normalizeSearchText, toEnDigits, toFaDigits, toJalali, tomanToRial } from "@/lib/utils/format";
import { logActivity } from "@/lib/utils/activity-log";

type LoyaltyMode = "overview" | "points" | "wallet" | "campaigns" | "settings";

const MODE: Record<LoyaltyMode, { title: string; subtitle: string }> = {
  overview: { title: "باشگاه مشتریان", subtitle: "امتیاز، اعتبار، مشتریان VIP و کمپین‌های وفاداری" },
  points: { title: "امتیاز مشتریان", subtitle: "امتیاز بر اساس مجموع خرید مشتری" },
  wallet: { title: "کیف پول و اعتبار مشتری", subtitle: "مدیریت اعتبار قابل استفاده مشتریان" },
  campaigns: { title: "کمپین‌های مشتریان", subtitle: "لیست‌های آماده برای پیامک، واتساپ و پیگیری" },
  settings: { title: "تنظیمات باشگاه مشتریان", subtitle: "تعریف بازه و قوانین VIP، وفادار، غیرفعال و امتیازدهی" },
};

type LoyaltyRow = {
  contact: any;
  total: number;
  count: number;
  lastDate: string | null;
  points: number;
  walletCredit: number;
  segment: "VIP" | "وفادار" | "عادی" | "غیرفعال";
};

type LoyaltySettings = {
  period_days: number;
  vip_amount: number;
  loyal_invoice_count: number;
  inactive_days: number;
  point_per_rial: number;
};

const DEFAULT_LOYALTY_SETTINGS: LoyaltySettings = {
  period_days: 365,
  vip_amount: 50_000_000,
  loyal_invoice_count: 3,
  inactive_days: 90,
  point_per_rial: 1_000_000,
};

function calcSegment(total: number, count: number, lastDate: string | null, settings: LoyaltySettings): LoyaltyRow["segment"] {
  const daysSince = lastDate ? Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000) : null;
  if (total >= settings.vip_amount) return "VIP";
  if (count >= settings.loyal_invoice_count) return "وفادار";
  if (daysSince !== null && daysSince > settings.inactive_days) return "غیرفعال";
  return "عادی";
}

export function LoyaltyPage({ mode }: { mode: LoyaltyMode }) {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [walletContact, setWalletContact] = useState<LoyaltyRow | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["loyalty-page", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const [{ data: contacts, error: contactsError }, { data: sales, error: salesError }, { data: settingRow, error: settingsError }] = await Promise.all([
        supabase.from("contacts").select("id,name,phone,type,meta,created_at").eq("is_active", true).order("created_at", { ascending: false }).limit(1000),
        supabase.from("sales").select("id,customer_id,total,date").eq("status", "confirmed").order("date", { ascending: false }).limit(5000),
        supabase.from("settings").select("value").eq("key", "loyalty_settings").maybeSingle(),
      ]);
      if (contactsError) throw contactsError;
      if (salesError) throw salesError;
      if (settingsError) throw settingsError;
      return { contacts: contacts ?? [], sales: sales ?? [], settings: { ...DEFAULT_LOYALTY_SETTINGS, ...((settingRow?.value as Partial<LoyaltySettings>) ?? {}) } as LoyaltySettings };
    },
  });

  const rows = useMemo<LoyaltyRow[]>(() => {
    const salesByContact = new Map<string, { total: number; count: number; lastDate: string | null }>();
    const settings = data?.settings ?? DEFAULT_LOYALTY_SETTINGS;
    const periodStart = Date.now() - settings.period_days * 86400000;
    (data?.sales ?? []).forEach((sale: any) => {
      if (!sale.customer_id) return;
      if (settings.period_days > 0 && new Date(sale.date).getTime() < periodStart) return;
      const current = salesByContact.get(sale.customer_id) ?? { total: 0, count: 0, lastDate: null };
      current.total += sale.total ?? 0;
      current.count += 1;
      if (!current.lastDate || new Date(sale.date) > new Date(current.lastDate)) current.lastDate = sale.date;
      salesByContact.set(sale.customer_id, current);
    });

    return (data?.contacts ?? [])
      .map((contact: any) => {
        const stat = salesByContact.get(contact.id) ?? { total: 0, count: 0, lastDate: null };
        const walletCredit = Number(contact.meta?.wallet_credit ?? 0) || 0;
        return {
          contact,
          total: stat.total,
          count: stat.count,
          lastDate: stat.lastDate,
          points: Math.floor(stat.total / settings.point_per_rial),
          walletCredit,
          segment: calcSegment(stat.total, stat.count, stat.lastDate, settings),
        };
      })
      .filter((row) => {
        const t = normalizeSearchText(search);
        if (!t) return true;
        return normalizeSearchText(`${row.contact.name} ${row.contact.phone ?? ""}`).includes(t);
      })
      .sort((a, b) => (mode === "wallet" ? b.walletCredit - a.walletCredit : b.points - a.points));
  }, [data, search, mode]);

  if (mode === "settings") return <LoyaltySettingsPage settings={data?.settings ?? DEFAULT_LOYALTY_SETTINGS} orgId={orgId} />;

  if (isLoading) return <Spinner label="در حال بارگذاری باشگاه مشتریان..." />;
  if (error) return <div className="rounded-xl bg-destructive/10 text-destructive p-4 text-sm">{(error as Error).message}</div>;

  const totalPoints = rows.reduce((sum, row) => sum + row.points, 0);
  const totalWallet = rows.reduce((sum, row) => sum + row.walletCredit, 0);
  const vipRows = rows.filter((row) => row.segment === "VIP");
  const inactiveRows = rows.filter((row) => row.segment === "غیرفعال");
  const birthdayRows = rows.filter((row) => {
    const birth = row.contact.meta?.birth_date;
    if (!birth) return false;
    return String(birth).slice(5, 7) === new Date().toISOString().slice(5, 7);
  });

  const campaignRows = mode === "campaigns" ? [
    { title: "مشتریان VIP", hint: "مناسب پیام تخفیف اختصاصی", rows: vipRows },
    { title: "مشتریان غیرفعال", hint: "مناسب کمپین بازگشت مشتری", rows: inactiveRows },
    { title: "تولدهای این ماه", hint: "مناسب پیام تبریک و هدیه", rows: birthdayRows },
  ] : [];

  return (
    <div className="space-y-5">
      <PageHeader title={MODE[mode].title} subtitle={MODE[mode].subtitle} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-sm shadow-slate-900/[0.04] backdrop-blur transition hover:-translate-y-0.5 hover:shadow-lg"><div className="text-xs text-muted-foreground">اعضا</div><div className="text-xl font-bold text-foreground mt-1">{toFaDigits(rows.length)}</div></div>
        <div className="rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-sm shadow-slate-900/[0.04] backdrop-blur transition hover:-translate-y-0.5 hover:shadow-lg"><div className="text-xs text-muted-foreground">امتیاز کل</div><div className="text-xl font-bold text-primary mt-1">{toFaDigits(totalPoints)}</div></div>
        <div className="rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-sm shadow-slate-900/[0.04] backdrop-blur transition hover:-translate-y-0.5 hover:shadow-lg"><div className="text-xs text-muted-foreground">اعتبار کل</div><div className="text-xl font-bold text-success-onSoft mt-1">{formatToman(totalWallet, false)}</div></div>
        <div className="rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-sm shadow-slate-900/[0.04] backdrop-blur transition hover:-translate-y-0.5 hover:shadow-lg"><div className="text-xs text-muted-foreground">VIP</div><div className="text-xl font-bold text-warning-onSoft mt-1">{toFaDigits(vipRows.length)}</div></div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={17} />
        <input className="input pr-10" placeholder="جستجوی نام یا تلفن..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {mode === "campaigns" ? (
        <div className="space-y-4">
          {campaignRows.map((campaign) => (
            <div key={campaign.title} className="rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-sm shadow-slate-900/[0.04] backdrop-blur transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="flex items-center gap-2 mb-3"><MessageCircle size={17} className="text-primary" /><div><h3 className="font-bold text-foreground">{campaign.title}</h3><p className="text-xs text-muted-foreground">{campaign.hint}</p></div></div>
              {!campaign.rows.length ? <EmptyState title="موردی وجود ندارد" /> : <CustomerRows rows={campaign.rows} onWallet={setWalletContact} />}
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? <EmptyState icon={Gift} title="مشتری یافت نشد" /> : <CustomerRows rows={rows} onWallet={setWalletContact} />}

      {walletContact && <WalletModal row={walletContact} onClose={() => { setWalletContact(null); qc.invalidateQueries({ queryKey: ["loyalty-page"] }); }} />}
    </div>
  );
}


function LoyaltySettingsPage({ settings, orgId }: { settings: LoyaltySettings; orgId: string | null }) {
  const qc = useQueryClient();
  const [periodDays, setPeriodDays] = useState(String(settings.period_days));
  const [vipAmount, setVipAmount] = useState(String(Math.round(settings.vip_amount / 10)));
  const [loyalCount, setLoyalCount] = useState(String(settings.loyal_invoice_count));
  const [inactiveDays, setInactiveDays] = useState(String(settings.inactive_days));
  const [pointPerToman, setPointPerToman] = useState(String(Math.round(settings.point_per_rial / 10)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!orgId) return;
    setSaving(true); setError(null);
    const value: LoyaltySettings = {
      period_days: Number(toEnDigits(periodDays)) || 365,
      vip_amount: tomanToRial(Number(toEnDigits(vipAmount)) || 0),
      loyal_invoice_count: Number(toEnDigits(loyalCount)) || 1,
      inactive_days: Number(toEnDigits(inactiveDays)) || 90,
      point_per_rial: tomanToRial(Number(toEnDigits(pointPerToman)) || 100000),
    };
    const supabase = createClient();
    try {
      const { error } = await supabase.from("settings").upsert({ org_id: orgId, key: "loyalty_settings", value }, { onConflict: "org_id,key" });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["loyalty-page"] });
      await logActivity({ orgId, action: "update", entityType: "loyalty_settings", newData: value as any });
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-5">
      <PageHeader title={MODE.settings.title} subtitle={MODE.settings.subtitle} />
      <div className="rounded-[24px] border border-white/80 bg-white/90 p-5 shadow-sm shadow-slate-900/[0.04] backdrop-blur">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="label">بازه محاسبه خریدها (روز)</label><input className="input" inputMode="numeric" value={periodDays} onChange={(e) => setPeriodDays(e.target.value)} /><p className="text-xs text-muted-foreground mt-1">مثلاً 365 یعنی خریدهای یک سال اخیر</p></div>
          <div><label className="label">حداقل خرید VIP (تومان)</label><input className="input" inputMode="numeric" value={vipAmount} onChange={(e) => setVipAmount(e.target.value)} /></div>
          <div><label className="label">حداقل تعداد فاکتور برای وفادار</label><input className="input" inputMode="numeric" value={loyalCount} onChange={(e) => setLoyalCount(e.target.value)} /></div>
          <div><label className="label">غیرفعال بعد از چند روز بدون خرید</label><input className="input" inputMode="numeric" value={inactiveDays} onChange={(e) => setInactiveDays(e.target.value)} /></div>
          <div><label className="label">هر چند تومان = یک امتیاز</label><input className="input" inputMode="numeric" value={pointPerToman} onChange={(e) => setPointPerToman(e.target.value)} /></div>
        </div>
        {error && <div className="rounded-xl bg-destructive/10 text-destructive text-sm p-3 mt-4">{error}</div>}
        <button onClick={save} disabled={saving} className="btn-primary mt-5">ذخیره قوانین باشگاه</button>
      </div>
    </div>
  );
}

function CustomerRows({ rows, onWallet }: { rows: LoyaltyRow[]; onWallet: (row: LoyaltyRow) => void }) {
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.contact.id} className="flex items-center justify-between gap-3 rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-sm shadow-slate-900/[0.04] backdrop-blur transition hover:bg-primary/[0.03]">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <EntityLink type="contact" id={row.contact.id}>{row.contact.name}</EntityLink>
              <span className="badge bg-primary/10 text-primary">{row.segment}</span>
              <span className="badge bg-warning-soft text-warning-onSoft"><Gift size={12} /> {toFaDigits(row.points)} امتیاز</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-3">
              {row.contact.phone && <PhoneLink phone={row.contact.phone} />}
              <span>فاکتور: {toFaDigits(row.count)}</span>
              <span>آخرین خرید: {row.lastDate ? toJalali(row.lastDate) : "—"}</span>
              <span>اعتبار: {formatToman(row.walletCredit, false)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => onWallet(row)} className="btn-secondary text-sm"><Wallet size={14} /> اعتبار</button>
            <EntityActionMenu type="contact" id={row.contact.id} label={row.contact.name} phone={row.contact.phone} />
          </div>
        </div>
      ))}
    </div>
  );
}

function WalletModal({ row, onClose }: { row: LoyaltyRow; onClose: () => void }) {
  const { orgId } = useOrg();
  const [amount, setAmount] = useState(String(Math.round(row.walletCredit / 10)));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const credit = tomanToRial(Number(toEnDigits(amount)) || 0);
    setSaving(true);
    const supabase = createClient();
    try {
      const nextMeta = { ...(row.contact.meta ?? {}), wallet_credit: credit, wallet_note: note || null };
      const { error } = await supabase.from("contacts").update({ meta: nextMeta }).eq("id", row.contact.id);
      if (error) throw error;
      await logActivity({ orgId, action: "update", entityType: "contact", entityId: row.contact.id, oldData: { wallet_credit: row.walletCredit }, newData: { wallet_credit: credit, note } });
      onClose();
    } catch (e) { setError((e as Error).message); setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title="اعتبار مشتری" size="md">
      <div className="space-y-4">
        <div className="rounded-xl bg-muted p-3"><EntityLink type="contact" id={row.contact.id}>{row.contact.name}</EntityLink><div className="text-xs text-muted-foreground mt-1">اعتبار فعلی: {formatToman(row.walletCredit)}</div></div>
        <div><label className="label">اعتبار جدید (تومان)</label><input className="input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <div><label className="label">توضیح</label><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
        {error && <div className="rounded-xl bg-destructive/10 text-destructive text-sm p-3">{error}</div>}
        <div className="flex gap-2"><button onClick={save} disabled={saving} className="btn-primary flex-1">ذخیره اعتبار</button><button onClick={onClose} className="btn-secondary">انصراف</button></div>
      </div>
    </Modal>
  );
}
