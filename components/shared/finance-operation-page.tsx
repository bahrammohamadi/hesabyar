"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { PageHeader, Spinner, EmptyState } from "@/components/shared/ui";
import { EntityActionMenu } from "@/components/shared/entity-action-menu";
import { EntityLink } from "@/components/shared/entity-link";
import { formatToman, toEnDigits, toJalali, tomanToRial } from "@/lib/utils/format";
import { Loader2, Plus } from "lucide-react";
import type { TxType } from "@/types/db";

type FinanceMode = "receipt" | "payment" | "expense" | "income" | "transfer" | "all";

const MODE_LABEL: Record<FinanceMode, string> = {
  all: "تراکنش‌ها",
  receipt: "دریافت از مشتری",
  payment: "پرداخت به تأمین‌کننده",
  expense: "ثبت هزینه",
  income: "ثبت درآمد",
  transfer: "انتقال وجه",
};

const MODE_HINT: Record<FinanceMode, string> = {
  all: "نمایش همه تراکنش‌های مالی",
  receipt: "دریافت وجه و ثبت تسویه حساب مشتری",
  payment: "پرداخت وجه به تأمین‌کننده یا شخص",
  expense: "ثبت هزینه‌های فروشگاه",
  income: "ثبت درآمدهای متفرقه",
  transfer: "انتقال وجه بین صندوق و حساب‌های بانکی",
};

export function FinanceOperationPage({ mode }: { mode: FinanceMode }) {
  const { orgId, branchId } = useOrg();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [contactId, setContactId] = useState("");
  const [expenseCatId, setExpenseCatId] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: accounts } = useQuery({
    queryKey: ["finance-page-accounts", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("accounts").select("id,name,type").eq("is_active", true).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: contacts } = useQuery({
    queryKey: ["finance-page-contacts", orgId],
    enabled: !!orgId && (mode === "receipt" || mode === "payment"),
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("contacts").select("id,name,type").eq("is_active", true).order("name").limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: expenseCategories } = useQuery({
    queryKey: ["finance-page-expense-cats", orgId],
    enabled: !!orgId && mode === "expense",
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("expense_categories").select("id,name").eq("is_active", true).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["finance-operation-transactions", orgId, mode],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      let q = supabase
        .from("transactions")
        .select("id,type,amount,date,method,note,contact_id,contact:contacts(name),account:accounts(name),to_account:accounts!transactions_to_account_id_fkey(name)")
        .order("date", { ascending: false })
        .limit(100);
      if (mode !== "all") q = q.eq("type", mode);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  async function save() {
    setError(null);
    if (mode === "all") return;
    const amountRial = tomanToRial(Number(toEnDigits(amount)) || 0);
    if (amountRial <= 0) { setError("مبلغ را وارد کنید."); return; }
    if (!orgId) return;
    setSaving(true);
    const supabase = createClient();
    try {
      const payload: Record<string, unknown> = {
        org_id: orgId,
        branch_id: branchId,
        type: mode as TxType,
        amount: amountRial,
        account_id: accountId || null,
        contact_id: contactId || null,
        expense_category_id: expenseCatId || null,
        method: "cash",
        note: note.trim() || null,
      };
      if (mode === "transfer") payload.to_account_id = toAccountId || null;
      const { error } = await supabase.from("transactions").insert(payload);
      if (error) throw error;
      setAmount(""); setContactId(""); setExpenseCatId(""); setNote(""); setToAccountId("");
      qc.invalidateQueries({ queryKey: ["finance-operation-transactions"] });
      qc.invalidateQueries({ queryKey: ["account-balances"] });
    } catch (e) {
      setError("خطا: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title={MODE_LABEL[mode]} subtitle={MODE_HINT[mode]} />

      {mode !== "all" && (
        <div className="card p-4 mb-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="label">مبلغ (تومان)</label><input className="input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div><label className="label">حساب مبدا</label><select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}><option value="">انتخاب...</option>{accounts?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
            {mode === "transfer" && <div><label className="label">حساب مقصد</label><select className="input" value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}><option value="">انتخاب...</option>{accounts?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>}
            {(mode === "receipt" || mode === "payment") && <div><label className="label">طرف حساب</label><select className="input" value={contactId} onChange={(e) => setContactId(e.target.value)}><option value="">انتخاب...</option>{contacts?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>}
            {mode === "expense" && <div><label className="label">دسته هزینه</label><select className="input" value={expenseCatId} onChange={(e) => setExpenseCatId(e.target.value)}><option value="">انتخاب...</option>{expenseCategories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>}
            <div className="md:col-span-2"><label className="label">توضیحات</label><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
          </div>
          {error && <div className="rounded-xl bg-rose-50 text-rose-700 text-sm px-4 py-3 mt-3">{error}</div>}
          <button onClick={save} disabled={saving} className="btn-primary mt-4"><Plus size={16}/>{saving && <Loader2 className="animate-spin" size={16}/>} ثبت</button>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="p-4 border-b border-slate-100 font-semibold text-slate-700">آخرین موارد</div>
        {isLoading ? <Spinner /> : !transactions?.length ? <EmptyState title="موردی ثبت نشده" /> : (
          <div className="divide-y divide-slate-100">
            {transactions.map((t: any) => (
              <div key={t.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-slate-800">{MODE_LABEL[t.type as FinanceMode] ?? t.type}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    {t.contact_id ? <EntityLink type="contact" id={t.contact_id}>{t.contact?.name ?? "طرف حساب"}</EntityLink> : t.note ?? "—"}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {t.contact_id && <EntityActionMenu type="contact" id={t.contact_id} label={t.contact?.name ?? "طرف حساب"} />}
                  <div className="text-left"><div className="font-bold text-slate-800">{formatToman(t.amount, false)}</div><div className="text-xs text-slate-400">{toJalali(t.date)}</div></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
