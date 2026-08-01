"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatToman, toJalali } from "@/lib/utils/format";
import { PageHeader, Spinner, EmptyState, Modal } from "@/components/shared/ui";
import { DatePicker } from "@/components/shared/date-picker";
import { EntityLink } from "@/components/shared/entity-link";
import { EntityActionMenu } from "@/components/shared/entity-action-menu";
import { Plus, Trash2, CreditCard, CheckCircle, XCircle, Clock } from "lucide-react";
import { logActivity } from "@/lib/utils/activity-log";

const sb = createClient();

type Check = {
  id: string;
  type: string;
  status: string;
  check_no: string;
  bank_name: string;
  account_no: string;
  amount: number;
  issue_date: string;
  due_date: string;
  cashed_date: string;
  contact_id: string;
  contact?: { name: string };
  note: string;
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "در انتظار", color: "bg-warning-soft text-warning-onSoft" },
  deposited: { label: "واریز شده", color: "bg-info-soft text-info-onSoft" },
  returned: { label: "برگشت خورده", color: "bg-destructive/15 text-destructive-text" },
  cashed: { label: "وصول شده", color: "bg-success-soft text-success-onSoft" },
  cancelled: { label: "لغو شده", color: "bg-muted text-muted-foreground" },
};

export default function ChecksPage() {
  const [checks, setChecks] = useState<Check[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [formData, setFormData] = useState({ type: "received", check_no: "", bank_name: "", account_no: "", amount: "", issue_date: new Date().toISOString().split("T")[0], due_date: "", contact_id: "", note: "" });
  const [saving, setSaving] = useState(false);

  const fetchChecks = useCallback(async () => {
    setLoading(true);
    const { data: user } = await sb.auth.getUser();
    if (!user.user) { setLoading(false); return; }
    const { data: mems } = await sb.from("memberships").select("org_id, branch_id").eq("user_id", user.user.id).eq("is_active", true).limit(1);
    if (!mems?.length) { setLoading(false); return; }

    let query = sb.from("checks").select("*, contact:contacts(name)").eq("org_id", mems[0].org_id).order("due_date", { ascending: true });
    if (typeFilter !== "all") query = query.eq("type", typeFilter);

    const { data } = await query;
    setChecks(data || []);
    setLoading(false);
  }, [typeFilter]);

  const fetchContacts = async () => {
    const { data: user } = await sb.auth.getUser();
    if (!user.user) return;
    const { data: mems } = await sb.from("memberships").select("org_id, branch_id").eq("user_id", user.user.id).eq("is_active", true).limit(1);
    if (!mems?.length) return;
    const { data } = await sb.from("contacts").select("id, name, type").eq("org_id", mems[0].org_id).eq("is_active", true);
    setContacts(data || []);
  };

  const createCheck = async () => {
    if (!formData.check_no || !formData.amount || !formData.due_date) { alert("شماره چک، مبلغ و تاریخ سررسید الزامی است"); return; }
    setSaving(true);
    const { data: user } = await sb.auth.getUser();
    if (!user.user) { setSaving(false); return; }
    const { data: mems } = await sb.from("memberships").select("org_id, branch_id").eq("user_id", user.user.id).eq("is_active", true).limit(1);
    if (!mems?.length) { setSaving(false); return; }

    try {
      const { data: inserted, error: insertError } = await sb.from("checks").insert({
        org_id: mems[0].org_id, branch_id: mems[0].branch_id,
        type: formData.type, check_no: formData.check_no, bank_name: formData.bank_name || null,
        account_no: formData.account_no || null, amount: parseInt(formData.amount),
        issue_date: formData.issue_date || new Date().toISOString(), due_date: formData.due_date,
        contact_id: formData.contact_id || null, note: formData.note || null,
        status: "pending", created_by: user.user.id,
      }).select("id").single();
      if (insertError) throw insertError;
      await logActivity({ orgId: mems[0].org_id, action: "create", entityType: "check", entityId: inserted?.id ?? null, newData: { type: formData.type, check_no: formData.check_no, amount: parseInt(formData.amount), contact_id: formData.contact_id || null } });
      setShowForm(false);
      setFormData({ type: "received", check_no: "", bank_name: "", account_no: "", amount: "", issue_date: new Date().toISOString().split("T")[0], due_date: "", contact_id: "", note: "" });
      fetchChecks();
    } catch (err) { alert("خطا: " + (err as Error).message); }
    finally { setSaving(false); }
  };

  const updateCheckStatus = async (id: string, status: string) => {
    const { data: user } = await sb.auth.getUser();
    if (!user.user) return;
    const { data: mems } = await sb.from("memberships").select("org_id, branch_id").eq("user_id", user.user.id).eq("is_active", true).limit(1);
    if (!mems?.length) return;

    const check = checks.find(c => c.id === id);
    if (status === "cashed" && check) {
      const type = check.type === "received" ? "receipt" : "payment";
      await sb.from("transactions").insert({
        org_id: mems[0].org_id, branch_id: mems[0].branch_id, type, amount: check.amount,
        date: new Date().toISOString(), contact_id: check.contact_id, method: "cheque",
        note: `${check.type === "received" ? "وصول" : "پرداخت"} چک ${check.check_no}`,
        ref_table: "checks", ref_id: id, created_by: user.user.id,
      });
    }
    await sb.from("checks").update({ status, cashed_date: status === "cashed" ? new Date().toISOString() : null }).eq("id", id);
    await logActivity({ orgId: mems[0].org_id, action: status === "cashed" ? "payment" : "update", entityType: "check", entityId: id, newData: { status, amount: check?.amount ?? null, check_no: check?.check_no ?? null } });
    fetchChecks();
  };

  const deleteCheck = async (id: string) => {
    if (!confirm("آیا از حذف این چک مطمئن هستید؟")) return;
    const check = checks.find((c) => c.id === id);
    const { data: user } = await sb.auth.getUser();
    const { data: mems } = user.user ? await sb.from("memberships").select("org_id").eq("user_id", user.user.id).eq("is_active", true).limit(1) : { data: null } as any;
    await sb.from("checks").delete().eq("id", id);
    await logActivity({ orgId: mems?.[0]?.org_id ?? null, action: "delete", entityType: "check", entityId: id, oldData: { check_no: check?.check_no, amount: check?.amount } });
    fetchChecks();
  };

  useEffect(() => { fetchChecks(); }, [fetchChecks]);
  useEffect(() => { if (showForm) fetchContacts(); }, [showForm]);

  const filteredChecks = checks.filter(c => !search || c.check_no?.includes(search) || c.contact?.name?.includes(search));
  const receivedChecks = filteredChecks.filter(c => c.type === "received");
  const issuedChecks = filteredChecks.filter(c => c.type === "issued");

  const totalPendingReceived = receivedChecks.filter(c => c.status === "pending").reduce((sum, c) => sum + c.amount, 0);
  const totalPendingIssued = issuedChecks.filter(c => c.status === "pending").reduce((sum, c) => sum + c.amount, 0);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader
        title="مدیریت چک‌ها"
        subtitle="پیگیری چک‌های دریافتی و صادره"
        action={<button onClick={() => setShowForm(true)} className="btn-primary"><Plus size={16} /> ثبت چک جدید</button>}
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <input className="input flex-1" placeholder="جستجو شماره چک یا طرف حساب..." value={search} onChange={e => setSearch(e.target.value)} />
        <select aria-label="فیلتر نوع چک" className="input w-auto" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="all">همه چک‌ها</option>
          <option value="received">دریافتی</option>
          <option value="issued">صادره</option>
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-4 text-center"><div className="text-2xl font-bold text-warning-onSoft-onSoft">{formatToman(totalPendingReceived)}</div><div className="text-xs text-muted-foreground">دریافتی در انتظار</div></div>
        <div className="card p-4 text-center"><div className="text-2xl font-bold text-warning-onSoft-onSoft">{formatToman(totalPendingIssued)}</div><div className="text-xs text-muted-foreground">صادره در انتظار</div></div>
        <div className="card p-4 text-center"><div className="text-2xl font-bold text-success-onSoft-onSoft">{formatToman(receivedChecks.filter(c => c.status === "cashed").reduce((sum, c) => sum + c.amount, 0))}</div><div className="text-xs text-muted-foreground">وصول شده</div></div>
        <div className="card p-4 text-center"><div className="text-2xl font-bold text-destructive-text">{formatToman(receivedChecks.filter(c => c.status === "returned").reduce((sum, c) => sum + c.amount, 0))}</div><div className="text-xs text-muted-foreground">برگشتی</div></div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setTypeFilter(typeFilter === "received" ? "all" : "received")}
          className={`btn ${typeFilter === "received" ? "btn-primary" : "btn-secondary"}`}>
          <CreditCard size={14} /> چک‌های دریافتی ({receivedChecks.length})
        </button>
        <button onClick={() => setTypeFilter(typeFilter === "issued" ? "all" : "issued")}
          className={`btn ${typeFilter === "issued" ? "btn-primary" : "btn-secondary"}`}>
          <CreditCard size={14} /> چک‌های صادره ({issuedChecks.length})
        </button>
      </div>

      {loading ? <Spinner label="در حال بارگذاری..." /> :
       filteredChecks.length === 0 ? (
        <EmptyState icon={CreditCard} title="چکی یافت نشد" description="هیچ چکی ثبت نشده" />
      ) : (
        <div className="space-y-3">
          {filteredChecks.map(check => {
            const statusInfo = STATUS_CONFIG[check.status] || STATUS_CONFIG.pending;
            return (
              <div key={check.id} className="card p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-bold text-foreground">{check.check_no || "بدون شماره"}</span>
                      <span className={`badge ${statusInfo.color}`}>{statusInfo.label}</span>
                      <span className="badge bg-muted text-muted-foreground">{check.type === "received" ? "دریافتی" : "صادره"}</span>
                    </div>
                    <div className="text-sm text-muted-foreground mb-1">
                      {check.contact_id ? (
                        <span className="inline-flex items-center gap-2">
                          <EntityLink type="contact" id={check.contact_id}>{check.contact?.name ?? "طرف حساب"}</EntityLink>
                          <EntityActionMenu type="contact" id={check.contact_id} label={check.contact?.name ?? "طرف حساب"} />
                        </span>
                      ) : (
                        <span className="text-muted-foreground">بدون طرف حساب</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {check.bank_name && `بانک: ${check.bank_name}`}
                      {check.bank_name && check.account_no && " • "}
                      {check.account_no && `شماره: ${check.account_no}`}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">صدور: {toJalali(check.issue_date)} • سررسید: {toJalali(check.due_date)}</div>
                  </div>
                  <div className="text-left">
                    <div className="text-lg font-bold text-foreground">{formatToman(check.amount)}</div>
                    <div className="text-xs text-muted-foreground">تومان</div>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-border">
                  {check.status === "pending" && (
                    <>
                      <button onClick={() => updateCheckStatus(check.id, "cashed")} className="btn-secondary text-sm text-success-onSoft"><CheckCircle size={14} /> {check.type === "received" ? "وصول" : "پاس"}</button>
                      {check.type === "received" && <button onClick={() => updateCheckStatus(check.id, "returned")} className="btn-secondary text-sm text-destructive"><XCircle size={14} /> برگشت</button>}
                    </>
                  )}
                  {check.status === "deposited" && (
                    <button onClick={() => updateCheckStatus(check.id, "cashed")} className="btn-secondary text-sm text-success-onSoft"><CheckCircle size={14} /> وصول شد</button>
                  )}
                  <button onClick={() => deleteCheck(check.id)} className="btn-danger text-sm"><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <Modal open onClose={() => setShowForm(false)} title="ثبت چک جدید" size="lg">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">نوع چک</label><select aria-label="نوع چک" className="input" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                  <option value="received">دریافتی</option>
                  <option value="issued">صادره</option>
                </select>
              </div>
              <div>
                <label className="label">شماره چک *</label><input aria-label="شماره چک *" className="input" value={formData.check_no} onChange={e => setFormData({ ...formData, check_no: e.target.value })} placeholder="شماره چک" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">بانک</label><input aria-label="بانک" className="input" value={formData.bank_name} onChange={e => setFormData({ ...formData, bank_name: e.target.value })} placeholder="نام بانک" />
              </div>
              <div>
                <label className="label">شماره حساب</label><input aria-label="شماره حساب" className="input" value={formData.account_no} onChange={e => setFormData({ ...formData, account_no: e.target.value })} placeholder="شماره حساب" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">مبلغ (تومان) *</label><input aria-label="مبلغ (تومان) *" type="number" className="input" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} placeholder="مبلغ" />
              </div>
              <div>
<DatePicker 
  label="تاریخ سررسید *" 
  value={formData.due_date} 
  onChange={date => setFormData({ ...formData, due_date: date })} 
/>
              </div>
            </div>
            <div>
              <label className="label">طرف حساب</label><select aria-label="طرف حساب" className="input" value={formData.contact_id} onChange={e => setFormData({ ...formData, contact_id: e.target.value })}>
                <option value="">انتخاب...</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.name} ({c.type === "customer" ? "مشتری" : c.type === "supplier" ? "تامین‌کننده" : "هردو"})</option>)}
              </select>
            </div>
            <div>
              <label className="label">توضیحات</label>
              <textarea className="input" rows={2} value={formData.note} onChange={e => setFormData({ ...formData, note: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <button onClick={createCheck} disabled={saving} className="btn-primary flex-1">{saving ? "در حال ثبت..." : "ثبت چک"}</button>
              <button onClick={() => setShowForm(false)} className="btn-secondary">انصراف</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}