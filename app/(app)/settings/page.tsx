"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { PageHeader, Modal, Spinner } from "@/components/shared/ui";
import { Plus, Loader2, Tag, Landmark, FolderTree } from "lucide-react";

export default function SettingsPage() {
  const { orgId, branchId } = useOrg();

  return (
    <div>
      <PageHeader title="تنظیمات" subtitle="مدیریت دسته‌بندی‌ها، برندها، حساب‌ها و دسته هزینه‌ها" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SimpleList
          orgId={orgId}
          branchId={branchId}
          table="categories"
          title="دسته‌بندی کالا"
          icon={<FolderTree size={18} />}
        />
        <SimpleList
          orgId={orgId}
          branchId={branchId}
          table="brands"
          title="برندها"
          icon={<Tag size={18} />}
        />
        <SimpleList
          orgId={orgId}
          branchId={branchId}
          table="expense_categories"
          title="دسته‌بندی هزینه"
          icon={<Tag size={18} />}
        />
        <AccountsList orgId={orgId} branchId={branchId} />
      </div>
    </div>
  );
}

function SimpleList({
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
      return data as { id: string; name: string }[];
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

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4 font-semibold text-slate-800">
        {icon} {title}
      </div>
      <div className="flex gap-2 mb-3">
        <input
          className="input"
          placeholder="نام جدید..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button onClick={add} disabled={adding} className="btn-primary shrink-0">
          {adding ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
        </button>
      </div>
      {isLoading ? (
        <Spinner />
      ) : (
        <div className="flex flex-wrap gap-2">
          {data?.length ? (
            data.map((d) => (
              <span key={d.id} className="badge bg-slate-100 text-slate-600">
                {d.name}
              </span>
            ))
          ) : (
            <span className="text-sm text-slate-400">موردی ثبت نشده.</span>
          )}
        </div>
      )}
    </div>
  );
}

function AccountsList({ orgId, branchId }: { orgId: string | null; branchId: string | null }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["accounts", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("accounts")
        .select("id, name, type")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string; type: string }[];
    },
  });

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 font-semibold text-slate-800">
          <Landmark size={18} /> صندوق و حساب‌های بانکی
        </div>
        <button onClick={() => setOpen(true)} className="text-brand-600 text-sm font-medium">
          + افزودن
        </button>
      </div>
      {isLoading ? (
        <Spinner />
      ) : (
        <div className="space-y-2">
          {data?.map((a) => (
            <div key={a.id} className="flex items-center justify-between text-sm">
              <span className="text-slate-700">{a.name}</span>
              <span className="badge bg-slate-100 text-slate-500">
                {a.type === "cash" ? "صندوق" : "بانک"}
              </span>
            </div>
          ))}
        </div>
      )}

      {open && (
        <AccountModal
          orgId={orgId}
          branchId={branchId}
          onClose={() => {
            setOpen(false);
            qc.invalidateQueries({ queryKey: ["accounts"] });
          }}
        />
      )}
    </div>
  );
}

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
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim() || !orgId) return;
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from("accounts")
      .insert({ org_id: orgId, branch_id: branchId, name: name.trim(), type });
    setSaving(false);
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="حساب جدید">
      <div className="space-y-4">
        <div>
          <label className="label">نام حساب</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">نوع</label>
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="cash">صندوق (نقد)</option>
            <option value="bank">بانک</option>
          </select>
        </div>
        <button onClick={save} disabled={saving} className="btn-primary w-full">
          {saving && <Loader2 className="animate-spin" size={18} />}
          ذخیره
        </button>
      </div>
    </Modal>
  );
}
