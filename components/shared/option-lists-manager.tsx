"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { List, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/useOrg";
import { useOrgPrefs } from "@/lib/hooks/useOrgPrefs";
import { Badge, Button, Card, Field, Input, Select, useConfirm, useToast } from "@/src/shared/ui";
import { Spinner } from "@/components/shared/ui";
import { toFaDigits } from "@/lib/utils/format";
import type { OptionKind } from "@/lib/hooks/useOptionList";

const KINDS: Array<{ id: OptionKind; label: string }> = [
  { id: "color", label: "رنگ" },
  { id: "size", label: "سایز" },
  { id: "unit", label: "واحد شمارش" },
  { id: "season", label: "فصل" },
  { id: "material", label: "جنس" },
];

/**
 * مدیریت گزینه‌های کشویی.
 *
 * الگوی سپیدار: «واحدهای سنجش» فهرستی است که کاربر خودش تعریف
 * می‌کند. اینجا همان، به‌علاوه‌ی پیشنهادهای صنفی.
 *
 * ⚠️ گزینه‌های پیشنهادی صنف **در دیتابیس نیستند** — فقط نمایش
 * داده می‌شوند. اگر کاربر یکی‌شان را بخواهد ثابت کند، دکمه‌ی
 * «افزودن» آن را واقعاً ثبت می‌کند.
 */
export function OptionListsManager() {
  const { orgId } = useOrg();
  const { profile } = useOrgPrefs();
  const qc = useQueryClient();
  const { toast } = useToast();
  const confirm = useConfirm();

  const [kind, setKind] = useState<OptionKind>("color");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["option-list-manage", orgId, kind],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("option_lists")
        .select("id, value, sort_order")
        .eq("org_id", orgId!)
        .eq("kind", kind)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; value: string; sort_order: number }>;
    },
  });

  const own = rows ?? [];
  const ownValues = new Set(own.map((r) => r.value.trim()));
  const suggestions = (profile.suggested[kind] ?? []).filter((s) => !ownValues.has(s.trim()));

  async function add(v: string) {
    const clean = v.trim();
    if (!clean || !orgId) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("option_lists").insert({
        org_id: orgId,
        kind,
        value: clean,
        sort_order: own.length,
      });
      if (error) {
        // ایندکس یکتا: همان مقدار در همان دسته دو بار.
        const dup = error.code === "23505";
        toast({
          title: dup ? "این گزینه از قبل هست" : "افزوده نشد",
          description: dup ? undefined : error.message,
          tone: "error",
        });
        return;
      }
      setValue("");
      qc.invalidateQueries({ queryKey: ["option-list-manage"] });
      qc.invalidateQueries({ queryKey: ["option-list"] });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, label: string) {
    const ok = await confirm({
      title: "حذف گزینه",
      description: `«${label}» از فهرست پیشنهادها حذف می‌شود. کالاهایی که از قبل این مقدار را دارند دست نمی‌خورند.`,
      confirmLabel: "حذف کن",
      tone: "danger",
    });
    if (!ok) return;
    const supabase = createClient();
    const { error } = await supabase.from("option_lists").delete().eq("id", id);
    if (error) {
      toast({ title: "حذف نشد", description: error.message, tone: "error" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["option-list-manage"] });
    qc.invalidateQueries({ queryKey: ["option-list"] });
  }

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <List size={18} className="text-primary" aria-hidden />
        <h2 className="text-sm font-extrabold text-foreground">گزینه‌های کشویی</h2>
      </div>

      <p className="text-2xs leading-relaxed text-muted-foreground">
        این گزینه‌ها هنگام ثبت کالا پیشنهاد داده می‌شوند. همچنان می‌توانید مقدار دلخواه تایپ
        کنید — فهرست فقط برای سرعت و یکدست‌ماندن داده است.
      </p>

      <div className="grid gap-3 sm:grid-cols-[10rem_1fr_auto]">
        <Field label="دسته">
          <Select value={kind} onChange={(e) => setKind(e.target.value as OptionKind)}>
            {KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="گزینه‌ی تازه">
          <Input
            value={value}
            placeholder="مثلاً یشمی"
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add(value);
              }
            }}
          />
        </Field>
        <div className="flex items-end">
          <Button onClick={() => add(value)} disabled={busy || !value.trim()} icon={<Plus size={15} />}>
            افزودن
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Spinner />
      ) : (
        <>
          <div>
            {/*
              🔴 عدد و متن span جدا با جداکننده‌ی aria-hidden.
              رشته‌ی `${عدد} · ${متن}` در RTL بازچینش می‌شود.
            */}
            <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold text-foreground">
              <span>گزینه‌های شما</span>
              <span aria-hidden="true" className="text-muted-foreground">·</span>
              <span className="tabular-nums text-muted-foreground">{toFaDigits(own.length)} مورد</span>
            </div>
            {own.length === 0 ? (
              <p className="text-2xs text-muted-foreground">
                هنوز گزینه‌ای اضافه نکرده‌اید. پیشنهادهای زیر همین حالا هم در فرم کالا نشان داده
                می‌شوند.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {own.map((r) => (
                  <li
                    key={r.id}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border px-2.5 py-1.5 text-xs"
                  >
                    <span className="text-foreground">{r.value}</span>
                    <button
                      type="button"
                      onClick={() => remove(r.id, r.value)}
                      aria-label={`حذف ${r.value}`}
                      className="text-muted-foreground transition hover:text-destructive"
                    >
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {suggestions.length > 0 && (
            <div className="border-t border-border pt-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold text-foreground">
                <span>پیشنهاد صنف شما</span>
                <Badge tone="neutral">فعال بدون افزودن</Badge>
              </div>
              <ul className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      onClick={() => add(s)}
                      disabled={busy}
                      className="inline-flex items-center gap-1 rounded-xl border border-dashed border-border px-2.5 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-primary"
                    >
                      <Plus size={12} /> {s}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
