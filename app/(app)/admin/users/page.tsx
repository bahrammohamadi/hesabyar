"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, UserCog, ShieldAlert, Mail, Phone, Building2, KeyRound, Loader2, X } from "lucide-react";
import { PageHeader, Spinner, EmptyState } from "@/components/shared/ui";
import { Badge, Button, Card, Select, useToast } from "@/src/shared/ui";
import { businessTypeLabel } from "@/lib/business-types";
import { firstPasswordError } from "@/lib/security/password";
import { displayUsername, toFaDigits, toJalali } from "@/lib/utils/format";

type AdminUser = {
  user_id: string;
  email: string;
  joined_at: string;
  last_sign_in_at: string | null;
  email_verified: boolean;
  org_id: string | null;
  org_name: string | null;
  approval_status: string | null;
  owner_full_name: string | null;
  owner_phone: string | null;
  business_type: string | null;
  trial_ends_at: string | null;
  member_role: string | null;
  platform_role: string | null;
};

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  approved: "success", pending: "warning", rejected: "danger", suspended: "neutral",
};
const STATUS_LABEL: Record<string, string> = {
  approved: "تأیید شده", pending: "در انتظار", rejected: "رد شده", suspended: "معلق",
};

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [term, setTerm] = useState("");
  const [applied, setApplied] = useState("");
  // کاربری که رمزش قرار است بازنشانی شود؛ null یعنی مودال بسته است.
  const [pwTarget, setPwTarget] = useState<AdminUser | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-users", applied, status],
    queryFn: async (): Promise<AdminUser[]> => {
      const p = new URLSearchParams();
      if (applied) p.set("q", applied);
      if (status) p.set("status", status);
      const res = await fetch(`/api/admin/users/search?${p}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "خطا در جستجو");
      return json.users as AdminUser[];
    },
  });

  /** ورود به‌جای کاربر — دلیل اجباری است. */
  async function impersonate(u: AdminUser) {
    const reason = window.prompt(
      `دلیل ورود به حساب «${displayUsername(u.email)}» را بنویسید (در گزارش ثبت می‌شود):`
    );
    if (reason === null) return;
    if (reason.trim().length < 5) {
      toast({ tone: "error", title: "دلیل باید حداقل ۵ نویسه باشد" });
      return;
    }

    setBusy(u.user_id);
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: u.user_id, reason: reason.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "عملیات ناموفق بود");
      toast({ tone: "success", title: "جلسه آغاز شد", description: "حداکثر ۳۰ دقیقه اعتبار دارد." });
      qc.invalidateQueries({ queryKey: ["impersonation-session"] });
    } catch (e) {
      toast({ tone: "error", title: "ورود ناموفق", description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const rows = data ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="کاربران پلتفرم"
        subtitle="جستجو بر اساس ایمیل، نام، شماره تماس یا نام کسب‌وکار"
      />

      <Card className="p-3 sm:p-4">
        <form
          onSubmit={(e) => { e.preventDefault(); setApplied(term.trim()); }}
          className="flex flex-col gap-2 sm:flex-row"
        >
          <div className="relative flex-1">
            <Search size={17} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="ایمیل، نام، شماره تماس یا نام کسب‌وکار…"
              aria-label="عبارت جستجو"
              className="min-h-11 w-full rounded-xl border border-border bg-card pr-10 pl-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <Select
            className="sm:w-44"
            aria-label="فیلتر وضعیت"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">همه‌ی وضعیت‌ها</option>
            <option value="approved">تأیید شده</option>
            <option value="pending">در انتظار تأیید</option>
            <option value="suspended">معلق</option>
            <option value="rejected">رد شده</option>
          </Select>
          <Button type="submit" className="shrink-0">جستجو</Button>
        </form>
      </Card>

      {isLoading ? (
        <Spinner label="در حال جستجو..." />
      ) : error ? (
        <div className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive-text">
          {(error as Error).message}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={UserCog} title="کاربری یافت نشد" description="عبارت دیگری را امتحان کنید." />
      ) : (
        <Card className="overflow-hidden">
          <p className="border-b border-border px-4 py-2 text-2xs text-muted-foreground">
            {toFaDigits(rows.length)} کاربر
          </p>
          <ul className="divide-y divide-border">
            {rows.map((u) => (
              <li key={u.user_id} className="p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-bold text-foreground">
                        {u.owner_full_name || displayUsername(u.email)}
                      </span>
                      {u.platform_role && <Badge tone="info">ادمین: {u.platform_role}</Badge>}
                      {!u.email_verified && <Badge tone="warning">ایمیل تأیید نشده</Badge>}
                      {u.approval_status && (
                        <Badge tone={STATUS_TONE[u.approval_status] ?? "neutral"}>
                          {STATUS_LABEL[u.approval_status] ?? u.approval_status}
                        </Badge>
                      )}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1" dir="ltr">
                        <Mail size={11} aria-hidden />{u.email}
                      </span>
                      {u.owner_phone && (
                        <span className="inline-flex items-center gap-1" dir="ltr">
                          <Phone size={11} aria-hidden />{u.owner_phone}
                        </span>
                      )}
                      {u.org_name && (
                        <span className="inline-flex items-center gap-1">
                          <Building2 size={11} aria-hidden />{u.org_name}
                          {u.business_type && ` · ${businessTypeLabel(u.business_type)}`}
                        </span>
                      )}
                    </div>

                    <div className="mt-1 text-2xs text-muted-foreground">
                      عضویت: {toJalali(u.joined_at)}
                      {u.last_sign_in_at && ` · آخرین ورود: ${toJalali(u.last_sign_in_at)}`}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {u.org_id && (
                      <Link
                        href={`/admin/organizations/${u.org_id}`}
                        className="inline-flex min-h-9 items-center rounded-xl border border-border bg-card px-3 text-2xs font-bold text-foreground transition hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      >
                        کسب‌وکار
                      </Link>
                    )}
                    {!u.platform_role && (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={busy === u.user_id}
                          onClick={() => impersonate(u)}
                          icon={<ShieldAlert size={13} />}
                        >
                          ورود به حساب
                        </Button>
                        {/*
                          بازنشانی رمز فقط برای کاربران عادی.
                          سرور هم همین را جدا بررسی می‌کند — پنهان‌کردن
                          دکمه به‌تنهایی کنترل امنیتی نیست.
                        */}
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setPwTarget(u)}
                          icon={<KeyRound size={13} />}
                        >
                          بازنشانی رمز
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {pwTarget && (
        <ResetPasswordModal
          user={pwTarget}
          onClose={() => setPwTarget(null)}
          onDone={(email) => {
            setPwTarget(null);
            toast({ title: `رمز ${email} بازنشانی شد`, tone: "success" });
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * بازنشانی رمز یک کاربر توسط سوپرادمین.
 *
 * دلیل اجباری است — همان قاعده‌ی جعل هویت. بدون آن، گزارش ممیزی
 * می‌گوید «رمز عوض شد» ولی نمی‌گوید چرا، و در بازبینی امنیتی بی‌فایده
 * است. سرور هم مستقل همین را الزام می‌کند.
 */
function ResetPasswordModal({
  user,
  onClose,
  onDone,
}: {
  user: AdminUser;
  onClose: () => void;
  onDone: (email: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const liveError = password ? firstPasswordError(password) : null;
  const canSubmit = !!password && reason.trim().length >= 5 && !liveError && !saving;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onClose();
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  /**
   * تولید رمز تصادفی.
   *
   * از crypto.getRandomValues استفاده می‌شود نه Math.random — رمزی که
   * قرار است دست کاربر واقعی بیفتد نباید از یک مولد قابل پیش‌بینی
   * بیاید. مجموعه‌ی نویسه‌ها عمداً بدون کاراکترهای مبهم (O/0، l/1)
   * است چون این رمز معمولاً تلفنی خوانده می‌شود.
   */
  function generate() {
    const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789@#$%";
    const bytes = new Uint32Array(14);
    crypto.getRandomValues(bytes);
    const generated = Array.from(bytes, (n) => chars[n % chars.length]).join("");
    setPassword(generated);
    setCopied(false);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/users/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.user_id, new_password: password, reason: reason.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "بازنشانی رمز ناموفق بود.");
        return;
      }
      onDone(json.email ?? user.email);
    } catch {
      setError("ارتباط با سرور برقرار نشد.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 flex items-start justify-center overflow-y-auto p-3 sm:items-center" style={{ zIndex: "var(--z-modal)" }}>
      <button className="fixed inset-0 bg-foreground/30 backdrop-blur-[2px]" onClick={onClose} aria-label="بستن" />
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-label="بازنشانی رمز عبور"
        className="relative my-auto w-full max-w-md rounded-2xl border border-border bg-card p-4 shadow-2xl sm:p-5"
        dir="rtl"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-extrabold text-foreground">بازنشانی رمز عبور</h2>
          <button type="button" onClick={onClose} aria-label="بستن" className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-destructive">
            <X size={16} aria-hidden />
          </button>
        </div>

        <div className="mb-4 rounded-xl bg-muted/50 p-3 text-2xs">
          <div className="font-bold text-foreground">{user.owner_full_name || displayUsername(user.email)}</div>
          <div className="mt-0.5 text-muted-foreground" dir="ltr">{user.email}</div>
        </div>

        <div className="space-y-3">
          <div>
            <label htmlFor="admin-new-password" className="label">رمز جدید</label>
            <div className="flex gap-2">
              <input
                id="admin-new-password"
                className="input text-left font-mono"
                dir="ltr"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setCopied(false); }}
                autoComplete="off"
                aria-invalid={!!liveError || undefined}
              />
              <button type="button" onClick={generate} className="btn-secondary shrink-0 whitespace-nowrap text-2xs">
                تولید
              </button>
            </div>
            {liveError && <p className="mt-1 text-2xs text-destructive-text">{liveError}</p>}
            {password && !liveError && (
              <button
                type="button"
                onClick={() => { navigator.clipboard?.writeText(password); setCopied(true); }}
                className="mt-1 text-2xs font-bold text-primary hover:underline"
              >
                {copied ? "کپی شد ✓" : "کپی رمز"}
              </button>
            )}
          </div>

          <div>
            <label htmlFor="admin-pw-reason" className="label">دلیل بازنشانی</label>
            <input
              id="admin-pw-reason"
              className="input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مثلاً: درخواست تلفنی کاربر برای بازیابی حساب"
            />
            <p className="mt-1 text-2xs text-muted-foreground">
              حداقل ۵ نویسه. این متن در گزارش ممیزی ثبت و ماندگار می‌شود.
            </p>
          </div>

          <div className="rounded-xl bg-warning-soft px-3 py-2 text-2xs leading-relaxed text-warning-onSoft">
            پس از تغییر، رمز جدید را به کاربر اطلاع دهید و از او بخواهید بلافاصله آن را عوض کند.
            این عملیات در گزارش ممیزی با نام شما ثبت می‌شود.
          </div>

          {error && (
            <div role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-2xs text-destructive-text">{error}</div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={!canSubmit} className="btn-primary flex-1 disabled:opacity-50">
              {saving ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <KeyRound size={15} aria-hidden />}
              بازنشانی رمز
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">انصراف</button>
          </div>
        </div>
      </form>
    </div>
  );
}
