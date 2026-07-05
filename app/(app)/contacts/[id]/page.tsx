"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { usePanelManager } from "@/src/core/panel-manager/panel-manager.store";
import { Spinner, Modal, EmptyState } from "@/components/shared/ui";
import { DatePicker } from "@/components/shared/date-picker";
import { EntityLink } from "@/components/shared/entity-link";
import { EntityActionMenu } from "@/components/shared/entity-action-menu";
import { PhoneLink } from "@/components/shared/phone-link";
import { formatToman, toFaDigits, toJalali, toEnDigits, tomanToRial } from "@/lib/utils/format";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight, User, Pencil, Loader2,
  MapPin, ArrowDownCircle, ArrowUpCircle,
  ShoppingBag, Truck, DollarSign, X, Plus
} from "lucide-react";
import type { ContactType } from "@/types/db";
import { getActionParam } from "@/lib/entities/action-router";

const TYPE_LABELS: Record<ContactType, string> = { customer: "مشتری", supplier: "تامین‌کننده", both: "هر دو" };

export default function ContactDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const qc = useQueryClient();
  const { openEntity } = usePanelManager();
  const [tab, setTab] = useState<"info"|"sales"|"purchases"|"tx">("info");
  const searchParams = useSearchParams();
  const [editOpen, setEditOpen] = useState(false);

  // اطلاعات شخص
  const { data: contact, isLoading } = useQuery({
    queryKey: ["contact-detail", id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("contacts").select("*").eq("id", id).single();
      if (error) throw error;
      return data as any;
    },
  });

  // مانده
  const { data: balance } = useQuery({
    queryKey: ["contact-balance", id],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase.from("contact_balances").select("balance").eq("contact_id", id).single();
      return (data as any)?.balance ?? 0;
    },
  });

  // فروش‌ها
  const { data: sales } = useQuery({
    queryKey: ["contact-sales", id],
    enabled: !!id && (contact?.type === "customer" || contact?.type === "both"),
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase.from("sales").select("id,invoice_no,date,total,paid_cash,paid_card,paid_credit,status").eq("customer_id", id).order("date", { ascending: false }).limit(50);
      return data ?? [];
    },
  });

  // خریدها
  const { data: purchases } = useQuery({
    queryKey: ["contact-purchases", id],
    enabled: !!id && (contact?.type === "supplier" || contact?.type === "both"),
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase.from("purchases").select("id,invoice_no,date,total,paid,status").eq("supplier_id", id).order("date", { ascending: false }).limit(50);
      return data ?? [];
    },
  });

  // تراکنش‌ها
  const { data: txs } = useQuery({
    queryKey: ["contact-txs", id],
    enabled: !!id,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase.from("transactions").select("id,type,amount,date,method,note,account:accounts!transactions_account_id_fkey(name)").eq("contact_id", id).order("date", { ascending: false }).limit(50);
      return data ?? [];
    },
  });


  useEffect(() => {
    if (!contact) return;
    const action = getActionParam(searchParams);
    if (action === "edit") setEditOpen(true);
    if (action === "interaction") openEntity("contact", id, { mode: "view", context: "workspace", props: { initialTab: "interactions" } });
    if (action === "receipt") openEntity("contact", id, { mode: "view", context: "workspace", props: { initialTab: "transactions", initialTxType: "receipt" } });
    if (action === "pay") openEntity("contact", id, { mode: "view", context: "workspace", props: { initialTab: "transactions", initialTxType: "payment" } });
    if (action === "payment") {
      openEntity("contact", id, { mode: "view", context: "workspace", props: { initialTab: "transactions", initialTxType: contact.type === "supplier" ? "payment" : "receipt" } });
    }
  }, [contact, searchParams]);

  if (isLoading) return <Spinner label="در حال بارگذاری..." />;
  if (!contact) return <EmptyState title="شخص یافت نشد" />;

  const bal = balance ?? 0;
  const isDebtor = bal > 0; const isCreditor = bal < 0;
  const totalSales = (sales ?? []).reduce((s: number, x: any) => s + (x.total ?? 0), 0);
  const totalPurchases = (purchases ?? []).reduce((s: number, x: any) => s + (x.total ?? 0), 0);

  function openContactPanel(initialTab: "interactions" | "transactions", initialTxType?: "receipt" | "payment") {
    openEntity("contact", id, { mode: "view", context: "workspace", title: contact.name, props: { initialTab, ...(initialTxType ? { initialTxType } : {}) } });
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <Link href="/contacts" className="flex items-center gap-1 text-slate-500 text-sm hover:text-primary">
          <ArrowRight size={18} /> بازگشت
        </Link>
        <div className="flex gap-2 flex-wrap">
          {contact.type !== "supplier" && (
            <button onClick={() => openContactPanel("transactions", "receipt")} className="btn btn-secondary flex items-center gap-2 text-sm">
              <ArrowDownCircle size={16} /> دریافت
            </button>
          )}
          {contact.type !== "customer" && (
            <button onClick={() => openContactPanel("transactions", "payment")} className="btn btn-secondary flex items-center gap-2 text-sm">
              <ArrowUpCircle size={16} /> پرداخت
            </button>
          )}
          <EntityActionMenu type="contact" id={id} label={contact.name} phone={contact.phone} />
          <button onClick={() => setEditOpen(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Pencil size={16} /> ویرایش
          </button>
        </div>
      </div>

      {/* کارت اصلی */}
      <div className="card p-6 mb-4">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/[0.06] text-primary flex items-center justify-center shrink-0">
            <User size={28} />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-800">{contact.name}</h1>
            <div className="flex flex-wrap gap-2 mt-1 text-sm text-slate-500">
              {(contact as any).code && <span className="font-mono bg-slate-100 px-2 py-0.5 rounded">کد: {(contact as any).code}</span>}
              <span className={`badge ${contact.type === "customer" ? "bg-blue-100 text-blue-700" : contact.type === "supplier" ? "bg-emerald-100 text-emerald-700" : "bg-violet-100 text-violet-700"}`}>
                {TYPE_LABELS[contact.type as ContactType]}
              </span>
            </div>
            {(contact.phone || contact.address) && (
              <div className="flex flex-wrap gap-3 mt-2 text-sm text-slate-500">
                {contact.phone && <PhoneLink phone={contact.phone} />}
                {contact.address && <span className="flex items-center gap-1"><MapPin size={13}/> {contact.address}</span>}
              </div>
            )}
          </div>
          <div className={`text-left shrink-0 ${isDebtor ? "text-rose-600" : isCreditor ? "text-emerald-600" : "text-slate-500"}`}>
            <div className="text-2xl font-bold">{isDebtor ? "بدهکار" : isCreditor ? "بستانکار" : "—"}{bal !== 0 ? " " + formatToman(Math.abs(bal), false) : ""}</div>
            <div className="text-xs text-slate-400">مانده حساب</div>
          </div>
        </div>
      </div>

      {/* تب‌ها */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {[
          { id: "info", label: "اطلاعات", icon: <User size={15}/> },
          ...(contact.type !== "supplier" ? [{ id: "sales" as const, label: `فروش‌ها (${toFaDigits(sales?.length ?? 0)})`, icon: <ShoppingBag size={15}/> }] : []),
          ...(contact.type !== "customer" ? [{ id: "purchases" as const, label: `خریدها (${toFaDigits(purchases?.length ?? 0)})`, icon: <Truck size={15}/> }] : []),
          { id: "tx" as const, label: `تراکنش‌ها (${toFaDigits(txs?.length ?? 0)})`, icon: <DollarSign size={15}/> },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition ${tab === t.id ? "bg-primary text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === "info" && <ContactInfo contact={contact} sales={sales ?? []} purchases={purchases ?? []} totalSales={totalSales} totalPurchases={totalPurchases} />}
      {tab === "sales" && <ContactSales sales={sales ?? []} />}
      {tab === "purchases" && <ContactPurchases purchases={purchases ?? []} />}
      {tab === "tx" && <ContactTx txs={txs ?? []} />}

      {editOpen && <ContactEditModal contact={contact} onClose={() => setEditOpen(false)} onSaved={() => { setEditOpen(false); qc.invalidateQueries({ queryKey: ["contact-detail", id] }); qc.invalidateQueries({ queryKey: ["contacts"] }); }} />}
    </div>
  );
}

function ContactInfo({ contact, sales, purchases, totalSales, totalPurchases }: any) {
  const meta = (contact.meta ?? {}) as Record<string, string>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4 text-center"><div className="text-xl font-bold text-emerald-600">{formatToman(totalSales, false)}</div><div className="text-xs text-slate-500">مجموع خرید</div></div>
        <div className="card p-4 text-center"><div className="text-xl font-bold text-primary">{formatToman(totalPurchases, false)}</div><div className="text-xs text-slate-500">مجموع خرید از</div></div>
        <div className="card p-4 text-center"><div className="text-xl font-bold text-slate-600">{toFaDigits(sales.length)}</div><div className="text-xs text-slate-500">فاکتور فروش</div></div>
        <div className="card p-4 text-center"><div className="text-xl font-bold text-slate-600">{toFaDigits(purchases.length)}</div><div className="text-xs text-slate-500">فاکتور خرید</div></div>
      </div>
      <div className="card p-5">
        <h3 className="font-semibold text-slate-700 mb-4">اطلاعات کامل</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "نام", value: contact.name },
            { label: "نوع", value: TYPE_LABELS[contact.type as ContactType] },
            { label: "تماس", value: contact.phone ? <PhoneLink phone={contact.phone} /> : "—" },
            { label: "کد", value: (contact as any).code ?? "—" },
            { label: "نام", value: meta.first_name || "—" },
            { label: "نام خانوادگی", value: meta.last_name || "—" },
            { label: "تاریخ تولد", value: meta.birth_date || "—" },
            { label: "ایمیل", value: meta.email || "—" },
            { label: "کد ملی", value: meta.national_code || "—" },
            { label: "شغل", value: meta.job_title || "—" },
          ].map((item, i) => (
            <div key={i} className="p-3 bg-slate-50 rounded-xl"><div className="text-xs text-slate-400 mb-1">{item.label}</div><div className="font-medium">{item.value}</div></div>
          ))}
          {contact.address && <div className="col-span-2 p-3 bg-slate-50 rounded-xl"><div className="text-xs text-slate-400 mb-1">آدرس</div><div className="font-medium">{contact.address}</div></div>}
          {contact.description && <div className="col-span-2 p-3 bg-slate-50 rounded-xl"><div className="text-xs text-slate-400 mb-1">توضیحات</div><div className="font-medium">{contact.description}</div></div>}
        </div>
      </div>
    </div>
  );
}

function ContactSales({ sales }: { sales: any[] }) {
  const total = sales.reduce((s, x) => s + (x.total ?? 0), 0);
  const credit = sales.reduce((s, x) => s + (x.paid_credit ?? 0), 0);
  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="card p-4 text-center"><div className="text-xl font-bold text-emerald-600">{formatToman(total, false)}</div><div className="text-xs text-slate-500">مجموع</div></div>
        <div className="card p-4 text-center"><div className="text-xl font-bold text-rose-600">{formatToman(credit, false)}</div><div className="text-xs text-slate-500">نسیه</div></div>
        <div className="card p-4 text-center"><div className="text-xl font-bold text-slate-600">{toFaDigits(sales.length)}</div><div className="text-xs text-slate-500">فاکتور</div></div>
      </div>
      <div className="card overflow-x-auto">
        {sales.length === 0 ? <EmptyState title="فاکتوری ثبت نشده" />
         : (
          <table className="table-base">
            <thead><tr><th>فاکتور</th><th>تاریخ</th><th>مبلغ</th><th>نقد/کارت</th><th>نسیه</th></tr></thead>
            <tbody>{sales.map((s: any) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td><EntityLink type="sale" id={s.id}>{s.invoice_no}</EntityLink></td>
                <td className="text-slate-500 text-sm">{toJalali(s.date)}</td>
                <td className="font-medium">{formatToman(s.total, false)}</td>
                <td className="text-slate-600">{formatToman((s.paid_cash??0)+(s.paid_card??0), false)}</td>
                <td>{s.paid_credit > 0 ? <span className="text-rose-600 font-medium">{formatToman(s.paid_credit, false)}</span> : <span className="text-slate-300">—</span>}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ContactPurchases({ purchases }: { purchases: any[] }) {
  const total = purchases.reduce((s, x) => s + (x.total ?? 0), 0);
  const paid = purchases.reduce((s, x) => s + (x.paid ?? 0), 0);
  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="card p-4 text-center"><div className="text-xl font-bold text-emerald-600">{formatToman(total, false)}</div><div className="text-xs text-slate-500">مجموع</div></div>
        <div className="card p-4 text-center"><div className="text-xl font-bold text-primary">{formatToman(paid, false)}</div><div className="text-xs text-slate-500">پرداخت‌شده</div></div>
        <div className="card p-4 text-center"><div className="text-xl font-bold text-rose-600">{formatToman(total-paid, false)}</div><div className="text-xs text-slate-500">باقیمانده</div></div>
      </div>
      <div className="card overflow-x-auto">
        {purchases.length === 0 ? <EmptyState title="خریدی ثبت نشده" />
         : (
          <table className="table-base">
            <thead><tr><th>فاکتور</th><th>تاریخ</th><th>مبلغ</th><th>پرداخت</th><th>باقی</th></tr></thead>
            <tbody>{purchases.map((p: any) => {
              const rem = (p.total??0) - (p.paid??0);
              return (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="font-medium text-emerald-600">{p.invoice_no}</td>
                  <td className="text-slate-500 text-sm">{toJalali(p.date)}</td>
                  <td className="font-medium">{formatToman(p.total, false)}</td>
                  <td className="text-slate-600">{formatToman(p.paid, false)}</td>
                  <td>{rem > 0 ? <span className="text-rose-600 font-medium">{formatToman(rem, false)}</span> : <span className="text-emerald-500">✓</span>}</td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ContactTx({ txs }: { txs: any[] }) {
  const recv = txs.filter((t: any) => t.type === "receipt" || t.type === "income").reduce((s: number, t: any) => s + t.amount, 0);
  const pay = txs.filter((t: any) => t.type === "payment" || t.type === "expense").reduce((s: number, t: any) => s + t.amount, 0);
  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="card p-4 text-center"><div className="text-xl font-bold text-emerald-600">{formatToman(recv, false)}</div><div className="text-xs text-slate-500">دریافتی</div></div>
        <div className="card p-4 text-center"><div className="text-xl font-bold text-rose-600">{formatToman(pay, false)}</div><div className="text-xs text-slate-500">پرداختی</div></div>
        <div className="card p-4 text-center"><div className="text-xl font-bold text-slate-600">{toFaDigits(txs.length)}</div><div className="text-xs text-slate-500">تراکنش</div></div>
      </div>
      <div className="card overflow-x-auto">
        {txs.length === 0 ? <EmptyState title="تراکنشی ثبت نشده" />
         : (
          <table className="table-base">
            <thead><tr><th>نوع</th><th>مبلغ</th><th>حساب</th><th>تاریخ</th><th>توضیح</th></tr></thead>
            <tbody>{txs.map((t: any) => {
              const isIn = t.type === "receipt" || t.type === "income";
              return (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td><span className={`badge ${isIn ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{isIn ? "دریافت" : "پرداخت"}</span></td>
                  <td className={`font-medium ${isIn ? "text-emerald-600" : "text-rose-600"}`}>{isIn ? "+" : "-"}{formatToman(t.amount, false)}</td>
                  <td className="text-slate-500 text-sm">{t.account?.name ?? "—"}</td>
                  <td className="text-slate-500 text-sm">{toJalali(t.date)}</td>
                  <td className="text-slate-400 text-sm max-w-[150px] truncate">{t.note ?? "—"}</td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// مودال ویرایش
function ContactEditModal({ contact, onClose, onSaved }: { contact: any; onClose: () => void; onSaved: () => void }) {
  const meta = (contact.meta ?? {}) as Record<string, string>;
  const [name, setName] = useState(contact.name); const [type, setType] = useState(contact.type ?? "customer");
  const [firstName, setFirstName] = useState(meta.first_name ?? ""); const [lastName, setLastName] = useState(meta.last_name ?? "");
  const [phone, setPhone] = useState(contact.phone ?? ""); const [email, setEmail] = useState(meta.email ?? "");
  const [birthDate, setBirthDate] = useState(meta.birth_date ?? ""); const [nationalCode, setNationalCode] = useState(meta.national_code ?? "");
  const [jobTitle, setJobTitle] = useState(meta.job_title ?? ""); const [address, setAddress] = useState(contact.address ?? "");
  const [desc, setDesc] = useState(contact.description ?? ""); const [code, setCode] = useState((contact as any).code ?? "");
  const [saving, setSaving] = useState(false); const [error, setError] = useState<string|null>(null);

  async function save() {
    if (!name.trim()) { setError("نام الزامی است."); return; }
    setSaving(true); const supabase = createClient();
    try { await supabase.from("contacts").update({ name: name.trim(), type, phone: phone.trim()||null, address: address.trim()||null, description: desc.trim()||null, code: code.trim()||null, meta: { ...meta, first_name: firstName.trim() || null, last_name: lastName.trim() || null, email: email.trim() || null, birth_date: birthDate || null, national_code: nationalCode.trim() || null, job_title: jobTitle.trim() || null } }).eq("id", contact.id); onSaved(); }
    catch (err) { setError("خطا: " + (err as Error).message); setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title="ویرایش شخص" size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><label className="label">نام</label><input className="input" value={firstName} onChange={e=>{setFirstName(e.target.value); setName([e.target.value,lastName].filter(Boolean).join(" "));}} /></div>
          <div><label className="label">نام خانوادگی</label><input className="input" value={lastName} onChange={e=>{setLastName(e.target.value); setName([firstName,e.target.value].filter(Boolean).join(" "));}} /></div>
          <div><label className="label">نام نمایشی *</label><input className="input" value={name} onChange={e=>setName(e.target.value)} /></div>
          <div><label className="label">کد</label><input className="input text-left" dir="ltr" value={code} onChange={e=>setCode(e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><label className="label">نوع</label><select className="input" value={type} onChange={e=>setType(e.target.value)}><option value="customer">مشتری</option><option value="supplier">تامین‌کننده</option><option value="both">هر دو</option></select></div>
          <div><label className="label">تماس</label><input className="input text-left" dir="ltr" value={phone} onChange={e=>setPhone(e.target.value)} /></div>
          <div><label className="label">ایمیل</label><input className="input text-left" dir="ltr" value={email} onChange={e=>setEmail(e.target.value)} /></div>
          <div><label className="label">تاریخ تولد</label><DatePicker value={birthDate} onChange={setBirthDate} /></div>
          <div><label className="label">کد ملی</label><input className="input text-left" dir="ltr" value={nationalCode} onChange={e=>setNationalCode(e.target.value)} /></div>
          <div><label className="label">شغل</label><input className="input" value={jobTitle} onChange={e=>setJobTitle(e.target.value)} /></div>
        </div>
        <div><label className="label">آدرس</label><input className="input" value={address} onChange={e=>setAddress(e.target.value)} /></div>
        <div><label className="label">توضیحات</label><textarea className="input" rows={2} value={desc} onChange={e=>setDesc(e.target.value)} /></div>
        {error && <div className="rounded-xl bg-rose-50 text-rose-700 text-sm px-4 py-3">{error}</div>}
        <div className="flex gap-2"><button onClick={save} disabled={saving} className="btn-primary flex-1">{saving&&<Loader2 className="animate-spin" size={18}/>} ذخیره</button><button onClick={onClose} className="btn-secondary">انصراف</button></div>
      </div>
    </Modal>
  );
}
