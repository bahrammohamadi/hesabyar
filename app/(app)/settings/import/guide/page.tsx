"use client";

import Link from "next/link";
import {
  AlertTriangle, ArrowRight, CheckCircle2, Download, FileSpreadsheet,
  HelpCircle, RotateCcw, ShieldCheck, Upload,
} from "lucide-react";
import { PageHeader } from "@/components/shared/ui";
import { Button, Card } from "@/src/shared/ui";
import { COLUMNS, KIND_LABEL, MAX_ROWS, type ImportKind } from "@/lib/import/schema";
import { toFaDigits } from "@/lib/utils/format";

/**
 * دستورالعمل ورود داده.
 *
 * جدا از خودِ صفحه‌ی آپلود نوشته شد چون دو کار متفاوت‌اند: کسی که
 * دارد فایل می‌فرستد نباید هر بار از میان چهار صفحه توضیح رد شود، و
 * کسی که اولین بار می‌آید به توضیح کامل نیاز دارد.
 *
 * جدول ستون‌ها از همان تعریفی می‌آید که قالب اکسل را می‌سازد
 * (`lib/import/schema.ts`). اگر ستونی اضافه شود، این صفحه خودبه‌خود
 * به‌روز می‌شود — راهنمایی که با واقعیت اختلاف دارد، بدتر از نبودنش است.
 */
export default function ImportGuidePage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="راهنمای ورود اطلاعات از اکسل"
        subtitle="گام‌به‌گام: از دانلود قالب تا ثبت نهایی و برگرداندن در صورت اشتباه"
        action={
          <Link href="/settings/import">
            <Button icon={<ArrowRight size={15} />}>رفتن به صفحه‌ی ورود</Button>
          </Link>
        }
      />

      {/* ── هشدار پشتیبان ── */}
      <Card className="border-warning/30 bg-warning-soft/40 p-4 sm:p-5">
        <div className="flex gap-3">
          <ShieldCheck size={20} className="mt-0.5 shrink-0 text-warning-onSoft" aria-hidden />
          <div className="text-sm leading-7 text-foreground">
            <p className="font-extrabold">پیش از هر کاری: از اطلاعات خود پشتیبان بگیرید.</p>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">
              ورود دسته‌جمعی صدها رکورد را یک‌باره اضافه می‌کند. اگرچه هر ورود قابل
              «برگرداندن» است، ولی پشتیبان‌گرفتن پیش از تغییرات بزرگ یک عادت درست است.
            </p>
            {/*
              🔴 این متن قبلاً می‌گفت «از پشتیبانی بخواهید یک نسخه‌ی کامل
              برایتان بفرستد» — چون دکمه‌ای وجود نداشت. حالا دارد.
            */}
            <Link
              href="/settings/backup"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-extrabold text-warning-onSoft hover:underline"
            >
              گرفتن پشتیبان کامل
              <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
        </div>
      </Card>

      {/* ── مراحل ── */}
      <Card className="p-4 sm:p-5">
        <h2 className="mb-4 text-sm font-extrabold text-foreground">چهار گام</h2>
        <ol className="space-y-4">
          <Step
            n={1}
            icon={Download}
            title="قالب خام را دانلود کنید"
            body="در صفحه‌ی «ورود اطلاعات از اکسل»، اول انتخاب کنید کالا وارد می‌کنید یا مشتری، بعد دکمه‌ی دانلود قالب را بزنید."
            notes={[
              "قالب مخصوص کسب‌وکار شماست: شیت «فهرست» دسته‌بندی‌ها و برندهای موجود شما را دارد.",
              "قالب سه شیت دارد: «داده» جایی است که می‌نویسید، «راهنما» توضیح هر ستون، «فهرست» نام‌های مجاز.",
            ]}
          />
          <Step
            n={2}
            icon={FileSpreadsheet}
            title="فایل را پر کنید"
            body="سطر اول (نام ستون‌ها) را دست نزنید. سطر دوم یک نمونه است — آن را پاک کنید و داده‌ی خودتان را از همان‌جا بنویسید."
            notes={[
              "ستونی که لازم ندارید را خالی بگذارید؛ خودِ ستون را حذف نکنید.",
              "مبالغ به تومان و فقط عدد. «۲۵۰,۰۰۰» یا «۲۵۰۰۰۰» هر دو درست است، ولی «۲۵۰ هزار» خیر.",
              "ارقام فارسی مشکلی ندارد — سیستم خودش تبدیل می‌کند.",
              `حداکثر ${toFaDigits(MAX_ROWS)} سطر در هر فایل. اگر بیشتر دارید، چند فایل بسازید.`,
            ]}
          />
          <Step
            n={3}
            icon={CheckCircle2}
            title="«بررسی فایل» را بزنید"
            body="این مرحله هیچ چیزی ثبت نمی‌کند. فقط می‌گوید چند سطر سالم است و کدام سطرها ایراد دارند."
            notes={[
              "شماره‌ی سطر در گزارش، دقیقاً همان شماره‌ای است که در اکسل می‌بینید.",
              "ایرادها را در فایل اصلاح کنید و دوباره بررسی بگیرید. این کار را هر چند بار لازم بود تکرار کنید.",
            ]}
          />
          <Step
            n={4}
            icon={Upload}
            title="«ثبت نهایی» را بزنید"
            body="حالا داده وارد سیستم می‌شود. در پایان یک گزارش کامل می‌بینید: چند تا ثبت شد، چند تا رد شد و چرا."
            notes={[
              "دکمه‌ی ثبت نهایی تا وقتی فایل را بررسی نکرده‌اید غیرفعال است.",
            ]}
          />
        </ol>
      </Card>

      {/* ── ستون‌ها ── */}
      {(Object.keys(KIND_LABEL) as ImportKind[]).map((kind) => (
        <Card key={kind} className="p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-extrabold text-foreground">
            ستون‌های فایل {KIND_LABEL[kind]}
          </h2>
          {/*
            جدول روی موبایل به کارت تبدیل می‌شود؛ اسکرول افقی روی
            صفحه‌ی ۳۹۰ پیکسلی یعنی کاربر ستون «توضیح» را اصلاً نمی‌بیند.
          */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="p-2 text-right font-extrabold text-foreground">ستون</th>
                  <th scope="col" className="p-2 text-right font-extrabold text-foreground">اجباری</th>
                  <th scope="col" className="p-2 text-right font-extrabold text-foreground">توضیح</th>
                  <th scope="col" className="p-2 text-right font-extrabold text-foreground">نمونه</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {COLUMNS[kind].map((c) => (
                  <tr key={c.key}>
                    <td className="p-2 font-bold text-foreground">{c.header}</td>
                    <td className="p-2">
                      {c.required ? (
                        <span className="font-bold text-destructive-text">بله</span>
                      ) : (
                        <span className="text-muted-foreground">خیر</span>
                      )}
                    </td>
                    <td className="p-2 leading-6 text-muted-foreground">{c.hint}</td>
                    <td className="p-2 text-muted-foreground">{String(c.sample) || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-2.5 sm:hidden">
            {COLUMNS[kind].map((c) => (
              <li key={c.key} className="rounded-xl border border-border p-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-extrabold text-foreground">{c.header}</span>
                  {c.required && (
                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-2xs font-bold text-destructive-text">
                      اجباری
                    </span>
                  )}
                </div>
                <p className="mt-1 text-2xs leading-5 text-muted-foreground">{c.hint}</p>
                {String(c.sample) && (
                  <p className="mt-1 text-2xs text-muted-foreground">نمونه: {String(c.sample)}</p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      ))}

      {/* ── پرسش‌های رایج ── */}
      <Card className="p-4 sm:p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-foreground">
          <HelpCircle size={16} aria-hidden />
          پرسش‌های رایج
        </h2>
        <div className="space-y-3">
          <Faq
            q="اگر کالایی از قبل در سیستم باشد چه می‌شود؟"
            a="بسته به گزینه‌ای که انتخاب می‌کنید. حالت پیش‌فرض «رد کن و دست نزن» است: رکورد موجود دست‌نخورده می‌ماند و در گزارش می‌بینید چند سطر رد شد. حالت «به‌روزرسانی» اطلاعات را با فایل جایگزین می‌کند — ولی ستون‌هایی که در فایل خالی گذاشته‌اید دست‌نخورده می‌مانند، پس اطلاعات موجودتان پاک نمی‌شود."
          />
          <Faq
            q="تکراری بودن از کجا تشخیص داده می‌شود؟"
            a="برای کالا: اول بارکد، اگر نبود کد کالا، اگر آن هم نبود ترکیب نام و رنگ و سایز. برای مشتری: اول شماره موبایل، بعد کد، بعد نام. شماره‌ی موبایل در هر شکلی نوشته شود (۰۹۱۲…، ‎+۹۸۹۱۲…، ۹۱۲…) یکسان تشخیص داده می‌شود."
          />
          <Faq
            q="یک پیراهن در سه رنگ دارم. سه سطر بنویسم یا یکی؟"
            a="سه سطر، با نام یکسان و رنگ‌های متفاوت. سیستم آن‌ها را یک کالا با سه تنوع (واریانت) ثبت می‌کند، نه سه کالای جدا. همین برای سایز هم صدق می‌کند."
          />
          <Faq
            q="موجودی انبار را چطور وارد کنم؟"
            a="ستون «موجودی اولیه» را پر کنید. سیستم یک سند انبارگردانی خودکار با عنوان «موجودی اولیه از فایل اکسل» ثبت می‌کند تا کاردکس کالا از روز اول درست باشد. اگر این ستون را خالی بگذارید، کالا با موجودی صفر ثبت می‌شود و بعداً می‌توانید از «انبارگردانی» واردش کنید."
          />
          <Faq
            q="دسته‌بندی جدید در فایل نوشتم ولی ساخته نشد."
            a="دسته‌بندی‌های تازه از این مسیر ساخته نمی‌شوند. اول از «تنظیمات ← کاتالوگ» دسته را بسازید، بعد در فایل از همان نام استفاده کنید. اگر دسته‌ای پیدا نشود، کالا بدون دسته ثبت می‌شود و در گزارش هشدارش را می‌بینید. برندها این محدودیت را ندارند و خودکار ساخته می‌شوند."
          />
          <Faq
            q="فایل CSV دارم، نه اکسل."
            a="مشکلی نیست، CSV هم پذیرفته می‌شود. فقط مطمئن شوید فایل با کدگذاری UTF-8 ذخیره شده باشد وگرنه حروف فارسی به‌هم‌ریخته می‌شوند. در اکسل موقع ذخیره گزینه‌ی «CSV UTF-8» را انتخاب کنید."
          />
          <Faq
            q="اشتباه وارد کردم. چه کار کنم؟"
            a="در همان صفحه، پایین بخش «ورودهای قبلی»، دکمه‌ی «برگرداندن» را بزنید. تمام رکوردهای آن فایل حذف می‌شوند. تنها استثنا: رکوردی که در این فاصله در فاکتور یا تراکنشی استفاده شده باشد — آن حذف نمی‌شود (چون فاکتور را خراب می‌کند) و فقط غیرفعال می‌گردد."
          />
          <Faq
            q="خودم نمی‌توانم. می‌شود شما انجام دهید؟"
            a="بله. فایل را از طریق «پشتیبانی» برای ما بفرستید و در تیکت بنویسید که می‌خواهید وارد شود. تیم پشتیبانی این کار را برایتان انجام می‌دهد و گزارشش را همان‌جا می‌گیرید."
          />
        </div>
      </Card>

      {/* ── اشتباهات رایج ── */}
      <Card className="p-4 sm:p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-foreground">
          <AlertTriangle size={16} aria-hidden />
          اشتباه‌های رایج
        </h2>
        <ul className="space-y-2">
          {[
            "نوشتن «۲۵۰ هزار» به‌جای «۲۵۰۰۰۰» در ستون قیمت — سطر رد می‌شود.",
            "پاک‌کردن یا تغییر دادن سطر اول (نام ستون‌ها) — فایل شناخته نمی‌شود.",
            "جا گذاشتن سطر نمونه در فایل — یک کالای الکی به نام «پیراهن مردانه آستین بلند» ثبت می‌شود.",
            "نوشتن شماره‌ی ثابت در ستون موبایل — فقط شماره‌ی موبایل (شروع با ۰۹) پذیرفته می‌شود.",
            "ذخیره‌ی CSV با کدگذاری غیر UTF-8 — حروف فارسی خراب می‌شوند.",
            "حذف کردن ستونی که لازم ندارید — به‌جایش آن را خالی بگذارید.",
          ].map((t, i) => (
            <li key={i} className="flex gap-2 text-xs leading-6 text-muted-foreground">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-destructive" aria-hidden />
              {t}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <RotateCcw size={16} className="text-primary" aria-hidden />
            <p className="text-xs leading-6 text-muted-foreground">
              آماده‌اید؟ هر ورود قابل برگرداندن است، پس با خیال راحت شروع کنید.
            </p>
          </div>
          <Link href="/settings/import" className="shrink-0">
            <Button icon={<Upload size={15} />}>شروع ورود اطلاعات</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}

function Step({
  n, icon: Icon, title, body, notes,
}: {
  n: number;
  icon: React.ElementType;
  title: string;
  body: string;
  notes?: string[];
}) {
  return (
    <li className="flex gap-3">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
        aria-hidden
      >
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <h3 className="text-sm font-extrabold text-foreground">
          گام {toFaDigits(n)}: {title}
        </h3>
        <p className="mt-1 text-xs leading-6 text-muted-foreground">{body}</p>
        {notes && notes.length > 0 && (
          <ul className="mt-1.5 space-y-1">
            {notes.map((t, i) => (
              <li key={i} className="flex gap-2 text-2xs leading-5 text-muted-foreground">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/50" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="rounded-xl border border-border p-3">
      <summary className="cursor-pointer text-xs font-extrabold text-foreground">{q}</summary>
      <p className="mt-2 text-xs leading-6 text-muted-foreground">{a}</p>
    </details>
  );
}
