"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, Loader2, Send, Smartphone } from "lucide-react";
import { Button, Card, useToast } from "@/src/shared/ui";
import { useOrg } from "@/lib/hooks/useOrg";
import { isIOS } from "@/lib/utils/platform";
import { isStandalone } from "@/lib/pwa";
import {
  resolvePushSupport,
  pushSupportMessage,
  urlBase64ToUint8Array,
  looksLikeVapidKey,
  type PushSupport,
} from "@/lib/notifications";

/**
 * فعال‌سازی اعلان روی دستگاه.
 *
 * 🔴 مهم‌ترین نکته iOS است. تحقیق تأیید کرد پوش وب روی آیفون فقط از
 * iOS 16.4 و **فقط وقتی برنامه از صفحه‌ی اصلی باز شده باشد** کار
 * می‌کند؛ در تب معمولی سافاری `PushManager` اصلاً وجود ندارد.
 *
 * پس روی آیفونِ نصب‌نشده دکمه‌ی «فعال‌سازی» نشان نمی‌دهیم — راهنمای
 * نصب می‌دهیم. دکمه‌ای که بزنند و کار نکند بدتر از نبودنش است، همان
 * درسی که از دکمه‌ی ورود صوتی گرفتیم.
 */
export function PushToggle() {
  const { orgId } = useOrg();
  const { toast } = useToast();
  const [support, setSupport] = useState<PushSupport>("unsupported");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  const detect = useCallback(async () => {
    const hasSW = typeof navigator !== "undefined" && "serviceWorker" in navigator;
    const hasPush = typeof window !== "undefined" && "PushManager" in window;
    const hasNotif = typeof window !== "undefined" && "Notification" in window;

    setSupport(
      resolvePushSupport({
        hasServiceWorker: hasSW,
        hasPushManager: hasPush,
        hasNotification: hasNotif,
        permission: hasNotif ? Notification.permission : "default",
        ios: isIOS(),
        standalone: isStandalone(),
      })
    );

    if (hasSW && hasPush) {
      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        setSubscribed(existing !== null);
      } catch {
        setSubscribed(false);
      }
    }
    setReady(true);
  }, []);

  useEffect(() => {
    void detect();
  }, [detect]);

  async function enable() {
    setBusy(true);
    try {
      /*
        ⚠️ درخواست اجازه باید مستقیماً داخل ژست کاربر باشد. اگر اول
        await دیگری بزنیم، سافاری آن را «خارج از ژست» می‌شمارد و
        بی‌صدا رد می‌کند.
      */
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setSupport(permission === "denied" ? "denied" : "ready");
        toast({ title: "اجازه‌ی اعلان داده نشد", tone: "error" });
        return;
      }

      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      /*
        🔴 اعتبارسنجی شکل کلید، نه فقط وجودش.

        یک بار کلید را در Vercel به‌صورت encrypted ثبت کردم و مقدار
        رمزشده به‌جای کلید در باندل نشست؛ subscribe بی‌صدا شکست
        می‌خورد و هیچ پیامی نمی‌داد. حالا زود و با پیام روشن معلوم
        می‌شود.
      */
      if (!looksLikeVapidKey(key)) {
        toast({
          title: "کلید اعلان درست تنظیم نشده است",
          description: "با پشتیبانی تماس بگیرید.",
          tone: "error",
        });
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        // مرورگرها فقط پوش قابل‌نمایش را می‌پذیرند؛ silent push ممنوع است.
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key!),
      });

      const res = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON(), orgId }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "ثبت نشد");

      setSubscribed(true);
      setSupport("granted");
      toast({ title: "اعلان روی این دستگاه فعال شد", tone: "success" });
    } catch (e) {
      toast({ title: "خطا در فعال‌سازی: " + (e as Error).message, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch(`/api/push?endpoint=${encodeURIComponent(sub.endpoint)}`, {
          method: "DELETE",
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      toast({ title: "اعلان روی این دستگاه خاموش شد", tone: "info" });
    } catch (e) {
      toast({ title: "خطا: " + (e as Error).message, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    try {
      const res = await fetch("/api/push", { method: "PUT" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "ارسال نشد");
      toast({ title: "اعلان آزمایشی فرستاده شد", tone: "success" });
    } catch (e) {
      toast({ title: "خطا: " + (e as Error).message, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  // پیش از mount چیزی نشان نمی‌دهیم تا رندر سرور و کلاینت یکی بماند.
  if (!ready) return null;

  return (
    <Card className="p-4 sm:p-5">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-extrabold text-foreground">
        <BellRing size={17} aria-hidden />
        اعلان روی این دستگاه
      </h2>
      <p className="mb-4 text-2xs leading-6 text-muted-foreground">
        {pushSupportMessage(support)}
      </p>

      {support === "ios-needs-install" && (
        /*
          راهنمای نصب به‌جای دکمه‌ی بی‌فایده.
          نوار هم‌رسانی سافاری از iOS 15 **پایین** صفحه است — همان
          اشتباهی که یک بار در راهنمای میکروفون کردیم.
        */
        <div className="flex items-start gap-2 rounded-xl border border-info/25 bg-info-soft/60 p-3">
          <Smartphone size={15} className="mt-0.5 shrink-0 text-info-onSoft" aria-hidden />
          <p className="text-2xs leading-6 text-info-onSoft">
            دکمه‌ی هم‌رسانی را در نوار پایین سافاری بزنید، «Add to Home Screen» را انتخاب
            کنید، و برنامه را از آیکون روی صفحه‌ی گوشی باز کنید. بعد همین‌جا دکمه‌ی
            فعال‌سازی ظاهر می‌شود.
          </p>
        </div>
      )}

      {(support === "ready" || support === "granted") && (
        <div className="flex flex-wrap gap-2">
          {subscribed ? (
            <>
              <Button variant="ghost" onClick={disable} disabled={busy}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : null}
                خاموش کردن اعلان
              </Button>
              <Button variant="secondary" icon={<Send size={15} />} onClick={sendTest} disabled={busy}>
                ارسال اعلان آزمایشی
              </Button>
            </>
          ) : (
            <Button icon={<BellRing size={15} />} onClick={enable} disabled={busy}>
              {busy ? "در حال فعال‌سازی…" : "فعال‌سازی اعلان"}
            </Button>
          )}
        </div>
      )}

      {support === "denied" && (
        <p className="text-2xs leading-6 text-warning-onSoft">
          در نوار نشانی مرورگر روی قفل بزنید و اجازه‌ی اعلان را روی «مجاز» بگذارید.
        </p>
      )}
    </Card>
  );
}
