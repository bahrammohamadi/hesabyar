"use client";

import Link from "next/link";
import {
  Building2, FileSpreadsheet, FolderTree, KeyRound, Landmark,
  Shield, SlidersHorizontal, Stethoscope, Tags,
} from "lucide-react";
import { PageHeader } from "@/components/shared/ui";
import { Card } from "@/src/shared/ui";
import { cn } from "@/lib/utils/cn";

/**
 * داشبورد تنظیمات — فقط نقطه‌ی ورود.
 *
 * 🔴 این فایل تا پیش از این **۶۴۳ خط** بود و همه‌چیز را در خودش
 * داشت: داشبورد، تم رنگی، سه فهرست قابل مدیریت، مدیریت حساب‌های
 * بانکی، درخت ۵۱ گزینه‌ای مجوز و دو مودال. زیرصفحه‌های
 * /settings/users و /settings/catalog و /settings/accounts هرکدام
 * فقط دو خط بودند که همین فایل را با یک prop صدا می‌زدند.
 *
 * حالا هر بخش صفحه‌ی واقعی خودش را دارد و این فایل فقط کارت‌های
 * ورود را نشان می‌دهد.
 */

type SettingsCard = {
  title: string;
  desc: string;
  href: string;
  icon: React.ElementType;
  tone: string;
  group: string;
};

const CARDS: SettingsCard[] = [
  {
    title: "حساب کاربری",
    desc: "نام، شماره تماس، تغییر رمز عبور و دستگاه‌های فعال",
    href: "/settings/account",
    icon: KeyRound,
    tone: "bg-info-soft text-info-onSoft",
    group: "حساب من",
  },
  {
    title: "کسب‌وکار و ظاهر",
    desc: "نام فروشگاه و تم رنگی برنامه",
    href: "/settings/general",
    icon: Building2,
    tone: "bg-primary/10 text-primary",
    group: "کسب‌وکار",
  },
  {
    title: "کاربران و دسترسی‌ها",
    desc: "ساخت کاربر، تعیین نقش و سطح دسترسی",
    href: "/settings/users",
    icon: Shield,
    tone: "bg-primary/10 text-primary",
    group: "کسب‌وکار",
  },
  {
    title: "مالی و حساب‌ها",
    desc: "صندوق، حساب‌های بانکی و دسته‌بندی هزینه",
    href: "/settings/accounts",
    icon: Landmark,
    tone: "bg-success-soft text-success-onSoft",
    group: "کسب‌وکار",
  },
  {
    title: "کاتالوگ",
    desc: "دسته‌بندی کالا و برندها",
    href: "/settings/catalog",
    icon: FolderTree,
    tone: "bg-warning-soft text-warning-onSoft",
    group: "کالا",
  },
  {
    title: "لیست قیمت‌ها",
    desc: "قیمت‌گذاری اختصاصی برای گروه‌های مشتری",
    href: "/settings/price-lists",
    icon: Tags,
    tone: "bg-warning-soft text-warning-onSoft",
    group: "کالا",
  },
  {
    title: "ورود اطلاعات از اکسل",
    desc: "کالاها یا مشتریان را دسته‌جمعی وارد کنید",
    href: "/settings/import",
    icon: FileSpreadsheet,
    tone: "bg-info-soft text-info-onSoft",
    group: "ابزارها",
  },
  {
    title: "بررسی میکروفون و دوربین",
    desc: "عیب‌یابی فاکتور صوتی و بارکدخوان",
    href: "/settings/diagnostics",
    icon: Stethoscope,
    tone: "bg-muted text-foreground",
    group: "ابزارها",
  },
  {
    title: "گزارش فعالیت",
    desc: "تاریخچه‌ی تغییرات و عملیات کاربران",
    href: "/activity",
    icon: SlidersHorizontal,
    tone: "bg-muted text-foreground",
    group: "ابزارها",
  },
];

/*
  گروه‌بندی به‌جای یک شبکه‌ی ۹تایی یکنواخت.

  «شلوغ» فقط تعداد نیست؛ نبودِ سلسله‌مراتب است. نُه کارت هم‌وزن
  یعنی چشم باید همه را بخواند تا یکی را پیدا کند. با چهار عنوان،
  کاربر اول گروه را انتخاب می‌کند و بعد داخل دو-سه گزینه می‌گردد.
*/
const GROUP_ORDER = ["حساب من", "کسب‌وکار", "کالا", "ابزارها"] as const;

export default function SettingsPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="تنظیمات"
        subtitle="برای ویرایش هر بخش، وارد آن شوید"
      />

      {GROUP_ORDER.map((group) => {
        const cards = CARDS.filter((c) => c.group === group);
        if (cards.length === 0) return null;

        return (
          <section key={group} className="space-y-2.5">
            <h2 className="text-xs font-extrabold text-muted-foreground">{group}</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {cards.map((card) => {
                const Icon = card.icon;
                return (
                  <Link
                    key={card.href}
                    href={card.href}
                    className="group rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <Card className="h-full p-4 transition group-hover:border-primary/30 group-hover:shadow-md">
                      <div
                        className={cn(
                          "mb-3 flex h-10 w-10 items-center justify-center rounded-xl",
                          card.tone
                        )}
                      >
                        <Icon size={19} aria-hidden />
                      </div>
                      <h3 className="text-sm font-extrabold text-foreground group-hover:text-primary">
                        {card.title}
                      </h3>
                      <p className="mt-1 text-2xs leading-5 text-muted-foreground">{card.desc}</p>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
