"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge, Button, Field, Input, useConfirm, useToast } from "@/src/shared/ui";
import { toFaDigits } from "@/lib/utils/format";
import { BackupCodes } from "./backup-codes";
import {
  CLOCK_HINT,
  isWellFormedTotp,
  mfaErrorMessage,
  mfaState,
  normalizeTotpInput,
  TOTP_CODE_LENGTH,
  type MfaFactor,
} from "@/lib/security/mfa";

/**
 * فعال‌سازی ورود دومرحله‌ای با اپ احرازکننده.
 *
 * ✅ سنجیده شد که TOTP روی همین پروژه در پلن رایگان کار می‌کند —
 * برخلاف `sessions_timebox` و هوک تأیید رمز که هر دو بسته بودند.
 *
 * ⚠️ همه‌ی تماس‌ها از **کلاینت** انجام می‌شوند نه روت سرور.
 *   `auth.mfa` روی نشست جاری مرورگر کار می‌کند؛ اگر از سرور صدا
 *   می‌زدیم، فاکتور به نشست دیگری می‌چسبید.
 */
export function MfaSetup() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const confirm = useConfirm();

  const [enrolling, setEnrolling] = useState(false);
  const [qr, setQr] = useState<{ id: string; qrCode: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: factors, isLoading } = useQuery({
    queryKey: ["mfa-factors"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error: e } = await supabase.auth.mfa.listFactors();
      if (e) throw e;
      return (data?.all ?? []) as MfaFactor[];
    },
    staleTime: 30_000,
  });

  const state = mfaState(factors);

  async function startEnroll() {
    setError(null);
    setBusy(true);
    const supabase = createClient();

    /*
      فاکتورهای نیمه‌کاره‌ی قبلی پاک می‌شوند.

      🔴 بدون این، کاربری که یک بار پنجره را وسط کار بست، دفعه‌ی بعد
      خطای «factor already exists» می‌گیرد و **هیچ راهی برای خروج از
      این بن‌بست ندارد** — چون آن فاکتور در رابط کاربری هم دیده
      نمی‌شود.
    */
    for (const id of state.staleIds) {
      await supabase.auth.mfa.unenroll({ factorId: id });
    }

    const { data, error: e } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `اپ احرازکننده — ${new Date().toLocaleDateString("fa-IR")}`,
    });
    setBusy(false);

    if (e || !data) {
      setError(mfaErrorMessage(e?.message));
      return;
    }
    setQr({ id: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
    setEnrolling(true);
  }

  async function confirmEnroll() {
    setError(null);
    const clean = normalizeTotpInput(code);

    /*
      شکل کد پیش از تماس با سرور بررسی می‌شود تا ورودی آشکارا غلط
      سهمیه‌ی نرخ Supabase را نسوزاند.
    */
    if (!isWellFormedTotp(clean)) {
      setError(`کد باید ${toFaDigits(TOTP_CODE_LENGTH)} رقم باشد.`);
      return;
    }
    if (!qr) return;

    setBusy(true);
    const supabase = createClient();
    const { error: e } = await supabase.auth.mfa.challengeAndVerify({
      factorId: qr.id,
      code: clean,
    });
    setBusy(false);

    if (e) {
      setError(mfaErrorMessage(e.message));
      return;
    }

    setEnrolling(false);
    setQr(null);
    setCode("");
    qc.invalidateQueries({ queryKey: ["mfa-factors"] });
    toast({ title: "ورود دومرحله‌ای فعال شد", tone: "success" });
  }

  async function disable() {
    const ok = await confirm({
      title: "غیرفعال کردن ورود دومرحله‌ای",
      description:
        "پس از این، برای ورود فقط رمز عبور لازم است. اگر رمزتان لو برود، هیچ لایه‌ی دومی جلوی نفوذ را نمی‌گیرد.",
      confirmLabel: "غیرفعال کن",
      tone: "danger",
    });
    if (!ok) return;

    setBusy(true);
    const supabase = createClient();
    for (const id of [...state.verifiedIds, ...state.staleIds]) {
      await supabase.auth.mfa.unenroll({ factorId: id });
    }
    setBusy(false);
    qc.invalidateQueries({ queryKey: ["mfa-factors"] });
    toast({ title: "ورود دومرحله‌ای غیرفعال شد", tone: "info" });
  }

  function cancelEnroll() {
    setEnrolling(false);
    setQr(null);
    setCode("");
    setError(null);
  }

  if (isLoading) return <div className="h-20 animate-pulse rounded-xl bg-muted" />;

  /* ─── فعال است ─── */
  if (state.enabled && !enrolling) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/[0.06] p-3">
          <CheckCircle2 size={18} className="shrink-0 text-success-onSoft" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-success-onSoft">ورود دومرحله‌ای فعال است</div>
            <div className="mt-0.5 text-2xs text-muted-foreground">
              هنگام ورود، علاوه بر رمز عبور یک کد از اپ احرازکننده خواسته می‌شود.
            </div>
          </div>
          <Badge tone="success">فعال</Badge>
        </div>
        {/*
          🔴 کدهای پشتیبان بلافاصله زیر وضعیت فعال می‌آیند.

          کاربری که تازه 2FA را روشن کرده، همان لحظه در معرض
          بزرگ‌ترین ریسک است: اگر گوشی‌اش گم شود راه بازگشتی ندارد.
          پنهان‌کردن این بخش پشت یک صفحه‌ی دیگر یعنی اکثر کاربران
          هرگز کد نمی‌سازند.
        */}
        <div className="border-t border-border pt-3">
          <div className="mb-2 text-xs font-extrabold text-foreground">کدهای پشتیبان</div>
          <BackupCodes mfaEnabled />
        </div>

        <Button variant="secondary" onClick={disable} disabled={busy} icon={<ShieldOff size={15} />}>
          غیرفعال کردن
        </Button>
      </div>
    );
  }

  /* ─── در حال فعال‌سازی ─── */
  if (enrolling && qr) {
    return (
      <div className="space-y-4">
        <ol className="space-y-1 text-xs leading-6 text-muted-foreground">
          <li>۱. اپ Google Authenticator یا هر اپ مشابه را باز کنید.</li>
          <li>۲. تصویر زیر را اسکن کنید.</li>
          <li>۳. کد شش‌رقمی که نشان می‌دهد را اینجا بنویسید.</li>
        </ol>

        {/*
          ⚠️ `qr_code` یک data-URI از نوع SVG است که خود Supabase
          می‌سازد. تصویرش را همین‌جا نشان می‌دهیم و هیچ درخواستی به
          بیرون نمی‌رود — مهم است چون این تصویر کلید حساب است.
        */}
        <div className="flex justify-center rounded-2xl bg-white p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr.qrCode} alt="کد QR برای اپ احرازکننده" className="h-44 w-44" />
        </div>

        <Field
          label="اگر نمی‌توانید اسکن کنید"
          hint="این کلید را دستی در اپ وارد کنید."
        >
          <Input dir="ltr" readOnly value={qr.secret} className="select-all text-center text-xs" />
        </Field>

        <Field label="کد اپ احرازکننده" required>
          <Input
            dir="ltr"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            className="text-center text-lg tracking-[0.4em]"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </Field>

        <p className="text-2xs leading-relaxed text-muted-foreground">{CLOCK_HINT}</p>

        {error && (
          <div role="alert" className="rounded-xl bg-destructive/10 p-3 text-xs text-destructive-text">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={confirmEnroll} disabled={busy} className="flex-1">
            تأیید و فعال‌سازی
          </Button>
          <Button variant="secondary" onClick={cancelEnroll} disabled={busy}>
            انصراف
          </Button>
        </div>
      </div>
    );
  }

  /* ─── غیرفعال ─── */
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-xl border border-border p-3">
        <Smartphone size={18} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="text-xs leading-6 text-muted-foreground">
          با فعال‌کردن این گزینه، هنگام ورود علاوه بر رمز عبور یک کد شش‌رقمی از اپ احرازکننده
          خواسته می‌شود. حتی اگر کسی رمز شما را بداند، بدون گوشی‌تان نمی‌تواند وارد شود.
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-destructive/10 p-3 text-xs text-destructive-text">
          {error}
        </div>
      )}

      <Button onClick={startEnroll} disabled={busy} icon={<ShieldCheck size={15} />}>
        {busy ? "..." : "فعال کردن ورود دومرحله‌ای"}
      </Button>
    </div>
  );
}
