"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Download, KeyRound, Printer } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button, useConfirm, useToast } from "@/src/shared/ui";
import { toFaDigits } from "@/lib/utils/format";

/**
 * کدهای پشتیبان ورود دومرحله‌ای.
 *
 * 🔴 شکافی که می‌بندد: بدون این، گم‌شدن گوشی یعنی قفل شدن کامل
 * حساب. کد بازیابی رمزِ مدیر هم کمکی نمی‌کند چون دومرحله‌ای را
 * غیرفعال نمی‌کند.
 *
 * استاندارد NIST SP 800-63B §4.2.1.1: کدها آفلاین نگه داشته
 * می‌شوند (چاپ یا نوشتن)، یک‌بارمصرف‌اند و هش‌شده ذخیره می‌شوند.
 */
export function BackupCodes({ mfaEnabled }: { mfaEnabled: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: remaining } = useQuery({
    queryKey: ["backup-code-count"],
    enabled: mfaEnabled,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase.rpc("my_backup_code_count");
      return Number(data ?? 0);
    },
    staleTime: 30_000,
  });

  async function generate() {
    const ok = await confirm({
      title: codes || (remaining ?? 0) > 0 ? "ساخت کدهای تازه" : "ساخت کدهای پشتیبان",
      description:
        (remaining ?? 0) > 0
          ? "کدهای قبلی شما کاملاً باطل می‌شوند. اگر کاغذی از آن‌ها دارید، دور بیندازید."
          : "ده کد یک‌بارمصرف ساخته می‌شود. آن‌ها را چاپ کنید یا جایی امن بنویسید — فقط همین یک بار نمایش داده می‌شوند.",
      confirmLabel: "بساز",
    });
    if (!ok) return;

    setBusy(true);
    try {
      const res = await fetch("/api/auth/backup-codes", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        toast({ title: "ساخته نشد", description: json.error, tone: "error" });
        return;
      }
      setCodes(json.codes as string[]);
      qc.invalidateQueries({ queryKey: ["backup-code-count"] });
    } catch (e) {
      toast({ title: "ساخته نشد", description: (e as Error).message, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  function download() {
    if (!codes) return;
    /*
      فایل متنی ساده، نه PDF.

      کاربر باید بتواند بازش کند، چاپ کند، یا داخل مدیر رمز
      بچسباند — بدون هیچ نرم‌افزار اضافه.
    */
    const text = [
      "کدهای پشتیبان ورود دومرحله‌ای — ترازو",
      "هر کد فقط یک بار قابل استفاده است.",
      "این برگه را جایی امن و جدا از گوشی نگه دارید.",
      "",
      ...codes.map((c, i) => `${i + 1}. ${c}`),
    ].join("\n");

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tarazoo-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!mfaEnabled) {
    return (
      <p className="text-2xs leading-relaxed text-muted-foreground">
        پس از فعال‌کردن ورود دومرحله‌ای، اینجا می‌توانید کدهای پشتیبان بسازید.
      </p>
    );
  }

  /* ─── کدهای تازه‌ساخته‌شده ─── */
  if (codes) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/[0.08] p-3">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warning-onSoft" aria-hidden />
          <div className="text-xs leading-6 text-warning-onSoft">
            این کدها <span className="font-bold">فقط همین یک بار</span> نمایش داده می‌شوند.
            چاپشان کنید یا جایی امن بنویسید — ترجیحاً جدا از گوشی‌تان.
          </div>
        </div>

        <ul
          dir="ltr"
          className="grid grid-cols-2 gap-2 rounded-2xl bg-muted p-4 font-mono text-sm"
        >
          {codes.map((c) => (
            <li key={c} className="select-all text-center tracking-wider text-foreground">
              {c}
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-2">
          <Button onClick={download} icon={<Download size={15} />}>
            دانلود فایل
          </Button>
          <Button variant="secondary" onClick={() => window.print()} icon={<Printer size={15} />}>
            چاپ
          </Button>
          <Button variant="secondary" onClick={() => setCodes(null)}>
            ذخیره کردم، ببند
          </Button>
        </div>
      </div>
    );
  }

  /* ─── وضعیت عادی ─── */
  return (
    <div className="space-y-3">
      {/*
        🔴 توکن‌های عددی span جدا با جداکننده‌ی aria-hidden.
        رشته‌ی `${عدد} · ${متن}` در RTL بازچینش می‌شود و اعداد به هم
        می‌چسبند — در DOM درست است و فقط رندر خراب می‌شود.
      */}
      {typeof remaining === "number" && (
        <div
          className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border p-3 text-xs ${
            remaining === 0
              ? "border-destructive/30 bg-destructive/[0.05] text-destructive-text"
              : remaining <= 3
                ? "border-warning/40 bg-warning/[0.08] text-warning-onSoft"
                : "border-border text-muted-foreground"
          }`}
        >
          <span className="tabular-nums font-bold">
            {toFaDigits(remaining)} کد استفاده‌نشده
          </span>
          {remaining === 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span>اگر گوشی‌تان را گم کنید راهی برای ورود ندارید</span>
            </>
          )}
          {remaining > 0 && remaining <= 3 && (
            <>
              <span aria-hidden="true">·</span>
              <span>رو به اتمام است، مجموعه‌ی تازه بسازید</span>
            </>
          )}
        </div>
      )}

      <p className="text-2xs leading-relaxed text-muted-foreground">
        اگر گوشی‌تان را گم کنید یا اپ احرازکننده پاک شود، با یکی از این کدها می‌توانید وارد شوید.
        هر کد فقط یک بار کار می‌کند و پس از استفاده، ورود دومرحله‌ای خاموش می‌شود تا دوباره
        تنظیمش کنید.
      </p>

      <Button onClick={generate} disabled={busy} icon={<KeyRound size={15} />}>
        {busy ? "..." : (remaining ?? 0) > 0 ? "ساخت کدهای تازه" : "ساخت کدهای پشتیبان"}
      </Button>
    </div>
  );
}
