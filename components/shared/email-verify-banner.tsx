"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, MailWarning, X } from "lucide-react";
import { Button, useToast } from "@/src/shared/ui";
import { toFaDigits } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/**
 * نوار «ایمیلت را تأیید کن».
 *
 * چرا نوار و نه مسدودکردن پنل؟
 *   کل هدف تغییر جریان ثبت‌نام این بود که کاربر بلافاصله کار کند.
 *   اگر همان‌جا با یک دیوار روبه‌رو شود، هیچ چیزی عوض نشده. نوار
 *   دیده می‌شود، آزاردهنده هست، ولی جلوی کار را نمی‌گیرد.
 *
 * ⚠️ برای کاربری که مالک سازمان نیست (کارمندی که مدیر برایش حساب
 *    ساخته) اصلاً رندر نمی‌شود — ایمیلش را خودمان ساخته‌ایم.
 */
export function EmailVerifyBanner() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [dismissed, setDismissed] = useState(false);

  const { data } = useQuery({
    queryKey: ["email-verification-status"],
    queryFn: async () => {
      const res = await fetch("/api/account/verify-email");
      if (!res.ok) return { needsVerification: false, email: null };
      return (await res.json()) as { needsVerification: boolean; email: string | null };
    },
    // وضعیت به‌ندرت عوض می‌شود؛ هر ناوبری دوباره پرسیده نشود.
    staleTime: 5 * 60_000,
    retry: false,
  });

  const send = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/account/verify-email", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "ارسال کد ناموفق بود");
      return json as { emailSent: boolean; warning?: string; alreadyVerified?: boolean };
    },
    onSuccess: (r) => {
      if (r.alreadyVerified) {
        qc.invalidateQueries({ queryKey: ["email-verification-status"] });
        toast({ tone: "success", title: "ایمیل شما از قبل تأیید شده است" });
        return;
      }
      setOpen(true);
      if (r.warning) toast({ tone: "warning", title: "ارسال با تأخیر", description: r.warning });
      else toast({ tone: "success", title: "کد ۶ رقمی به ایمیل شما ارسال شد" });
    },
    onError: (e: Error) => toast({ tone: "error", title: e.message }),
  });

  const verify = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/account/verify-email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "کد نادرست است");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-verification-status"] });
      setOpen(false);
      setCode("");
      toast({ tone: "success", title: "ایمیل شما تأیید شد" });
    },
    onError: (e: Error) => toast({ tone: "error", title: e.message }),
  });

  if (!data?.needsVerification || dismissed) return null;

  return (
    <div className="border-b border-warning/30 bg-warning-soft" role="status">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:gap-3 sm:px-4">
        <MailWarning size={16} className="shrink-0 text-warning-onSoft" aria-hidden />
        <p className="min-w-0 flex-1 text-2xs leading-5 text-foreground sm:text-xs">
          ایمیل شما هنوز تأیید نشده است.
          <span className="hidden sm:inline">
            {" "}برای بازیابی رمز و دریافت اعلان‌های مهم، آن را تأیید کنید.
          </span>
        </p>

        {open ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              verify.mutate();
            }}
          >
            <label htmlFor="verify-code" className="sr-only">کد ۶ رقمی</label>
            <input
              id="verify-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="۶ رقم"
              dir="ltr"
              className="h-9 w-24 rounded-lg border border-border bg-card px-2 text-center text-sm tabular-nums text-foreground"
            />
            <Button type="submit" size="sm" loading={verify.isPending} disabled={code.length !== 6}>
              تأیید
            </Button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-muted-foreground hover:bg-warning/10"
              aria-label="بستن فرم کد"
            >
              <X size={14} aria-hidden />
            </button>
          </form>
        ) : (
          <div className="flex shrink-0 items-center gap-2">
            <Button size="sm" loading={send.isPending} onClick={() => send.mutate()}>
              ارسال کد تأیید
            </Button>
            {/*
              بستن موقت — نه برای همیشه. با رفرش دوباره می‌آید، چون
              تأیید ایمیل واقعاً لازم است.
            */}
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="rounded-lg p-1 text-muted-foreground hover:bg-warning/10"
              aria-label="بستن این پیام"
            >
              <X size={14} aria-hidden />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
