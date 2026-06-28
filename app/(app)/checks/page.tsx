"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPrice, formatDate, formatDateTime } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, Trash2, CreditCard, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";

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
  account_id: string;
  contact?: { name: string };
  note: string;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "در انتظار", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  deposited: { label: "واریز شده", color: "bg-blue-100 text-blue-800", icon: AlertCircle },
  returned: { label: "برگشت خورده", color: "bg-red-100 text-red-800", icon: XCircle },
  cashed: { label: "وصول شده", color: "bg-green-100 text-green-800", icon: CheckCircle },
  cancelled: { label: "لغو شده", color: "bg-gray-100 text-gray-800", icon: XCircle },
};

export default function ChecksPage() {
  const [checks, setChecks] = useState<Check[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    type: "received",
    check_no: "",
    bank_name: "",
    account_no: "",
    amount: "",
    issue_date: "",
    due_date: "",
    contact_id: "",
    note: "",
  });

  const fetchChecks = useCallback(async () => {
    setLoading(true);
    const { data: user } = await sb.auth.getUser();
    if (!user.user) return;
    const { data: mems } = await sb.from("memberships").select("org_id").eq("user_id", user.user.id).eq("is_active", true).limit(1);
    if (!mems?.length) { setLoading(false); return; }

    let query = sb.from("checks")
      .select("*, contact:contacts(name)")
      .eq("org_id", mems[0].org_id)
      .order("due_date", { ascending: true });

    if (typeFilter !== "all") {
      query = query.eq("type", typeFilter);
    }

    const { data } = await query;
    setChecks(data || []);
    setLoading(false);
  }, [typeFilter]);

  const fetchContactsAndAccounts = async () => {
    const { data: user } = await sb.auth.getUser();
    if (!user.user) return;
    const { data: mems } = await sb.from("memberships").select("org_id").eq("user_id", user.user.id).eq("is_active", true).limit(1);
    if (!mems?.length) return;

    const [contactsRes, accountsRes] = await Promise.all([
      sb.from("contacts").select("id, name, type").eq("org_id", mems[0].org_id).eq("is_active", true),
      sb.from("accounts").select("id, name, type").eq("org_id", mems[0].org_id).eq("is_active", true),
    ]);

    setContacts(contactsRes.data || []);
    setAccounts(accountsRes.data || []);
  };

  const createCheck = async () => {
    if (!formData.check_no || !formData.amount || !formData.due_date) {
      alert("شماره چک، مبلغ و تاریخ سررسید الزامی است");
      return;
    }

    const { data: user } = await sb.auth.getUser();
    if (!user.user) return;
    const { data: mems } = await sb.from("memberships").select("org_id, branch_id").eq("user_id", user.user.id).eq("is_active", true).limit(1);
    if (!mems?.length) return;

    await sb.from("checks").insert({
      org_id: mems[0].org_id,
      branch_id: mems[0].branch_id,
      type: formData.type,
      check_no: formData.check_no,
      bank_name: formData.bank_name,
      account_no: formData.account_no,
      amount: parseInt(formData.amount),
      issue_date: formData.issue_date || new Date().toISOString(),
      due_date: formData.due_date,
      contact_id: formData.contact_id || null,
      note: formData.note,
      status: "pending",
      created_by: user.user.id,
    });

    setShowForm(false);
    setFormData({ type: "received", check_no: "", bank_name: "", account_no: "", amount: "", issue_date: "", due_date: "", contact_id: "", note: "" });
    fetchChecks();
  };

  const updateCheckStatus = async (id: string, status: string, cashedDate?: string) => {
    const update: any = { status };
    if (cashedDate) update.cashed_date = cashedDate;

    const { data: user } = await sb.auth.getUser();
    if (!user.user) return;
    const { data: mems } = await sb.from("memberships").select("org_id").eq("user_id", user.user.id).eq("is_active", true).limit(1);
    if (!mems?.length) return;

    // اگر چک وصول شد، تراکنش مالی ثبت شود
    if (status === "cashed") {
      const check = checks.find(c => c.id === id);
      if (check) {
        const type = check.type === "received" ? "receipt" : "payment";
        await sb.from("transactions").insert({
          org_id: mems[0].org_id,
          branch_id: mems[0].branch_id,
          type,
          amount: check.amount,
          date: cashedDate || new Date().toISOString(),
          contact_id: check.contact_id,
          method: "cheque",
          note: `${check.type === "received" ? "وصول" : "پرداخت"} چک شماره ${check.check_no}`,
          ref_table: "checks",
          ref_id: id,
          created_by: user.user.id,
        });
      }
    }

    await sb.from("checks").update(update).eq("id", id);
    fetchChecks();
  };

  const deleteCheck = async (id: string) => {
    if (!confirm("آیا از حذف این چک مطمئن هستید؟")) return;
    await sb.from("checks").delete().eq("id", id);
    fetchChecks();
  };

  useEffect(() => { fetchChecks(); }, [fetchChecks]);

  useEffect(() => {
    if (showForm) fetchContactsAndAccounts();
  }, [showForm]);

  const filteredChecks = checks.filter(c => !search || c.check_no?.includes(search) || c.contact?.name?.includes(search));
  const receivedChecks = filteredChecks.filter(c => c.type === "received");
  const issuedChecks = filteredChecks.filter(c => c.type === "issued");

  const totalPendingReceived = receivedChecks.filter(c => c.status === "pending").reduce((sum, c) => sum + c.amount, 0);
  const totalPendingIssued = issuedChecks.filter(c => c.status === "pending").reduce((sum, c) => sum + c.amount, 0);

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">مدیریت چک‌ها</h1>
          <p className="text-sm text-slate-500">پیگیری چک‌های دریافتی و صادره</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus size={16} /> ثبت چک جدید
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <Input placeholder="جستجو شماره چک یا طرف حساب..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 text-sm">
          <option value="all">همه چک‌ها</option>
          <option value="received">دریافتی</option>
          <option value="issued">صادره</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-2xl font-bold text-yellow-600">{formatPrice(totalPendingReceived)}</div>
          <div className="text-xs text-slate-500">چک‌های دریافتی در انتظار</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-2xl font-bold text-orange-600">{formatPrice(totalPendingIssued)}</div>
          <div className="text-xs text-slate-500">چک‌های صادره در انتظار</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-2xl font-bold text-green-600">{formatPrice(receivedChecks.filter(c => c.status === "cashed").reduce((sum, c) => sum + c.amount, 0))}</div>
          <div className="text-xs text-slate-500">وصول شده</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-2xl font-bold text-red-600">{formatPrice(receivedChecks.filter(c => c.status === "returned").reduce((sum, c) => sum + c.amount, 0))}</div>
          <div className="text-xs text-slate-500">برگشتی</div>
        </CardContent></Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="received">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="received" className="gap-2">
            <CreditCard size={14} /> چک‌های دریافتی ({receivedChecks.length})
          </TabsTrigger>
          <TabsTrigger value="issued" className="gap-2">
            <CreditCard size={14} /> چک‌های صادره ({issuedChecks.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="received" className="space-y-3 mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
            </div>
          ) : receivedChecks.length === 0 ? (
            <EmptyState icon={CreditCard} title="چک دریافتی یافت نشد" description="هیچ چک دریافتی ثبت نشده" />
          ) : receivedChecks.map(check => {
            const statusInfo = STATUS_CONFIG[check.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusInfo.icon;
            return (
              <Card key={check.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-bold text-slate-800">{check.check_no || "بدون شماره"}</span>
                        <Badge className={statusInfo.color}>
                          <StatusIcon size={12} className="ml-1" />
                          {statusInfo.label}
                        </Badge>
                      </div>
                      <div className="text-sm text-slate-600 mb-1">
                        {check.contact?.name || <span className="text-slate-400">بدون طرف حساب</span>}
                      </div>
                      <div className="text-xs text-slate-400">
                        {check.bank_name && `بانک: ${check.bank_name}`}
                        {check.bank_name && check.account_no && " • "}
                        {check.account_no && `شماره: ${check.account_no}`}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        تاریخ صدور: {formatDate(check.issue_date)} • سررسید: {formatDate(check.due_date)}
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="text-lg font-bold text-slate-800">{formatPrice(check.amount)}</div>
                      <div className="text-xs text-slate-400">تومان</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-slate-100">
                    {check.status === "pending" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => updateCheckStatus(check.id, "cashed", new Date().toISOString())} className="text-green-600 border-green-200 hover:bg-green-50">
                          <CheckCircle size={14} /> وصول
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => updateCheckStatus(check.id, "returned")} className="text-red-600 border-red-200 hover:bg-red-50">
                          <XCircle size={14} /> برگشت
                        </Button>
                      </>
                    )}
                    {check.status === "deposited" && (
                      <Button size="sm" variant="outline" onClick={() => updateCheckStatus(check.id, "cashed")} className="text-green-600 border-green-200 hover:bg-green-50">
                        <CheckCircle size={14} /> وصول شد
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => deleteCheck(check.id)} className="text-red-600 border-red-200 hover:bg-red-50">
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="issued" className="space-y-3 mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" />
            </div>
          ) : issuedChecks.length === 0 ? (
            <EmptyState icon={CreditCard} title="چک صادره یافت نشد" description="هیچ چک صادره ثبت نشده" />
          ) : issuedChecks.map(check => {
            const statusInfo = STATUS_CONFIG[check.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusInfo.icon;
            return (
              <Card key={check.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-bold text-slate-800">{check.check_no || "بدون شماره"}</span>
                        <Badge className={statusInfo.color}>
                          <StatusIcon size={12} className="ml-1" />
                          {statusInfo.label}
                        </Badge>
                      </div>
                      <div className="text-sm text-slate-600 mb-1">
                        {check.contact?.name || <span className="text-slate-400">بدون طرف حساب</span>}
                      </div>
                      <div className="text-xs text-slate-400">
                        {check.bank_name && `بانک: ${check.bank_name}`}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        تاریخ صدور: {formatDate(check.issue_date)} • سررسید: {formatDate(check.due_date)}
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="text-lg font-bold text-slate-800">{formatPrice(check.amount)}</div>
                      <div className="text-xs text-slate-400">تومان</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-slate-100">
                    {check.status === "pending" && (
                      <Button size="sm" variant="outline" onClick={() => updateCheckStatus(check.id, "cashed", new Date().toISOString())} className="text-green-600 border-green-200 hover:bg-green-50">
                        <CheckCircle size={14} /> پاس شد
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => deleteCheck(check.id)} className="text-red-600 border-red-200 hover:bg-red-50">
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold">ثبت چک جدید</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">نوع چک</label>
                  <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200">
                    <option value="received">دریافتی</option>
                    <option value="issued">صادره</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">شماره چک *</label>
                  <Input value={formData.check_no} onChange={e => setFormData({ ...formData, check_no: e.target.value })} placeholder="شماره چک" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">بانک</label>
                  <Input value={formData.bank_name} onChange={e => setFormData({ ...formData, bank_name: e.target.value })} placeholder="نام بانک" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">شماره حساب</label>
                  <Input value={formData.account_no} onChange={e => setFormData({ ...formData, account_no: e.target.value })} placeholder="شماره حساب" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">مبلغ (تومان) *</label>
                  <Input type="number" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} placeholder="مبلغ" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">تاریخ سررسید *</label>
                  <Input type="date" value={formData.due_date} onChange={e => setFormData({ ...formData, due_date: e.target.value })} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">طرف حساب</label>
                <select value={formData.contact_id} onChange={e => setFormData({ ...formData, contact_id: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200">
                  <option value="">انتخاب...</option>
                  {contacts.map(c => <option key={c.id} value={c.id}>{c.name} ({c.type === "customer" ? "مشتری" : c.type === "supplier" ? "تامین‌کننده" : "هردو"})</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">توضیحات</label>
                <textarea value={formData.note} onChange={e => setFormData({ ...formData, note: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200" rows={2} />
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setShowForm(false)}>انصراف</Button>
              <Button onClick={createCheck}>ثبت چک</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}