"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Shield, ShieldAlert, Trash2, UserCog, X } from "lucide-react";
import { PageHeader, Spinner, EmptyState } from "@/components/shared/ui";
import { Badge, Card, useConfirm, useToast } from "@/src/shared/ui";
import { displayUsername, toFaDigits, toJalali } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/**
 * مدیریت ادمین‌های پلتفرم و نقش‌های سفارشی.
 *
 * 🔴 مسئله‌ای که حل می‌کند: چهار نقش ثابت بودند و برای دادن یک مجوز
 * اضافه به کسی، تنها راه ارتقای او به «مدیر ارشد» بود — یعنی دادن
 * همه‌ی اختیارات، از جمله بازنشانی رمز و مدیریت بقیه‌ی ادمین‌ها.
 */

type Permission = {
  key: string;
  label: string;
  description: string | null;
  category: string;
  risk: "low" | "medium" | "high";
};

type Admin = {
  userId: string;
  email: string | null;
  role: string;
  customPermissions: string[];
  note: string | null;
  createdAt: string;
};

const ROLE_LABEL: Record<string, string> = {
  super_admin: "مدیر ارشد",
  support: "پشتیبانی",
  finance: "مالی",
  readonly: "فقط مشاهده",
  custom: "سفارشی",
};

const ROLE_TONE: Record<string, "danger" | "info" | "warning" | "neutral" | "primary"> = {
  super_admin: "danger",
  support: "info",
  finance: "warning",
  readonly: "neutral",
  custom: "primary",
};

const RISK_LABEL: Record<Permission["risk"], string> = {
  low: "کم‌خطر",
  medium: "متوسط",
  high: "پرخطر",
};

export default function AdminRolesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Admin | "new" | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["platform-admins"],
    queryFn: async () => {
      const res = await fetch("/api/admin/admins");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا در دریافت فهرست");
      return json as { admins: Admin[]; permissions: Permission[] };
    },
  });

  const remove = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch("/api/admin/admins", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "حذف ناموفق بود");
    },
    onSuccess: () => {
      toast({ tone: "success", title: "دسترسی حذف شد" });
      qc.invalidateQueries({ queryKey: ["platform-admins"] });
    },
    onError: (e: Error) => toast({ tone: "error", title: e.message }),
  });

  async function confirmRemove(admin: Admin) {
    const ok = await confirm({
      title: "حذف دسترسی ادمین",
      description: `دسترسی «${admin.email ?? admin.userId}» به پنل مدیریت پلتفرم حذف می‌شود. حساب کاربری خودش دست‌نخورده می‌ماند.`,
      tone: "danger",
      confirmLabel: "حذف دسترسی",
      cancelLabel: "انصراف",
    });
    if (ok) remove.mutate(admin.userId);
  }

  const permissions = data?.permissions ?? [];
  const admins = data?.admins ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="ادمین‌ها و سطوح دسترسی"
        subtitle="نقش ثابت یا ساخت نقش سفارشی با انتخاب تک‌تک مجوزها"
        action={
          <button onClick={() => setEditing("new")} className="btn-primary">
            <Plus size={16} aria-hidden /> افزودن ادمین
          </button>
        }
      />

      {isLoading ? (
        <Spinner />
      ) : error ? (
        <div className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive-text">
          {(error as Error).message}
        </div>
      ) : admins.length === 0 ? (
        <EmptyState icon={Shield} title="ادمینی ثبت نشده" />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-border">
            {admins.map((a) => (
              <li key={a.userId} className="p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-bold text-foreground">
                        {displayUsername(a.email ?? undefined) ?? a.userId.slice(0, 8)}
                      </span>
                      <Badge tone={ROLE_TONE[a.role] ?? "neutral"}>
                        {ROLE_LABEL[a.role] ?? a.role}
                      </Badge>
                      {a.role === "custom" && (
                        <span className="text-2xs text-muted-foreground">
                          {toFaDigits(a.customPermissions.length)} مجوز
                        </span>
                      )}
                    </div>
                    {a.email && (
                      <div className="mt-0.5 text-2xs text-muted-foreground" dir="ltr">
                        {a.email}
                      </div>
                    )}
                    {a.role === "custom" && a.customPermissions.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {a.customPermissions.map((key) => {
                          const p = permissions.find((x) => x.key === key);
                          return (
                            <span
                              key={key}
                              className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground"
                            >
                              {p?.label ?? key}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {a.note && (
                      <div className="mt-1 text-2xs text-muted-foreground">{a.note}</div>
                    )}
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      از {toJalali(a.createdAt)}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => setEditing(a)}
                      className="inline-flex min-h-9 items-center gap-1 rounded-xl border border-border bg-card px-3 text-2xs font-bold text-foreground transition hover:bg-muted"
                    >
                      <UserCog size={13} aria-hidden /> ویرایش
                    </button>
                    <button
                      onClick={() => confirmRemove(a)}
                      aria-label={`حذف دسترسی ${a.email ?? a.userId}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive-text"
                    >
                      <Trash2 size={14} aria-hidden />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {editing && (
        <RoleEditor
          admin={editing === "new" ? null : editing}
          permissions={permissions}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            toast({ tone: "success", title: "ذخیره شد" });
            qc.invalidateQueries({ queryKey: ["platform-admins"] });
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function RoleEditor({
  admin,
  permissions,
  onClose,
  onSaved,
}: {
  admin: Admin | null;
  permissions: Permission[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [userId, setUserId] = useState(admin?.userId ?? "");
  const [role, setRole] = useState(admin?.role ?? "readonly");
  const [selected, setSelected] = useState<string[]>(admin?.customPermissions ?? []);
  const [note, setNote] = useState(admin?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* مجوزها بر اساس دسته گروه می‌شوند تا فهرست ۱۳تایی قابل مرور بماند. */
  const grouped = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const p of permissions) {
      if (!map.has(p.category)) map.set(p.category, []);
      map.get(p.category)!.push(p);
    }
    return [...map.entries()];
  }, [permissions]);

  function toggle(key: string) {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId.trim(),
          role,
          custom_permissions: role === "custom" ? selected : [],
          note: note.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "ذخیره ناموفق بود");
        return;
      }
      onSaved();
    } catch {
      setError("ارتباط با سرور برقرار نشد.");
    } finally {
      setSaving(false);
    }
  }

  const highRiskSelected = selected.filter(
    (k) => permissions.find((p) => p.key === k)?.risk === "high"
  );

  return (
    <div
      className="fixed inset-0 flex items-start justify-center overflow-y-auto p-3 sm:items-center"
      style={{ zIndex: "var(--z-modal)" }}
    >
      <button className="fixed inset-0 bg-foreground/30 backdrop-blur-[2px]" onClick={onClose} aria-label="بستن" />
      <form
        onSubmit={save}
        role="dialog"
        aria-modal="true"
        aria-label={admin ? "ویرایش دسترسی ادمین" : "افزودن ادمین"}
        className="relative my-auto w-full max-w-2xl rounded-2xl border border-border bg-card p-4 shadow-2xl sm:p-5"
        dir="rtl"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-extrabold text-foreground">
            {admin ? "ویرایش دسترسی" : "افزودن ادمین"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-destructive-text"
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label htmlFor="admin-user-id" className="label">
              شناسه کاربر (UUID)
            </label>
            <input
              id="admin-user-id"
              className="input text-left font-mono text-xs"
              dir="ltr"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              disabled={!!admin}
              placeholder="00000000-0000-0000-0000-000000000000"
            />
            <p className="mt-1 text-2xs text-muted-foreground">
              شناسه را از صفحه‌ی «کاربران پلتفرم» بردارید.
            </p>
          </div>

          <div>
            <label htmlFor="admin-role" className="label">
              نقش
            </label>
            <select
              id="admin-role"
              className="input"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="readonly">فقط مشاهده</option>
              <option value="support">پشتیبانی</option>
              <option value="finance">مالی</option>
              <option value="super_admin">مدیر ارشد — همه‌ی اختیارات</option>
              <option value="custom">سفارشی — انتخاب تک‌تک مجوزها</option>
            </select>
          </div>

          {role === "custom" && (
            <div className="rounded-xl border border-border p-3">
              <div className="mb-2 text-2xs font-bold text-muted-foreground">
                مجوزها {selected.length > 0 && `(${toFaDigits(selected.length)} انتخاب‌شده)`}
              </div>
              <div className="max-h-[40vh] space-y-3 overflow-y-auto" tabIndex={0} role="region" aria-label="فهرست مجوزها">
                {grouped.map(([category, items]) => (
                  <fieldset key={category}>
                    <legend className="mb-1 text-2xs font-extrabold text-foreground">{category}</legend>
                    <div className="space-y-1">
                      {items.map((p) => (
                        <label
                          key={p.key}
                          className="flex cursor-pointer items-start gap-2 rounded-lg p-1.5 transition hover:bg-muted/50"
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 shrink-0"
                            checked={selected.includes(p.key)}
                            onChange={() => toggle(p.key)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span className="text-2xs font-bold text-foreground">{p.label}</span>
                              {p.risk !== "low" && (
                                <span
                                  className={cn(
                                    "rounded px-1 py-0.5 text-[10px] font-bold",
                                    p.risk === "high"
                                      ? "bg-destructive/10 text-destructive-text"
                                      : "bg-warning-soft text-warning-onSoft"
                                  )}
                                >
                                  {RISK_LABEL[p.risk]}
                                </span>
                              )}
                            </span>
                            {p.description && (
                              <span className="mt-0.5 block text-[10px] leading-4 text-muted-foreground">
                                {p.description}
                              </span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}
              </div>

              {highRiskSelected.length > 0 && (
                <div className="mt-2 rounded-lg bg-warning-soft px-2.5 py-2 text-[10px] leading-relaxed text-warning-onSoft">
                  <ShieldAlert size={11} className="ml-1 inline" aria-hidden />
                  {toFaDigits(highRiskSelected.length)} مجوز پرخطر انتخاب شده است. این‌ها دسترسی به
                  داده‌ی کسب‌وکار مشتریان یا کنترل حساب کاربران می‌دهند.
                </div>
              )}
            </div>
          )}

          <div>
            <label htmlFor="admin-note" className="label">
              یادداشت (اختیاری)
            </label>
            <input
              id="admin-note"
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="مثلاً: پشتیبان شیفت عصر"
            />
          </div>

          {error && (
            <div role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-2xs text-destructive-text">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving || !userId.trim()} className="btn-primary flex-1 disabled:opacity-50">
              {saving ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Shield size={15} aria-hidden />}
              ذخیره
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">
              انصراف
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
