"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown, KeyRound, Loader2, Plus, Search, ShieldCheck, UserCog, Users,
} from "lucide-react";
import { Spinner } from "@/components/shared/ui";
import {
  Badge, Button, Card, Field, Input, Modal, Select, useConfirm, useToast,
} from "@/src/shared/ui";
import { displayUsername, toFaDigits } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { PermissionTreeEditor } from "./permission-tree-editor";
import { defaultPermissions, ROLE_LABELS, type ManagedUser } from "./users-access.helpers";

/**
 * کاربران و دسترسی‌ها.
 *
 * 🔴 مشکل اصلی نسخه‌ی قبلی: درخت مجوز با **۵۱ گزینه در ۹ گروه**
 * برای *هر کاربر* به‌صورت کاملاً باز رندر می‌شد. با ۵ کاربر یعنی
 * ۲۵۵ چک‌باکس روی یک صفحه. کاربر برای رسیدن به نفر سوم باید چند
 * صفحه اسکرول می‌کرد — همان چیزی که شما «شلوغ و پلوغ» توصیفش کردید.
 *
 * حالا هر کاربر یک ردیف جمع‌شده است و درخت مجوز فقط با کلیک باز
 * می‌شود. تک‌بازشو است (مثل سایدبار آکاردئونی): باز کردن یکی،
 * قبلی را می‌بندد تا هیچ‌وقت دو درخت هم‌زمان روی صفحه نباشند.
 */
export function UsersAccessManager() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const confirm = useConfirm();

  const [modalOpen, setModalOpen] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [issuingId, setIssuingId] = useState<string | null>(null);
  /* کد فقط یک بار و همین‌جا دیده می‌شود؛ در دیتابیس هش ذخیره شده است. */
  const [issued, setIssued] = useState<{ name: string; code: string; minutes: number } | null>(null);
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "خطا در دریافت کاربران");
      return json.users as ManagedUser[];
    },
  });

  const users = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data ?? [];
    return (data ?? []).filter(
      (u) =>
        (u.name ?? "").toLowerCase().includes(term) ||
        (u.email ?? "").toLowerCase().includes(term)
    );
  }, [data, search]);

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
      /*
        🔴 نسخه‌ی قبلی از alert() مرورگر استفاده می‌کرد — تنها جای
        برنامه که این کار را می‌کرد. پنجره‌ی سیستمی انگلیسی وسط یک
        رابط فارسی، و کاربر تا نزند «باشه» هیچ کاری نمی‌تواند بکند.
      */
      toast({ title: (e as Error).message, tone: "error" });
    } finally {
      setSavingId(null);
    }
  }

  async function toggleActive(user: ManagedUser) {
    if (user.is_active) {
      const ok = await confirm({
        title: `غیرفعال کردن «${user.name || displayUsername(user.email)}»؟`,
        description: "این کاربر دیگر نمی‌تواند وارد شود. اطلاعاتش حذف نمی‌شود و بعداً قابل فعال‌سازی است.",
        tone: "danger",
        confirmLabel: "غیرفعال کن",
      });
      if (!ok) return;
    }
    updateUser(user, { is_active: !user.is_active });
  }

  /**
   * صدور کد بازیابی برای یک کاربر.
   *
   * ⚠️ کد فقط در همین پاسخ برمی‌گردد. در دیتابیس هش ذخیره می‌شود،
   * پس اگر مدیر پنجره را ببندد، باید کد تازه بسازد.
   */
  async function issueResetCode(u: ManagedUser) {
    const ok = await confirm({
      title: "ساخت کد بازیابی رمز",
      description:
        "یک کد هشت‌رقمی ساخته می‌شود که ۳۰ دقیقه اعتبار دارد. کد را به خود کاربر بدهید تا رمز تازه‌اش را انتخاب کند. کدهای قبلی همین کاربر باطل می‌شوند.",
      confirmLabel: "بساز",
    });
    if (!ok) return;

    setIssuingId(u.user_id);
    try {
      const res = await fetch("/api/auth/reset-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: u.user_id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "کد ساخته نشد", description: json.error, tone: "error" });
        return;
      }
      setIssued({
        name: u.name || displayUsername(u.email),
        code: json.code,
        minutes: json.expires_in_minutes ?? 30,
      });
    } catch (e) {
      toast({ title: "کد ساخته نشد", description: (e as Error).message, tone: "error" });
    } finally {
      setIssuingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <Card className="p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-extrabold text-foreground">
            <Users size={18} aria-hidden />
            کاربران و دسترسی‌ها
            {users.length > 0 && (
              <span className="text-2xs font-bold text-muted-foreground">
                ({toFaDigits(users.length)})
              </span>
            )}
          </h2>
          <Button size="sm" icon={<Plus size={15} />} onClick={() => setModalOpen(true)}>
            ساخت کاربر
          </Button>
        </div>

        {/* جستجو فقط وقتی معنا دارد که فهرست به‌قدر کافی بلند باشد. */}
        {(data?.length ?? 0) > 3 && (
          <div className="mb-3">
            <Field label="جستجوی کاربر">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="نام یا نام کاربری"
              />
            </Field>
          </div>
        )}

        {isLoading ? (
          <Spinner />
        ) : error ? (
          <div className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive-text">
            {(error as Error).message}
          </div>
        ) : users.length === 0 ? (
          <p className="py-3 text-xs text-muted-foreground">کاربری یافت نشد.</p>
        ) : (
          <ul className="space-y-2">
            {users.map((u) => {
              const perms =
                u.permissions && u.permissions.length ? u.permissions : defaultPermissions(u.role);
              const open = expandedId === u.id;
              const isOwner = u.role === "owner";

              return (
                <li key={u.id} className="rounded-2xl border border-border">
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-bold text-foreground">
                          {u.name || displayUsername(u.email)}
                        </span>
                        {!u.is_active && <Badge tone="danger">غیرفعال</Badge>}
                        {isOwner && <Badge tone="primary">مدیر کل</Badge>}
                      </div>
                      <div className="truncate text-2xs text-muted-foreground" dir="ltr">
                        {displayUsername(u.email)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Select
                        aria-label={`نقش ${u.name || displayUsername(u.email)}`}
                        className="w-32 py-2 text-xs"
                        value={u.role}
                        disabled={savingId === u.id}
                        onChange={(e) =>
                          updateUser(u, {
                            role: e.target.value,
                            permissions: defaultPermissions(e.target.value),
                          })
                        }
                      >
                        {Object.entries(ROLE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </Select>

                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => toggleActive(u)}
                        disabled={savingId === u.id}
                      >
                        {u.is_active ? "غیرفعال" : "فعال"}
                      </Button>

                      {/*
                        کد بازیابی رمز.

                        🔴 چرا کد و نه تعیین مستقیم رمز؟
                        اگر مدیر خودش رمز را بگذارد، **رمز کاربر را
                        می‌داند** و می‌تواند بعداً به‌جای او سند مالی
                        ثبت کند. با کد یک‌بارمصرف، رمز نهایی را فقط
                        خود کاربر می‌داند.
                      */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => issueResetCode(u)}
                        disabled={savingId === u.id || issuingId === u.user_id}
                        icon={<KeyRound size={15} />}
                      >
                        {issuingId === u.user_id ? "..." : "کد بازیابی"}
                      </Button>

                      {/*
                        درخت مجوز پیش‌فرض بسته است. مدیر کل همه‌ی
                        دسترسی‌ها را دارد و درختش قابل تغییر نیست، پس
                        اصلاً دکمه‌اش را نشان نمی‌دهیم.
                      */}
                      {!isOwner && (
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-expanded={open}
                          onClick={() => setExpandedId(open ? null : u.id)}
                          icon={
                            <ChevronDown
                              size={15}
                              className={cn("transition-transform", open && "rotate-180")}
                            />
                          }
                        >
                          دسترسی‌ها
                        </Button>
                      )}
                    </div>
                  </div>

                  {open && !isOwner && (
                    <div className="border-t border-border p-3">
                      {savingId === u.id && (
                        <div className="mb-2 flex items-center gap-2 text-2xs text-muted-foreground">
                          <Loader2 className="animate-spin" size={13} />
                          در حال ذخیره…
                        </div>
                      )}
                      <PermissionTreeEditor
                        value={perms}
                        disabled={savingId === u.id}
                        onChange={(permissions) => updateUser(u, { permissions })}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/*
        نمایش کد صادرشده.

        🔴 کد فقط همین یک بار دیده می‌شود. در دیتابیس هش ذخیره شده
        و بازیابی‌اش ممکن نیست — اگر مدیر پنجره را ببندد باید کد
        تازه بسازد. این عمدی است: کدی که بشود بارها دیدش، عملاً
        رمز دوم است.
      */}
      {issued && (
        <Modal open onClose={() => setIssued(null)} title="کد بازیابی رمز" size="md">
          <div className="space-y-4">
            <p className="text-sm leading-7 text-muted-foreground">
              این کد را به <span className="font-bold text-foreground">{issued.name}</span> بدهید.
              او باید در صفحه‌ی «رمز عبور را فراموش کرده‌ام» آن را وارد کند و رمز تازه‌اش را
              انتخاب کند.
            </p>

            <div
              dir="ltr"
              className="select-all rounded-2xl bg-primary/[0.08] py-5 text-center text-3xl font-black tracking-[0.3em] text-primary"
            >
              {issued.code}
            </div>

            {/*
              توکن‌های عددی هرکدام span جدا با جداکننده‌ی aria-hidden.
              رشته‌ی `${الف} · ${ب}` در متن راست‌به‌چپ بازچینش می‌شود و
              اعداد به هم می‌چسبند — در DOM درست است و فقط رندر خراب
              می‌شود، پس تست رشته‌ای نمی‌گیردش.
            */}
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="tabular-nums">اعتبار {toFaDigits(issued.minutes)} دقیقه</span>
              <span aria-hidden="true">·</span>
              <span>یک‌بار مصرف</span>
              <span aria-hidden="true">·</span>
              <span>دیگر نمایش داده نمی‌شود</span>
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => {
                  navigator.clipboard?.writeText(issued.code);
                  toast({ title: "کد کپی شد", tone: "success" });
                }}
              >
                کپی کد
              </Button>
              <Button variant="secondary" onClick={() => setIssued(null)}>
                بستن
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {modalOpen && (
        <CreateUserModal
          onClose={() => {
            setModalOpen(false);
            qc.invalidateQueries({ queryKey: ["admin-users"] });
          }}
        />
      )}
    </div>
  );
}

/** ساخت کاربر تازه. */
function CreateUserModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("cashier");
  const [permissions, setPermissions] = useState<string[]>(defaultPermissions("cashier"));
  const [showPerms, setShowPerms] = useState(false);
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
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="نام">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="نام کاربری" required>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              dir="ltr"
              className="text-left"
            />
          </Field>
          <Field label="رمز عبور" required>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              dir="ltr"
              className="text-left"
            />
          </Field>
          <Field label="نقش" hint="با تغییر نقش، دسترسی‌های پیش‌فرض همان نقش اعمال می‌شود.">
            <Select
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setPermissions(defaultPermissions(e.target.value));
              }}
            >
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {/*
          درخت ۵۱ گزینه‌ای پیش‌فرض بسته است.
          در بیشتر موارد نقش پیش‌فرض کافی است و باز بودنِ درخت فقط
          فرم را ترسناک می‌کرد.
        */}
        {role !== "owner" && (
          <div className="rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setShowPerms(!showPerms)}
              aria-expanded={showPerms}
              className="flex w-full items-center justify-between gap-2 p-3 text-right"
            >
              <span className="flex items-center gap-2 text-sm font-bold text-foreground">
                <ShieldCheck size={16} aria-hidden />
                دسترسی‌های اختصاصی
              </span>
              <span className="flex items-center gap-2 text-2xs text-muted-foreground">
                {toFaDigits(permissions.length)} مورد انتخاب شده
                <ChevronDown
                  size={15}
                  className={cn("transition-transform", showPerms && "rotate-180")}
                />
              </span>
            </button>
            {showPerms && (
              <div className="border-t border-border p-3">
                <PermissionTreeEditor value={permissions} onChange={setPermissions} />
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive-text">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={save}
            loading={saving}
            disabled={!email.trim() || !password.trim()}
            className="flex-1"
          >
            ساخت کاربر
          </Button>
          <Button variant="secondary" onClick={onClose}>
            انصراف
          </Button>
        </div>
      </div>
    </Modal>
  );
}
