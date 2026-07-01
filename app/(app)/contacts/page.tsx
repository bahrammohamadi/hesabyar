"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { PageHeader, Spinner, EmptyState, Modal } from "@/components/shared/ui";
import { DatePicker } from "@/components/shared/date-picker";
import { EntityLink } from "@/components/shared/entity-link";
import { EntityActionMenu } from "@/components/shared/entity-action-menu";
import { PhoneLink } from "@/components/shared/phone-link";
import { formatToman } from "@/lib/utils/format";
import { Plus, Search, User, Pencil, Trash2, Loader2 } from "lucide-react";
import type { Contact, ContactType } from "@/types/db";

const TYPE_LABEL: Record<ContactType, string> = {
  customer: "مشتری",
  supplier: "تامین‌کننده",
  both: "هر دو",
};

export function ContactsPageContent({ forcedType, forcedFilter, forcedAction }: { forcedType?: ContactType; forcedFilter?: "debtors" | "creditors"; forcedAction?: "new" }) {
  const { orgId, branchId } = useOrg();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | ContactType>("");
  const [balanceFilter, setBalanceFilter] = useState<"" | "debtors" | "creditors">("");
  const [sortBy, setSortBy] = useState<"name_asc" | "name_desc" | "balance_high" | "balance_low" | "newest">("name_asc");
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

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("آیا از حذف این شخص مطمئن هستید؟")) return;
    const supabase = createClient();
    await supabase.from("contacts").update({ is_active: false }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["contacts"] });
    qc.invalidateQueries({ queryKey: ["contact-balances"] });
  }, [qc]);

  const filtered = useMemo(() => {
    let result = contacts ?? [];
    const t = search.trim().toLowerCase();
    if (t) {
      result = result.filter((c) =>
        `${c.name} ${c.phone ?? ""} ${(c as any).code ?? ""}`.toLowerCase().includes(t)
      );
    }
    if (typeFilter) {
      result = result.filter((c) => c.type === typeFilter || c.type === "both");
    }
    if (balanceFilter) {
      result = result.filter((c) => {
        const bal = balances?.[c.id] ?? 0;
        return balanceFilter === "debtors" ? bal > 0 : bal < 0;
      });
    }
    result = [...result].sort((a, b) => {
      const balA = balances?.[a.id] ?? 0;
      const balB = balances?.[b.id] ?? 0;
      if (sortBy === "name_desc") return (b.name || "").localeCompare(a.name || "", "fa");
      if (sortBy === "balance_high") return Math.abs(balB) - Math.abs(balA);
      if (sortBy === "balance_low") return Math.abs(balA) - Math.abs(balB);
      if (sortBy === "newest") return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
      return (a.name || "").localeCompare(b.name || "", "fa");
    });
    return result;
  }, [contacts, search, typeFilter, balanceFilter, balances, sortBy]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [initialType, setInitialType] = useState<ContactType>("customer");

  useEffect(() => {
    const type = forcedType ?? (searchParams.get("type") as ContactType | null);
    const filter = forcedFilter ?? searchParams.get("filter");
    const action = forcedAction ?? searchParams.get("action");
    if (type === "customer" || type === "supplier" || type === "both") {
      setTypeFilter(type);
      setInitialType(type);
    } else if (!forcedType) {
      setTypeFilter("");
    }
    if (filter === "debtors" || filter === "creditors") setBalanceFilter(filter);
    else setBalanceFilter("");
    if (action === "new") {
      setEditing(null);
      setModalOpen(true);
    }
  }, [searchParams, forcedType, forcedFilter, forcedAction]);

  return (
    <div>
      <PageHeader
        title="اشخاص"
        subtitle="مشتری‌ها و تامین‌کننده‌ها"
        action={
          <button
            onClick={() => {
              setEditing(null);
              setInitialType(typeFilter || "customer");
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
          className="input w-32 sm:w-36"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as ContactType | "")}
        >
          <option value="">همه</option>
          <option value="customer">مشتری</option>
          <option value="supplier">تامین‌کننده</option>
        </select>
        <select
          className="input w-36 sm:w-44"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
        >
          <option value="name_asc">نام A-Z</option>
          <option value="name_desc">نام Z-A</option>
          <option value="balance_high">مانده بیشتر</option>
          <option value="balance_low">مانده کمتر</option>
          <option value="newest">جدیدترین</option>
        </select>
      </div>

      {isLoading ? (
        <Spinner label="در حال بارگذاری..." />
      ) : !contacts || contacts.length === 0 ? (
        <EmptyState title="هنوز شخصی ثبت نشده" description="مشتری یا تامین‌کننده اضافه کنید." />
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const bal = balances?.[c.id] ?? 0;
            return (
              <div key={c.id} className="card p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                    <User size={18} />
                  </div>
                  <div className="min-w-0">
                    <EntityLink type="contact" id={c.id} className="block truncate" fallbackClassName="block truncate font-medium text-slate-800">
                      {c.name || "بدون نام"}
                    </EntityLink>
                    <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5 flex-wrap">
                      {(c as any).code && <span className="font-mono text-primary">{(c as any).code}</span>}
                      <span className="badge bg-slate-100 text-slate-500">{TYPE_LABEL[c.type]}</span>
                      {c.phone && <PhoneLink phone={c.phone} className="text-xs" />}
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
                  <EntityActionMenu type="contact" id={c.id} label={c.name} phone={c.phone} />
                  <button
                    onClick={() => {
                      setEditing(c);
                      setModalOpen(true);
                    }}
                    className="text-slate-400 hover:text-primary p-1"
                  >
                    <Pencil size={17} />
                  </button>
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="text-slate-400 hover:text-rose-600 p-1"
                  >
                    <Trash2 size={17} />
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
          initialType={initialType}
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
  initialType = "customer",
  onClose,
}: {
  orgId: string | null;
  branchId: string | null;
  editing: Contact | null;
  initialType?: ContactType;
  onClose: () => void;
}) {
  const meta = (editing?.meta ?? {}) as Record<string, string>;
  const [firstName, setFirstName] = useState(meta.first_name ?? "");
  const [lastName, setLastName] = useState(meta.last_name ?? "");
  const [name, setName] = useState(editing?.name ?? [meta.first_name, meta.last_name].filter(Boolean).join(" "));
  const [type, setType] = useState<ContactType>(editing?.type ?? initialType);
  const [phone, setPhone] = useState(editing?.phone ?? "");
  const [email, setEmail] = useState(meta.email ?? "");
  const [birthDate, setBirthDate] = useState(meta.birth_date ?? "");
  const [nationalCode, setNationalCode] = useState(meta.national_code ?? "");
  const [jobTitle, setJobTitle] = useState(meta.job_title ?? "");
  const [gender, setGender] = useState(meta.gender ?? "");
  const [address, setAddress] = useState(editing?.address ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    const displayName = name.trim() || [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
    if (!displayName) {
      setError("نام یا نام خانوادگی الزامی است.");
      return;
    }
    if (!orgId) return;
    setSaving(true);
    const supabase = createClient();
    const payload = {
      name: displayName,
      type,
      phone: phone.trim() || null,
      address: address.trim() || null,
      description: description.trim() || null,
      meta: {
        ...(editing?.meta as Record<string, unknown> | undefined),
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        email: email.trim() || null,
        birth_date: birthDate || null,
        national_code: nationalCode.trim() || null,
        job_title: jobTitle.trim() || null,
        gender: gender || null,
      },
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><label className="label">نام</label><input className="input" value={firstName} onChange={(e) => { setFirstName(e.target.value); setName([e.target.value, lastName].filter(Boolean).join(" ")); }} /></div>
          <div><label className="label">نام خانوادگی</label><input className="input" value={lastName} onChange={(e) => { setLastName(e.target.value); setName([firstName, e.target.value].filter(Boolean).join(" ")); }} /></div>
        </div>
        <div>
          <label className="label">نام نمایشی *</label>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><label className="label">شماره تماس</label><input className="input text-left" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div><label className="label">ایمیل</label><input className="input text-left" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><label className="label">تاریخ تولد</label><DatePicker value={birthDate} onChange={setBirthDate} /></div>
          <div><label className="label">کد ملی</label><input className="input text-left" dir="ltr" value={nationalCode} onChange={(e) => setNationalCode(e.target.value)} /></div>
          <div><label className="label">شغل / عنوان</label><input className="input" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} /></div>
          <div><label className="label">جنسیت</label><select className="input" value={gender} onChange={(e) => setGender(e.target.value)}><option value="">—</option><option value="female">خانم</option><option value="male">آقا</option><option value="other">سایر</option></select></div>
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


export default function ContactsPage() {
  return <ContactsPageContent />;
}
