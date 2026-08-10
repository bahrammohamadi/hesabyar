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
  /*
    🔴 گارد ASCII — نه فقط قرارداد، بلکه اجبار.

    هدرهای HTTP فقط ByteString می‌پذیرند (کد نویسه ≤ ۲۵۵). یک نام
    فایل با ارقام فارسی، *کل درخواست* را با این خطا می‌ترکاند:

      TypeError: Cannot convert argument to a ByteString because the
      character at index 37 has a value of 1778...

    این دقیقاً روی /api/backup اتفاق افتاد چون todayJalali() ارقام
    فارسی برمی‌گرداند. کامنت قبلی می‌گفت «نام ASCII است» ولی هیچ
    کدی تضمینش نمی‌کرد و tsc و build هر دو تمیز رد شدند.

    حالا هر فراخوانی امن است، حتی اگر نام آلوده بفرستد.
  */
  const safeName = fileName.replace(/[^\x20-\x7E]/g, "").replace(/"/g, "") || "download.xlsx";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Cache-Control": "no-store",
    },
  });
}
