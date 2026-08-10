"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/shared/ui";
import { Card, IconButton, Input, useConfirm, useToast } from "@/src/shared/ui";
import { toFaDigits } from "@/lib/utils/format";
import {
  buildInsertPayload, friendlyError, isValidName, type ManagedTable,
} from "./managed-list.helpers";

/**
 * کارت «فهرست قابل مدیریت» — دسته‌بندی کالا، برند، دسته‌ی هزینه.
 *
 * چهار باگ نسخه‌ی قبلی که اینجا بسته شده‌اند:
 *
 *  ۱. 🔴 خطاها بی‌صدا بلعیده می‌شدند. `await supabase.from(...).insert(...)`
 *     بدون خواندن `error`. جدول categories کاملاً خراب بود و کاربر
 *     فقط «موردی ثبت نشده.» می‌دید — هیچ پیام خطایی.
 *
 *  ۲. 🔴 حذف بدون هیچ تأییدی. یک کلیک روی سطل زباله و دسته می‌رفت.
 *     حالا ConfirmDialog می‌آید.
 *
 *  ۳. 🔴 payload یکسان برای سه جدولِ متفاوت (branch_id به categories).
 *
 *  ۴. دکمه‌های ویرایش/حذف فقط با hover ظاهر می‌شدند
 *     (`opacity-0 group-hover:opacity-100`) — روی موبایل و برای
 *     کاربر کیبورد عملاً نامرئی بودند.
 */

type Item = { id: string; name: string };

export function ManagedList({
  orgId,
  branchId,
  table,
  title,
  description,
  icon,
}: {
  orgId: string | null;
  branchId: string | null;
  table: ManagedTable;
  title: string;
  description?: string;
  icon: React.ReactNode;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const confirm = useConfirm();

  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: [table, orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from(table)
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      // 🔴 حالا خطا پرتاب می‌شود، نه اینکه بی‌صدا «خالی» نشان داده شود.
      if (error) throw new Error(friendlyError(error) ?? "خطا در دریافت فهرست");
      return (data ?? []) as Item[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [table] });
    // انتخابگر کالا از کلید دیگری می‌خواند؛ بدون این، فهرستش کهنه می‌ماند.
    qc.invalidateQueries({ queryKey: ["sel-categories"] });
    qc.invalidateQueries({ queryKey: ["sel-brands"] });
  };

  async function add() {
    if (!isValidName(name) || !orgId) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from(table)
      .insert(buildInsertPayload(table, orgId, branchId, name));
    setBusy(false);

    if (error) {
      toast({ title: friendlyError(error) ?? "خطا در افزودن", tone: "error" });
      return;
    }
    setName("");
    invalidate();
  }

  async function rename(id: string) {
    if (!isValidName(editName)) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from(table)
      .update({ name: editName.trim() })
      .eq("id", id);
    setBusy(false);

    if (error) {
      toast({ title: friendlyError(error) ?? "خطا در ویرایش", tone: "error" });
      return;
    }
    setEditingId(null);
    invalidate();
  }

  async function remove(item: Item) {
    /*
      🔴 تأیید پیش از حذف.

      متن عمداً می‌گوید «پنهان می‌شود» نه «حذف می‌شود»: عملیات در
      واقع is_active=false است و کالاهایی که به این دسته وصل‌اند
      دست‌نخورده می‌مانند. گفتن «حذف» به کاربر، وعده‌ی نادرست است.
    */
    const ok = await confirm({
      title: `حذف «${item.name}»؟`,
      description:
        "این مورد از فهرست پنهان می‌شود. کالاهایی که قبلاً به آن وصل شده‌اند تغییری نمی‌کنند.",
      tone: "danger",
      confirmLabel: "حذف کن",
    });
    if (!ok) return;

    const supabase = createClient();
    const { error } = await supabase.from(table).update({ is_active: false }).eq("id", item.id);
    if (error) {
      toast({ title: friendlyError(error) ?? "خطا در حذف", tone: "error" });
      return;
    }
    toast({ title: `«${item.name}» حذف شد`, tone: "success" });
    invalidate();
  }

  const items = data ?? [];

  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-foreground">
            {icon}
            {title}
            {items.length > 0 && (
              <span className="text-2xs font-bold text-muted-foreground">
                ({toFaDigits(items.length)})
              </span>
            )}
          </h3>
          {description && (
            <p className="mt-1 text-2xs leading-5 text-muted-foreground">{description}</p>
          )}
        </div>
      </div>

      {/* افزودن */}
      <div className="mb-3 flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={`${title} جدید…`}
          aria-label={`${title} جدید`}
          className="flex-1"
        />
        <button
          type="button"
          onClick={add}
          disabled={busy || !isValidName(name)}
          aria-label={`افزودن ${title}`}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-primary px-4 font-bold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
        </button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : error ? (
        /* 🔴 خطا حالا دیده می‌شود، نه اینکه «موردی ثبت نشده» بگوید. */
        <div className="rounded-xl bg-destructive/10 p-3 text-xs text-destructive-text">
          {(error as Error).message}
        </div>
      ) : items.length === 0 ? (
        <p className="py-2 text-xs text-muted-foreground">هنوز موردی ثبت نشده.</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 hover:bg-muted"
            >
              {editingId === item.id ? (
                <div className="flex flex-1 items-center gap-1.5">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") rename(item.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    aria-label={`نام جدید برای ${item.name}`}
                    autoFocus
                    className="flex-1 py-1.5 text-sm"
                  />
                  <IconButton
                    aria-label="ذخیره نام"
                    onClick={() => rename(item.id)}
                    disabled={busy || !isValidName(editName)}
                    className="text-success-onSoft hover:bg-success-soft"
                  >
                    <Check size={16} />
                  </IconButton>
                  <IconButton aria-label="انصراف از ویرایش" onClick={() => setEditingId(null)}>
                    <X size={16} />
                  </IconButton>
                </div>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {item.name}
                  </span>
                  {/*
                    دکمه‌ها همیشه در دسترس‌اند.
                    نسخه‌ی قبلی opacity-0 group-hover:opacity-100 داشت —
                    روی موبایل hover وجود ندارد و کاربر اصلاً نمی‌فهمید
                    می‌شود ویرایش کرد.
                  */}
                  <div className="flex shrink-0 items-center gap-0.5">
                    <IconButton
                      aria-label={`ویرایش ${item.name}`}
                      onClick={() => {
                        setEditingId(item.id);
                        setEditName(item.name);
                      }}
                    >
                      <Pencil size={14} />
                    </IconButton>
                    <IconButton
                      aria-label={`حذف ${item.name}`}
                      onClick={() => remove(item)}
                      className="hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
