"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { displayUsername } from "@/lib/utils/format";
import { PageHeader, Modal, Spinner } from "@/components/shared/ui";
import { Plus, Loader2, Tag, Landmark, FolderTree, Trash2, Pencil, Check, X, Users, Shield, Palette, Building2, SlidersHorizontal, Sparkles } from "lucide-react";
import { applyTheme, DEFAULT_THEME, THEMES, THEME_STORAGE_KEY, THEME_CHANGE_EVENT, type ThemeId } from "@/lib/theme";
import { PERMISSION_TREE, uniquePermissions, type PermissionTreeItem } from "@/lib/access/permission-tree";

export function SettingsContent({ section = "all" }: { section?: "all" | "catalog" | "accounts" | "users" }) {
  const { orgId, branchId } = useOrg();

  if (section === "all") {
    const cards = [
      { title: "عمومی", desc: "اطلاعات کسب‌وکار، ظاهر برنامه و تنظیمات عمومی فاکتور", href: "/settings/general", icon: Building2, tone: "bg-primary/10 text-primary" },
      { title: "کاربران و دسترسی‌ها", desc: "ساخت کاربر، نقش‌ها و سطح دسترسی", href: "/settings/users", icon: Shield, tone: "bg-violet-50 text-violet-600" },
      { title: "مالی", desc: "حساب‌ها، دسته‌بندی هزینه و روش‌های پرداخت", href: "/settings/accounts", icon: Landmark, tone: "bg-emerald-50 text-emerald-600" },
      { title: "کاتالوگ", desc: "دسته‌بندی کالا، برندها و لیست قیمت‌ها", href: "/settings/catalog", icon: FolderTree, tone: "bg-amber-50 text-amber-600" },
      { title: "پیشرفته", desc: "گزارش فعالیت، تنظیمات باشگاه و امکانات مدیریتی", href: "/activity", icon: SlidersHorizontal, tone: "bg-slate-100 text-slate-700" },
    ];
    return (
      <div className="space-y-5">
        <PageHeader title="تنظیمات" subtitle="داشبورد تنظیمات سیستم؛ برای ویرایش جزئیات وارد هر بخش شوید" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link key={card.title} href={card.href} className="group rounded-[26px] border border-white/80 bg-white/90 p-5 shadow-sm shadow-slate-900/[0.04] backdrop-blur transition hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/[0.08]">
                <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${card.tone}`}><Icon size={22} /></div>
                <h2 className="text-base font-black text-slate-800 group-hover:text-primary">{card.title}</h2>
                <p className="mt-2 text-xs leading-6 text-slate-500">{card.desc}</p>
              </Link>
            );
          })}
        </div>
        <div className="rounded-[24px] border border-primary/15 bg-primary/[0.04] p-4 text-sm text-slate-600">
          <div className="mb-1 flex items-center gap-2 font-extrabold text-primary"><Sparkles size={16} /> راهنما</div>
          مسیرهای زیرین حذف نشده‌اند؛ این صفحه فقط نقطه ورود تنظیمات را ساده‌تر می‌کند.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="تنظیمات"
        subtitle="مدیریت دسته‌بندی‌ها، برندها، حساب‌ها و دسته هزینه‌ها"
      />
      {section === "catalog" && (
        <div className="space-y-4">
          <ThemeSettings />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ManageableList orgId={orgId} branchId={branchId} table="categories" title="دسته‌بندی کالا" icon={<FolderTree size={18} />} />
          <ManageableList orgId={orgId} branchId={branchId} table="brands" title="برندها" icon={<Tag size={18} />} />
          <ManageableList orgId={orgId} branchId={branchId} table="expense_categories" title="دسته‌بندی هزینه" icon={<Tag size={18} />} />
          </div>
        </div>
      )}
      {section === "accounts" && <AccountsManager orgId={orgId} branchId={branchId} />}
      {section === "users" && <div id="users" className="scroll-mt-24"><UsersAccessManager /></div>}
    </div>
  );

}


function ThemeSettings() {
  const [selected, setSelected] = useState<ThemeId>(() => {
    if (typeof window === "undefined") return DEFAULT_THEME;
    return (window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null) ?? DEFAULT_THEME;
  });

  function choose(themeId: ThemeId) {
    setSelected(themeId);
    window.localStorage.setItem(THEME_STORAGE_KEY, themeId);
    applyTheme(themeId);
    window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: themeId }));
  }

  return (
    <div className="rounded-[24px] border border-white/80 bg-white/90 p-5 shadow-sm shadow-slate-900/[0.04] backdrop-blur">
      <div className="flex items-center gap-2 mb-4 font-semibold text-slate-800">
        <Palette size={18} /> تم رنگی نرم‌افزار
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        {THEMES.map((theme) => (
          <button
            key={theme.id}
            type="button"
            onClick={() => choose(theme.id)}
            className={`text-right rounded-2xl border p-4 transition hover:shadow-sm ${selected === theme.id ? "border-primary bg-primary/[0.06]" : "border-slate-200 bg-white hover:border-primary/20"}`}
          >
            <div className="flex gap-1 mb-3">
              {theme.swatches.map((color) => <span key={color} className="w-7 h-7 rounded-full border border-white shadow-sm" style={{ backgroundColor: color }} />)}
            </div>
            <div className="font-bold text-sm text-slate-800">{theme.name}</div>
            <div className="text-xs text-slate-500 mt-1 leading-5">{theme.description}</div>
          </button>
        ))}
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
    <div className="rounded-[24px] border border-white/80 bg-white/90 p-5 shadow-sm shadow-slate-900/[0.04] backdrop-blur">
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
                        className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/[0.06] rounded-lg"
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
    <div className="rounded-[24px] border border-white/80 bg-white/90 p-5 shadow-sm shadow-slate-900/[0.04] backdrop-blur">
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

// ==============================================================
// مدیریت کاربران و دسترسی‌ها
// ==============================================================
const PERMISSION_GROUPS = PERMISSION_TREE.map((group) => ({ key: group.key, label: group.label, permissions: group.permissions }));

const ROLE_LABELS: Record<string, string> = {
  owner: "مدیر کل",
  manager: "مدیر",
  cashier: "فروشنده",
  inventory: "انباردار",
  accountant: "حسابدار",
};

type ManagedUser = {
  id: string;
  user_id: string;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  permissions: string[] | null;
};

function defaultPermissions(role: string) {
  if (role === "owner") return ["*"];
  if (role === "manager") return uniquePermissions();
  if (role === "cashier") return ["contacts.view", "contacts.call", "sales.view", "sales.create", "products.view", "finance.create"];
  if (role === "inventory") return ["products.view", "products.edit", "inventory.view", "inventory.adjust"];
  if (role === "accountant") return ["contacts.view", "sales.view", "purchases.view", "finance.view", "finance.create", "reports.view"];
  return [];
}


function TreeCheckbox({ checked, indeterminate, disabled, onChange }: { checked: boolean; indeterminate?: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate && !checked);
  }, [checked, indeterminate]);
  return <input ref={ref} type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />;
}

function hasAll(perms: string[], required: string[]) {
  return required.length === 0 || required.every((permission) => perms.includes("*") || perms.includes(permission));
}

function togglePermissions(current: string[], permissions: string[], checked: boolean) {
  const next = new Set(current.filter((permission) => permission !== "*"));
  permissions.forEach((permission) => checked ? next.add(permission) : next.delete(permission));
  return Array.from(next);
}

function PermissionTreeEditor({ value, disabled, onChange }: { value: string[]; disabled?: boolean; onChange: (next: string[]) => void }) {
  const effective = value.includes("*") ? uniquePermissions() : value;
  function renderGroup(group: PermissionTreeItem) {
    const childPermissions = uniquePermissions(group.children ?? []);
    const groupPermissions = Array.from(new Set([...group.permissions, ...childPermissions]));
    const checkedChildren = (group.children ?? []).filter((child) => hasAll(effective, child.permissions)).length;
    const checked = hasAll(effective, groupPermissions);
    const indeterminate = checkedChildren > 0 && !checked;
    return (
      <div key={group.key} className="rounded-2xl border border-slate-100 bg-white p-3">
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <span className="font-extrabold text-slate-800">{group.label}</span>
          <TreeCheckbox checked={checked} indeterminate={indeterminate} disabled={disabled} onChange={(nextChecked) => onChange(togglePermissions(effective, groupPermissions, nextChecked))} />
        </label>
        {group.warning && <div className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">⚠️ {group.warning}</div>}
        {group.recommendedWith?.length ? <div className="mt-2 text-[11px] text-slate-400">پیشنهاد پیش‌نیاز: {group.recommendedWith.join("، ")}</div> : null}
        {group.children?.length ? (
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {group.children.map((child) => {
              const childChecked = hasAll(effective, child.permissions);
              return (
                <label key={child.key} className="flex cursor-pointer items-start gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                  <TreeCheckbox checked={childChecked} disabled={disabled} onChange={(nextChecked) => onChange(togglePermissions(effective, child.permissions, nextChecked))} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-slate-700">{child.label}</span>
                    {child.warning && <span className="mt-1 block text-[11px] leading-5 text-amber-700">⚠️ {child.warning}</span>}
                    {child.recommendedWith?.length ? <span className="mt-1 block text-[11px] text-slate-400">پیشنهاد: {child.recommendedWith.join("، ")}</span> : null}
                  </span>
                </label>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }
  return <div className="space-y-3">{PERMISSION_TREE.map(renderGroup)}</div>;
}

function UsersAccessManager() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "خطا در دریافت کاربران");
      return json.users as ManagedUser[];
    },
  });

  async function updateUser(user: ManagedUser, patch: Partial<ManagedUser>) {
    setSavingId(user.id);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          membership_id: user.id,
          user_id: user.user_id,
          role: patch.role,
          is_active: patch.is_active,
          permissions: patch.permissions,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "خطا در ذخیره دسترسی");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="rounded-[24px] border border-white/80 bg-white/90 p-5 shadow-sm shadow-slate-900/[0.04] backdrop-blur">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 font-semibold text-slate-800">
          <Users size={18} /> کاربران و دسترسی‌ها
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary text-sm">
          <Plus size={16} /> ساخت کاربر
        </button>
      </div>

      {isLoading ? <Spinner /> : error ? (
        <div className="rounded-xl bg-rose-50 text-rose-700 text-sm p-4">{(error as Error).message}</div>
      ) : (
        <div className="space-y-3">
          {data?.map((u) => {
            const perms = u.permissions && u.permissions.length ? u.permissions : defaultPermissions(u.role);
            return (
              <div key={u.id} className="rounded-2xl border border-slate-100 p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                  <div>
                    <div className="font-medium text-slate-800">{u.name || displayUsername(u.email)}</div>
                    <div className="text-xs text-slate-400" dir="ltr">{displayUsername(u.email)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select className="input w-36" value={u.role} onChange={(e) => updateUser(u, { role: e.target.value, permissions: defaultPermissions(e.target.value) })}>
                      {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <button onClick={() => updateUser(u, { is_active: !u.is_active })} className={u.is_active ? "btn-secondary text-rose-600" : "btn-secondary text-emerald-600"}>
                      {u.is_active ? "غیرفعال" : "فعال"}
                    </button>
                  </div>
                </div>
                <PermissionTreeEditor value={perms} disabled={savingId === u.id || u.role === "owner"} onChange={(permissions) => updateUser(u, { permissions })} />
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && <CreateUserModal onClose={() => { setModalOpen(false); qc.invalidateQueries({ queryKey: ["admin-users"] }); }} />}
    </div>
  );
}

function CreateUserModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("cashier");
  const [permissions, setPermissions] = useState<string[]>(defaultPermissions("cashier"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role, permissions }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "خطا در ساخت کاربر");
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="ساخت کاربر جدید" size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><label className="label">نام</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><label className="label">ایمیل *</label><input className="input text-left" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><label className="label">رمز عبور *</label><input className="input text-left" dir="ltr" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <div><label className="label">نقش</label><select className="input" value={role} onChange={(e) => { setRole(e.target.value); setPermissions(defaultPermissions(e.target.value)); }}>{Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        </div>
        <div>
          <div className="text-sm font-medium text-slate-700 mb-2">دسترسی‌ها</div>
          <PermissionTreeEditor value={permissions} disabled={role === "owner"} onChange={setPermissions} />
        </div>
        {error && <div className="rounded-xl bg-rose-50 text-rose-700 text-sm px-4 py-3">{error}</div>}
        <div className="flex gap-2"><button onClick={save} disabled={saving} className="btn-primary flex-1">{saving && <Loader2 className="animate-spin" size={18} />} ساخت کاربر</button><button onClick={onClose} className="btn-secondary">انصراف</button></div>
      </div>
    </Modal>
  );
}


export default function SettingsPage() {
  return <SettingsContent />;
}
