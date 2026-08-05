import { NextResponse } from "next/server";

/**
 * پاسخ دانلود فایل اکسل.
 *
 * ⚠️ چرا در lib و نه کنار روت؟
 *   فایل‌های `route.ts` در Next.js فقط اجازه‌ی export نام‌های
 *   شناخته‌شده (GET/POST/dynamic/…) را دارند. همین درس در ساخت
 *   تیکت پشتیبانی گرفته شد: `tsc --noEmit` تمیز رد شد ولی
 *   `next build` با پیام «"X" is not a valid Route export field»
 *   شکست.
 *
 * ⚠️ نام فایل ASCII است. نام فارسی در Content-Disposition بدون
 *   کدگذاری RFC 5987 در بعضی مرورگرها خراب می‌شود.
 */
export function xlsxResponse(buffer: Buffer, fileName: string) {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
