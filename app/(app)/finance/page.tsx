"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { PageHeader, StatCard, Spinner, Modal, EmptyState } from "@/components/shared/ui";
import { formatToman, toFaDigits, toEnDigits, tomanToRial, toJalali } from "@/lib/utils/format";
import { Plus, Wallet, Landmark, ArrowDownCircle, ArrowUpCircle, Loader2 } from "lucide-react";
import type { TxType } from "@/types/db";

const TX_LABEL: Record<string, string> = {
  receipt: "دریافت",
  payment: "پرداخت",
  expense: "هزینه",
  transfer: "انتقال",
  income: "درآمد",
};

export default function FinancePage() {
  const { orgId, branchId } = useOrg();
  const qc = useQueryClient();
  const [modalType, setModalType] = useState<TxType | null>(null);

  const { data: accounts } = useQuery({
    queryKey: ["account-balances", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("account_balances")
        .select("account_id, name, type, balance");
      if (error) throw error;
      return data as { account_id: string; name: string; type: string; balance: number }[];
    },
  });

  const { data: txs, isLoading } = useQuery({
    queryKey: ["transactions", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("transactions")
        .select("id, type, amount, date, method, note, contact:contacts(name)")
        .order("date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as unknown as {
        id: string;
        type: string;
        amount: number;
        date: string;
        method: string;
        note: string | null;
        contact: { name: string } | null;
      }[];
    },
  });

  const cashTotal = accounts?.filter((a) => a.type === "cash").reduce((s, a) => s + a.balance, 0) ?? 0;
  const bankTotal = accounts?.filter((a) => a.type === "bank").reduce((s, a) => s + a.balance, 0) ?? 0;

  return (
    <div>
      <PageHeader title="مالی" subtitle="صندوق، بانک، دریافت، پرداخت و هزینه" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard title="موجودی صندوق" value={formatToman(cashTotal)} icon={<Wallet size={20} />} tone="blue" />
        <StatCard title="موجودی بانک" value={formatToman(bankTotal)} icon={<Landmark size={20} />} tone="green" />
        <button onClick={() => setModalType("receipt")} className="card p-4 flex flex-col items-center justify-center gap-1 hover:bg-emerald-50 transition">
          <ArrowDownCircle className="text-emerald-600" size={24} />
          <span className="text-sm font-medium text-slate-700">ثبت دریافت</span>
        </button>
        <button onClick={() => setModalType("expense")} className="card p-4 flex flex-col items-center justify-center gap-1 hover:bg-rose-50 transition">
          <ArrowUpCircle className="text-rose-600" size={24} />
          <span className="text-sm font-medium text-slate-700">ثبت هزینه</span>
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setModalType("payment")} className="btn-secondary flex-1">
          <Plus size={16} /> پرداخت
        </button>
        <button onClick={() => setModalType("income")} className="btn-secondary flex-1">
          <Plus size={16} /> درآمد متفرقه
        </button>
      </div>

      <h2 className="font-semibold text-slate-800 mb-3">آخرین تراکنش‌ها</h2>
      {isLoading ? (
        <Spinner />
      ) : !txs || txs.length === 0 ? (
        <EmptyState title="تراکنشی ثبت نشده" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>نوع</th>
                <th>مبلغ</th>
                <th>طرف حساب</th>
                <th>تاریخ</th>
                <th>توضیح</th>
              </tr>
            </thead>
            <tbody>
              {txs.map((t) => {
                const isIn = t.type === "receipt" || t.type === "income";
                return (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td>
                      <span className={`badge ${isIn ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                        {TX_LABEL[t.type]}
                      </span>
                    </td>
                    <td className="font-medium">{formatToman(t.amount)}</td>
                    <td>{t.contact?.name ?? "—"}</td>
                    <td className="text-slate-500">{toJalali(t.date)}</td>
                    <td className="text-slate-400">{t.note ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalType && (
        <TxModal
          orgId={orgId}
          branchId={branchId}
          type={modalType}
          accounts={accounts ?? []}
          onClose={() => {
            setModalType(null);
            qc.invalidateQueries({ queryKey: ["transactions"] });
            qc.invalidateQueries({ queryKey: ["account-balances"] });
            qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
          }}
        />
      )}
    </div>
  );
}

function TxModal({
  orgId,
  branchId,
  type,
  accounts,
  onClose,
}: {
  orgId: string | null;
  branchId: string | null;
  type: TxType;
  accounts: { account_id: string; name: string }[];
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.account_id ?? "");
  const [contactId, setContactId] = useState("");
  const [expenseCatId, setExpenseCatId] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: contacts } = useQuery({
    queryKey: ["tx-contacts", orgId],
    enabled: !!orgId && (type === "receipt" || type === "payment"),
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("contacts")
        .select("id, name")
        .eq("is_active", true)
        .order("name")
        .limit(500);
      return data ?? [];
    },
  });

  const { data: expCats } = useQuery({
    queryKey: ["expense-cats", orgId],
    enabled: !!orgId && type === "expense",
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("expense_categories")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      return data ?? [];
    },
  });

  async function handleSave() {
    setError(null);
    const amt = tomanToRial(Number(toEnDigits(amount)) || 0);
    if (amt <= 0) {
      setError("مبلغ را وارد کنید.");
      return;
    }
    if (!orgId) return;
    setSaving(true);
    const supabase = createClient();
    try {
      const { error: e } = await supabase.from("transactions").insert({
        org_id: orgId,
        branch_id: branchId,
        type,
        amount: amt,
        account_id: accountId || null,
        contact_id: contactId || null,
        expense_category_id: expenseCatId || null,
        method: "cash",
        note: note.trim() || null,
      });
      if (e) throw e;
      onClose();
    } catch (e) {
      setError("خطا: " + (e as Error).message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={TX_LABEL[type]}>
      <div className="space-y-4">
        <div>
          <label className="label">مبلغ (تومان) *</label>
          <input
            autoFocus
            className="input"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div>
          <label className="label">حساب (صندوق/بانک)</label>
          <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.account_id} value={a.account_id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        {(type === "receipt" || type === "payment") && (
          <div>
            <label className="label">طرف حساب</label>
            <select className="input" value={contactId} onChange={(e) => setContactId(e.target.value)}>
              <option value="">—</option>
              {contacts?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {type === "expense" && (
          <div>
            <label className="label">دسته هزینه</label>
            <select className="input" value={expenseCatId} onChange={(e) => setExpenseCatId(e.target.value)}>
              <option value="">—</option>
              {expCats?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="label">توضیحات</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {error && <div className="rounded-xl bg-rose-50 text-rose-700 text-sm px-4 py-3">{error}</div>}
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving && <Loader2 className="animate-spin" size={18} />}
            ثبت
          </button>
          <button onClick={onClose} className="btn-secondary">
            انصراف
          </button>
        </div>
      </div>
    </Modal>
  );
}
