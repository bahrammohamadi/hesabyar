"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { PageHeader, Spinner, EmptyState, Modal } from "@/components/shared/ui";
import { formatToman } from "@/lib/utils/format";
import { Plus, Search, User, Pencil, Phone, Loader2 } from "lucide-react";
import type { Contact, ContactType } from "@/types/db";

const TYPE_LABEL: Record<ContactType, string> = {
  customer: "مشتری",
  supplier: "تامین‌کننده",
  both: "هر دو",
};

export default function ContactsPage() {
  const { orgId, branchId } = useOrg();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | ContactType>("");
  const qc = useQueryClient();

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["contacts", orgId, search, typeFilter],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      let q = supabase
        .from("contacts")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (search.trim()) {
        const t = search.trim();
        q = q.or(`name.ilike.%${t}%,phone.ilike.%${t}%,code.ilike.%${t}%`);
      }
      if (typeFilter) q = q.in("type", typeFilter === "both" ? ["both"] : [typeFilter, "both"]);
      const { data, error } = await q;
      if (error) throw error;
      return data as Contact[];
    },
  });

  // مانده حساب‌ها
  const { data: balances } = useQuery({
    queryKey: ["contact-balances", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("contact_balances")
        .select("contact_id, balance");
      if (error) throw error;
      const map: Record<string, number> = {};
      (data as { contact_id: string; balance: number }[]).forEach(
        (r) => (map[r.contact_id] = r.balance)
      );
      return map;
    },
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);

  return (
    <div>
      <PageHeader
        title="اشخاص"
        subtitle="مشتری‌ها و تامین‌کننده‌ها"
        action={
          <button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
            className="btn-primary"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">شخص جدید</span>
          </button>
        }
      />

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            className="input pr-10"
            placeholder="جستجوی نام..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input w-36"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as ContactType | "")}
        >
          <option value="">همه</option>
          <option value="customer">مشتری</option>
          <option value="supplier">تامین‌کننده</option>
        </select>
      </div>

      {isLoading ? (
        <Spinner label="در حال بارگذاری..." />
      ) : !contacts || contacts.length === 0 ? (
        <EmptyState title="هنوز شخصی ثبت نشده" description="مشتری یا تامین‌کننده اضافه کنید." />
      ) : (
        <div className="space-y-2">
          {contacts.map((c) => {
            const bal = balances?.[c.id] ?? 0;
            return (
              <div key={c.id} className="card p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                    <User size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-slate-800 truncate">{c.name || "بدون نام"}</div>
                    <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5 flex-wrap">
                      {(c as any).code && <span className="font-mono text-brand-600">{(c as any).code}</span>}
                      <span className="badge bg-slate-100 text-slate-500">{TYPE_LABEL[c.type]}</span>
                      {c.phone && (
                        <span className="flex items-center gap-1" dir="ltr">
                          <Phone size={12} /> {c.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-left">
                    {bal !== 0 && (
                      <span
                        className={`text-sm font-medium ${
                          bal > 0 ? "text-rose-600" : "text-emerald-600"
                        }`}
                      >
                        {bal > 0 ? "بدهکار " : "بستانکار "}
                        {formatToman(Math.abs(bal), false)}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setEditing(c);
                      setModalOpen(true);
                    }}
                    className="text-slate-400 hover:text-brand-600 p-1"
                  >
                    <Pencil size={17} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <ContactModal
          orgId={orgId}
          branchId={branchId}
          editing={editing}
          onClose={() => {
            setModalOpen(false);
            qc.invalidateQueries({ queryKey: ["contacts"] });
          }}
        />
      )}
    </div>
  );
}

function ContactModal({
  orgId,
  branchId,
  editing,
  onClose,
}: {
  orgId: string | null;
  branchId: string | null;
  editing: Contact | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [type, setType] = useState<ContactType>(editing?.type ?? "customer");
  const [phone, setPhone] = useState(editing?.phone ?? "");
  const [address, setAddress] = useState(editing?.address ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    if (!name.trim()) {
      setError("نام الزامی است.");
      return;
    }
    if (!orgId) return;
    setSaving(true);
    const supabase = createClient();
    const payload = {
      name: name.trim(),
      type,
      phone: phone.trim() || null,
      address: address.trim() || null,
      description: description.trim() || null,
    };
    try {
      if (editing) {
        const { error: e } = await supabase.from("contacts").update(payload).eq("id", editing.id);
        if (e) throw e;
      } else {
        const { error: e } = await supabase
          .from("contacts")
          .insert({ ...payload, org_id: orgId, branch_id: branchId });
        if (e) throw e;
      }
      onClose();
    } catch (e) {
      setError("خطا: " + (e as Error).message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={editing ? "ویرایش شخص" : "شخص جدید"}>
      <div className="space-y-4">
        <div>
          <label className="label">نام *</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">نوع</label>
          <select
            className="input"
            value={type}
            onChange={(e) => setType(e.target.value as ContactType)}
          >
            <option value="customer">مشتری</option>
            <option value="supplier">تامین‌کننده</option>
            <option value="both">هر دو</option>
          </select>
        </div>
        <div>
          <label className="label">شماره تماس</label>
          <input
            className="input text-left"
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div>
          <label className="label">آدرس</label>
          <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div>
          <label className="label">توضیحات</label>
          <textarea
            className="input"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        {error && (
          <div className="rounded-xl bg-rose-50 text-rose-700 text-sm px-4 py-3">{error}</div>
        )}
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving && <Loader2 className="animate-spin" size={18} />}
            ذخیره
          </button>
          <button onClick={onClose} className="btn-secondary">
            انصراف
          </button>
        </div>
      </div>
    </Modal>
  );
}
