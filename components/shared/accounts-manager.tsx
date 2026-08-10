"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Landmark, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/shared/ui";
import {
  Button, Card, Field, IconButton, Input, Modal, Select, useConfirm, useToast,
} from "@/src/shared/ui";
import { toFaDigits } from "@/lib/utils/format";
import { friendlyError } from "./managed-list.helpers";

/**
 * صندوق و حساب‌های بانکی.
 *
 * همان سه باگ فهرست‌های قابل مدیریت را داشت: حذف بدون تأیید،
 * خطای بلعیده‌شده، و دکمه‌های فقط-hover.
 */

type Account = { id: string; name: string; type: string; bank_name: string | null };

export function AccountsManager({
  orgId,
  branchId,
}: {
  orgId: string | null;
  branchId: string | null;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [modalOpen, setModalOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["accounts-full", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("accounts")
        .select("id, name, type, bank_name")
        .eq("is_active", true)
        .order("name");
      if (error) throw new Error(friendlyError(error) ?? "خطا در دریافت حساب‌ها");
      return (data ?? []) as Account[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["accounts-full"] });
    qc.invalidateQueries({ queryKey: ["account-balances"] });
  };

  async function remove(account: Account) {
    /*
      متن تأیید صادق است: حساب پنهان می‌شود ولی تراکنش‌های ثبت‌شده
      دست‌نخورده می‌مانند. اگر می‌گفتیم «حذف می‌شود»، کاربر انتظار
      داشت گردش مالی‌اش هم پاک شود.
    */
    const ok = await confirm({
      title: `حذف «${account.name}»؟`,
      description:
        "این حساب از فهرست پنهان می‌شود. تراکنش‌های ثبت‌شده روی آن دست‌نخورده می‌مانند.",
      tone: "danger",
      confirmLabel: "حذف کن",
    });
    if (!ok) return;

    const supabase = createClient();
    const { error } = await supabase
      .from("accounts")
      .update({ is_active: false })
      .eq("id", account.id);
    if (error) {
      toast({ title: friendlyError(error) ?? "خطا در حذف حساب", tone: "error" });
      return;
    }
    toast({ title: `«${account.name}» حذف شد`, tone: "success" });
    invalidate();
  }

  const accounts = data ?? [];

  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-extrabold text-foreground">
          <Landmark size={17} aria-hidden />
          صندوق و حساب‌های بانکی
          {accounts.length > 0 && (
            <span className="text-2xs font-bold text-muted-foreground">
              ({toFaDigits(accounts.length)})
            </span>
          )}
        </h2>
        <Button size="sm" icon={<Plus size={15} />} onClick={() => setModalOpen(true)}>
          افزودن حساب
        </Button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : error ? (
        <div className="rounded-xl bg-destructive/10 p-3 text-xs text-destructive-text">
          {(error as Error).message}
        </div>
      ) : accounts.length === 0 ? (
        <p className="py-2 text-xs text-muted-foreground">هنوز حسابی ثبت نشده.</p>
      ) : (
        <ul className="space-y-2">
          {accounts.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-2 rounded-xl bg-muted p-2.5"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    a.type === "cash"
                      ? "bg-success-soft text-success-onSoft"
                      : "bg-info-soft text-info-onSoft"
                  }`}
                >
                  <Landmark size={15} aria-hidden />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-foreground">{a.name}</div>
                  <div className="text-2xs text-muted-foreground">
                    {a.type === "cash" ? "صندوق (نقد)" : a.bank_name || "بانک"}
                  </div>
                </div>
              </div>
              <IconButton
                aria-label={`حذف ${a.name}`}
                onClick={() => remove(a)}
                className="hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 size={14} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}

      {modalOpen && (
        <AccountModal
          orgId={orgId}
          branchId={branchId}
          onClose={() => {
            setModalOpen(false);
            invalidate();
          }}
        />
      )}
    </Card>
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
  const [bankName, setBankName] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim() || !orgId) return;
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { error: insertError } = await supabase.from("accounts").insert({
      org_id: orgId,
      branch_id: branchId,
      name: name.trim(),
      type,
      bank_name: type === "bank" && bankName.trim() ? bankName.trim() : null,
      account_no: type === "bank" && accountNo.trim() ? accountNo.trim() : null,
    });

    /*
      🔴 نسخه‌ی قبلی این را در try/catch گذاشته بود، ولی کلاینت
      Supabase برای خطای دیتابیس استثنا **پرتاب نمی‌کند** — خطا را
      در فیلد `error` برمی‌گرداند. پس catch هیچ‌وقت اجرا نمی‌شد و
      مودال با موفقیت بسته می‌شد حتی وقتی چیزی ذخیره نشده بود.
    */
    if (insertError) {
      setError(friendlyError(insertError) ?? "خطا در ذخیره حساب");
      setSaving(false);
      return;
    }
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="حساب جدید">
      <div className="space-y-4">
        <Field label="نام حساب" required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثلاً: صندوق فروشگاه"
          />
        </Field>

        <Field label="نوع">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="cash">صندوق (نقد)</option>
            <option value="bank">بانک</option>
          </Select>
        </Field>

        {type === "bank" && (
          <>
            <Field label="نام بانک">
              <Input
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="مثلاً: ملت، سپه"
              />
            </Field>
            <Field label="شماره حساب">
              <Input
                value={accountNo}
                onChange={(e) => setAccountNo(e.target.value)}
                dir="ltr"
                className="text-left"
              />
            </Field>
          </>
        )}

        {error && (
          <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive-text">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={save} loading={saving} disabled={!name.trim()} className="flex-1">
            ذخیره
          </Button>
          <Button variant="secondary" onClick={onClose}>
            انصراف
          </Button>
        </div>
      </div>
    </Modal>
  );
}
