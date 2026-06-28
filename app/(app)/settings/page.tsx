"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { PageHeader, Modal, Spinner } from "@/components/shared/ui";
import { Plus, Loader2, Tag, Landmark, FolderTree, Trash2, Pencil, Check, X } from "lucide-react";

export default function SettingsPage() {
  const { orgId, branchId } = useOrg();

  return (
    <div>
      <PageHeader
        title="تنظیمات"
        subtitle="مدیریت دسته‌بندی‌ها، برندها، حساب‌ها و دسته هزینه‌ها"
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ManageableList
          orgId={orgId}
          branchId={branchId}
          table="categories"
          title="دسته‌بندی کالا"
          icon={<FolderTree size={18} />}
        />
        <ManageableList
          orgId={orgId}
          branchId={branchId}
          table="brands"
          title="برندها"
          icon={<Tag size={18} />}
        />
        <ManageableList
          orgId={orgId}
          branchId={branchId}
          table="expense_categories"
          title="دسته‌بندی هزینه"
          icon={<Tag size={18} />}
        />
        <AccountsManager orgId={orgId} branchId={branchId} />
      </div>
    </div>
  );
}

// ==============================================================
// لیست قابل مدیریت (افزودن، ویرایش، حذف)
// ==============================================================
type Item = { id: string; name: string };

function ManageableList({
  orgId,
  branchId,
  table,
  title,
  icon,
}: {
  orgId: string | null;
  branchId: string | null;
  table: string;
  title: string;
  icon: React.ReactNode;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: [table, orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from(table)
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Item[];
    },
  });

  async function add() {
    if (!name.trim() || !orgId) return;
    setAdding(true);
    const supabase = createClient();
    await supabase.from(table).insert({ org_id: orgId, branch_id: branchId, name: name.trim() });
    setName("");
    setAdding(false);
    qc.invalidateQueries({ queryKey: [table] });
  }

  async function updateItem(id: string) {
    if (!editName.trim() || !orgId) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from(table).update({ name: editName.trim() }).eq("id", id);
    setEditingId(null);
    setSaving(false);
    qc.invalidateQueries({ queryKey: [table] });
  }

  async function deleteItem(id: string) {
    setDeletingId(id);
    const supabase = createClient();
    await supabase.from(table).update({ is_active: false }).eq("id", id);
    setDeletingId(null);
    qc.invalidateQueries({ queryKey: [table] });
  }

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4 font-semibold text-slate-800">
        {icon} {title}
      </div>

      {/* افزودن آیتم جدید */}
      <div className="flex gap-2 mb-4">
        <input
          className="input flex-1"
          placeholder={`نام ${title} جدید...`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button onClick={add} disabled={adding || !name.trim()} className="btn-primary shrink-0">
          {adding ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
        </button>
      </div>

      {/* لیست آیتم‌ها */}
      {isLoading ? (
        <Spinner />
      ) : (
        <div className="space-y-1.5">
          {data?.length ? (
            data.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 group"
              >
                {editingId === d.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      className="input flex-1 text-sm py-1.5"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") updateItem(d.id); if (e.key === "Escape") setEditingId(null); }}
                      autoFocus
                    />
                    <button onClick={() => updateItem(d.id)} disabled={saving} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg">
                      <Check size={16} />
                    </button>
                    <button onClick={() => setEditingId(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg">
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm text-slate-700">{d.name}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => { setEditingId(d.id); setEditName(d.name); }}
                        className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg"
                        title="ویرایش"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => deleteItem(d.id)}
                        disabled={deletingId === d.id}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                        title="حذف"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          ) : (
            <span className="text-sm text-slate-400">موردی ثبت نشده.</span>
          )}
        </div>
      )}
    </div>
  );
}

// ==============================================================
// مدیریت حساب‌ها (صندوق و بانک)
// ==============================================================
function AccountsManager({ orgId, branchId }: { orgId: string | null; branchId: string | null }) {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["accounts-full", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("accounts").select("id, name, type").eq("is_active", true).order("name");
      if (error) throw error;
      return data as { id: string; name: string; type: string }[];
    },
  });

  async function deleteAccount(id: string) {
    setDeletingId(id);
    const supabase = createClient();
    await supabase.from("accounts").update({ is_active: false }).eq("id", id);
    setDeletingId(null);
    qc.invalidateQueries({ queryKey: ["accounts-full"] });
    qc.invalidateQueries({ queryKey: ["account-balances"] });
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 font-semibold text-slate-800">
          <Landmark size={18} /> صندوق و حساب‌های بانکی
        </div>
        <button onClick={() => setModalOpen(true)} className="btn btn-primary text-sm py-2 px-3">
          <Plus size={14} /> افزودن حساب
        </button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : (
        <div className="space-y-2">
          {data?.map((a) => (
            <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition group">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${a.type === "cash" ? "bg-emerald-100 text-emerald-600" : "bg-blue-100 text-blue-600"}`}>
                  <Landmark size={16} />
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-800">{a.name}</div>
                  <div className="text-xs text-slate-400">{a.type === "cash" ? "صندوق (نقد)" : "بانک"}</div>
                </div>
              </div>
              <button
                onClick={() => deleteAccount(a.id)}
                disabled={deletingId === a.id}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                title="حذف"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {!data?.length && (
            <span className="text-sm text-slate-400">حسابی ثبت نشده.</span>
          )}
        </div>
      )}

      {modalOpen && (
        <AccountModal
          orgId={orgId}
          branchId={branchId}
          onClose={() => {
            setModalOpen(false);
            qc.invalidateQueries({ queryKey: ["accounts-full"] });
            qc.invalidateQueries({ queryKey: ["account-balances"] });
          }}
        />
      )}
    </div>
  );
}

// ==============================================================
// مودال ایجاد/ویرایش حساب
// ==============================================================
function AccountModal({
  orgId,
  branchId,
  onClose,
}: {
  orgId: string | null;
  branchId: string | null;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState("cash");
  const [bankName, setBankName] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim() || !orgId) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    try {
      await supabase.from("accounts").insert({
        org_id: orgId,
        branch_id: branchId,
        name: name.trim(),
        type,
        bank_name: type === "bank" && bankName.trim() ? bankName.trim() : null,
        account_no: type === "bank" && accountNo.trim() ? accountNo.trim() : null,
      });
      onClose();
    } catch (e) {
      setError("خطا: " + (e as Error).message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="حساب جدید">
      <div className="space-y-4">
        <div>
          <label className="label">نام حساب *</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً: صندوق شعبه ۱" />
        </div>
        <div>
          <label className="label">نوع</label>
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="cash">صندوق (نقد)</option>
            <option value="bank">بانک</option>
          </select>
        </div>
        {type === "bank" && (
          <>
            <div>
              <label className="label">نام بانک</label>
              <input className="input" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="مثلاً: ملی، سپه" />
            </div>
            <div>
              <label className="label">شماره حساب</label>
              <input className="input" dir="ltr" value={accountNo} onChange={(e) => setAccountNo(e.target.value)} placeholder="شماره حساب بانکی" />
            </div>
          </>
        )}
        {error && <div className="rounded-xl bg-rose-50 text-rose-700 text-sm px-4 py-3">{error}</div>}
        <button onClick={save} disabled={saving || !name.trim()} className="btn-primary w-full">
          {saving && <Loader2 className="animate-spin" size={18} />} ذخیره
        </button>
      </div>
    </Modal>
  );
}