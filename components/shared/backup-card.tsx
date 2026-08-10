"use client";

import { useState } from "react";
import { DatabaseBackup, Download, Loader2, ShieldCheck } from "lucide-react";
import { Button, Card, useToast } from "@/src/shared/ui";
import { downloadBlob } from "@/lib/export/download";
import { todayJalali } from "@/lib/utils/format";

/**
 * کارت «پشتیبان کامل».
 *
 * راهنمای ورود اکسل به کاربر می‌گفت «پیش از هر کاری پشتیبان بگیرید»
 * ولی هیچ دکمه‌ای وجود نداشت و متن پیشنهاد می‌کرد «از پشتیبانی
 * بخواهید». این همان دکمه است.
 */
export function BackupCard() {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const res = await fetch("/api/backup");

      if (!res.ok) {
        /*
          پاسخ خطا JSON است ولی پاسخ موفق فایل باینری.
          خواندن کورکورانه‌ی json() روی فایل xlsx استثنا می‌دهد، پس
          فقط در مسیر خطا json می‌خوانیم.
        */
        let message = "خطا در تهیه‌ی پشتیبان";
        if (res.status === 403) message = "برای تهیه‌ی پشتیبان باید دسترسی مدیریت تنظیمات داشته باشید.";
        else if (res.status === 429) message = "درخواست‌های زیاد. چند دقیقه صبر کنید.";
        else {
          try {
            const json = await res.json();
            if (json?.error) message = json.error;
          } catch {
            /* بدنه JSON نبود — همان پیام پیش‌فرض */
          }
        }
        toast({ title: message, tone: "error" });
        return;
      }

      const blob = await res.blob();
      /*
        ⚠️ فایل خالی یعنی چیزی خراب شده.
        بدون این بررسی، کاربر یک فایل صفر بایتی می‌گرفت و تا روزی که
        بخواهد بازش کند نمی‌فهمید.
      */
      if (blob.size === 0) {
        toast({ title: "فایل پشتیبان خالی بود. دوباره تلاش کنید.", tone: "error" });
        return;
      }

      downloadBlob(blob, `tarazoo-backup-${todayJalali().replace(/\//g, "-")}.xlsx`);
      toast({
        title: "پشتیبان دانلود شد",
        description: "فایل را جای امنی نگه دارید.",
        tone: "success",
      });
    } catch (error) {
      toast({ title: (error as Error).message || "خطای شبکه", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4 sm:p-5">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-extrabold text-foreground">
        <DatabaseBackup size={17} aria-hidden />
        پشتیبان کامل
      </h2>
      <p className="mb-4 text-2xs leading-6 text-muted-foreground">
        یک فایل اکسل از تمام اطلاعات کسب‌وکار شما: کالاها، تنوع‌ها، اشخاص، فاکتورهای فروش،
        تراکنش‌های مالی، گردش انبار، حساب‌ها و دسته‌بندی‌ها — هرکدام در یک شیت جدا.
      </p>

      <div className="mb-4 flex gap-2.5 rounded-xl bg-warning-soft/40 p-3">
        <ShieldCheck size={16} className="mt-0.5 shrink-0 text-warning-onSoft" aria-hidden />
        <p className="text-2xs leading-6 text-foreground">
          پیش از هر تغییر بزرگ — مثل ورود دسته‌جمعی از اکسل — یک پشتیبان بگیرید.
          {" "}
          <span className="text-muted-foreground">
            این فایل برای نگهداری و مرور است؛ فعلاً امکان بازگردانی خودکار از روی آن وجود ندارد.
          </span>
        </p>
      </div>

      <Button
        onClick={download}
        loading={busy}
        icon={busy ? <Loader2 size={15} /> : <Download size={15} />}
      >
        {busy ? "در حال آماده‌سازی…" : "دانلود پشتیبان"}
      </Button>

      {busy && (
        <p className="mt-2 text-2xs text-muted-foreground">
          بسته به حجم اطلاعات ممکن است تا یک دقیقه طول بکشد. صفحه را نبندید.
        </p>
      )}
    </Card>
  );
}
