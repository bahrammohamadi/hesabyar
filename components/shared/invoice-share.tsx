"use client";

import { useState } from "react";
import { Download, Image as ImageIcon, Link2, Loader2, MessageCircle, Share2 } from "lucide-react";
import { useToast } from "@/src/shared/ui";
import { safeFileName, toWhatsAppNumber } from "@/lib/brand-identity";

/**
 * ارسال فاکتور به مشتری — تصویر، دانلود، واتساپ و لینک.
 *
 * چرا تصویر و نه فقط PDF؟
 *   مشتری ایرانی فاکتور را در واتساپ می‌گیرد و تصویر همان‌جا نمایش
 *   داده می‌شود؛ PDF باید دانلود و باز شود. برای فروش خرده، تصویر
 *   عملاً کاربردی‌تر است. PDF هم از همان دکمه‌ی چاپ مرورگر می‌آید.
 *
 * ⚠️ چرا کتابخانه و نه خودمان با canvas؟
 *   رندر متن راست‌به‌چپ فارسی با فونت سفارشی روی canvas خام، حروف را
 *   جدا و برعکس می‌کند. `html-to-image` از serialization خود مرورگر
 *   استفاده می‌کند، پس هر چیزی که روی صفحه درست دیده می‌شود در تصویر
 *   هم درست است.
 */

export function InvoiceShare({
  targetId,
  invoiceNo,
  customerPhone,
  brandName,
  totalLabel,
}: {
  /** شناسه‌ی عنصری که باید تصویر شود (همان ناحیه‌ی چاپ فاکتور). */
  targetId: string;
  invoiceNo: string | null;
  customerPhone?: string | null;
  brandName: string;
  /** مبلغ برای متن پیام واتساپ. */
  totalLabel: string;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<null | "image" | "share">(null);

  const fileBase = safeFileName(`${brandName}-${invoiceNo ?? "invoice"}`);
  const waNumber = toWhatsAppNumber(customerPhone);

  /** تصویر PNG از ناحیه‌ی فاکتور می‌سازد. */
  async function renderPng(): Promise<Blob | null> {
    const node = document.getElementById(targetId);
    if (!node) {
      toast({ title: "ناحیه‌ی فاکتور پیدا نشد", tone: "error" });
      return null;
    }
    /*
      import پویا: این کتابخانه فقط وقتی لازم است که کاربر واقعاً
      دکمه را بزند. وارد کردنش در بالای فایل، به باندل هر صفحه‌ای که
      این کامپوننت را دارد اضافه می‌شد.
    */
    const { toBlob } = await import("html-to-image");
    return toBlob(node, {
      // پس‌زمینه‌ی صریح: بدون آن، تصویر شفاف می‌شود و در واتساپ سیاه دیده می‌شود.
      backgroundColor: "#ffffff",
      pixelRatio: 2,
      /*
        عناصر `no-print` (دکمه‌ها، منوی سه‌نقطه) نباید در تصویری که
        دست مشتری می‌رود باشند — همان قاعده‌ی نسخه‌ی چاپی.
      */
      filter: (el) =>
        !(el instanceof HTMLElement && el.classList?.contains("no-print")),
    });
  }

  async function downloadImage() {
    setBusy("image");
    try {
      const blob = await renderPng();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileBase}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "تصویر فاکتور دانلود شد", tone: "success" });
    } catch (e) {
      toast({ title: "خطا در ساخت تصویر: " + (e as Error).message, tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  /**
   * منوی اشتراک‌گذاری بومی گوشی.
   *
   * ⚠️ `navigator.share` با فایل فقط روی HTTPS و در بعضی مرورگرها
   * کار می‌کند. `canShare` را حتماً چک می‌کنیم؛ بدون آن روی دسکتاپ
   * استثنا می‌دهد و کاربر فکر می‌کند برنامه خراب است.
   */
  async function shareImage() {
    setBusy("share");
    try {
      const blob = await renderPng();
      if (!blob) return;
      const file = new File([blob], `${fileBase}.png`, { type: "image/png" });

      const canShareFiles =
        typeof navigator !== "undefined" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] });

      if (canShareFiles) {
        await navigator.share({
          files: [file],
          title: `فاکتور ${invoiceNo ?? ""}`.trim(),
          text: `فاکتور ${brandName}`,
        });
        return;
      }

      // مرورگری که اشتراک فایل ندارد: به دانلود برمی‌گردیم، نه خطای خشک.
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileBase}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: "مرورگر شما اشتراک مستقیم ندارد",
        description: "تصویر دانلود شد؛ از گالری برای مشتری بفرستید.",
        tone: "info",
      });
    } catch (e) {
      // کاربر ممکن است پنجره‌ی اشتراک را ببندد — این خطا نیست.
      if ((e as Error).name === "AbortError") return;
      toast({ title: "خطا در اشتراک‌گذاری: " + (e as Error).message, tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  /**
   * واتساپ فقط متن می‌پذیرد؛ فایل را نمی‌شود با لینک فرستاد.
   *
   * پس متن خلاصه + لینک فاکتور می‌فرستیم و کاربر در صورت نیاز تصویر
   * را جدا اشتراک می‌گذارد. صادقانه‌تر از دکمه‌ای است که وعده‌ی
   * ارسال فایل بدهد و ندهد.
   */
  function openWhatsApp() {
    const lines = [
      `سلام، فاکتور ${invoiceNo ?? ""} از ${brandName}`.trim(),
      `مبلغ: ${totalLabel}`,
      typeof window !== "undefined" ? window.location.href : "",
    ].filter(Boolean);
    const text = encodeURIComponent(lines.join("\n"));
    const base = waNumber ? `https://wa.me/${waNumber}` : "https://wa.me/";
    window.open(`${base}?text=${text}`, "_blank", "noopener,noreferrer");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({ title: "لینک فاکتور کپی شد", tone: "success" });
    } catch {
      toast({ title: "کپی نشد؛ نشانی را از نوار مرورگر بردارید", tone: "error" });
    }
  }

  return (
    <div className="no-print flex flex-wrap gap-2">
      <button
        onClick={shareImage}
        disabled={busy !== null}
        className="btn-secondary"
        aria-label="ارسال تصویر فاکتور برای مشتری"
      >
        {busy === "share" ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
        ارسال تصویر
      </button>

      <button
        onClick={downloadImage}
        disabled={busy !== null}
        className="btn-secondary"
        aria-label="دانلود تصویر فاکتور"
      >
        {busy === "image" ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
        تصویر
      </button>

      <button onClick={openWhatsApp} className="btn-secondary" aria-label="ارسال با واتساپ">
        <MessageCircle size={16} />
        واتساپ
      </button>

      <button onClick={copyLink} className="btn-secondary" aria-label="کپی لینک فاکتور">
        <Link2 size={16} />
        لینک
      </button>
    </div>
  );
}
