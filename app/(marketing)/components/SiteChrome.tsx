import type { ReactNode } from "react";
import Link from "next/link";
import { Mail, MapPin, Phone, Receipt } from "lucide-react";
import { toFaDigits } from "@/lib/utils/format";
import { BRAND_NAME, BRAND_CONTACT_EMAIL } from "@/lib/brand";
import { SiteNav, SiteMobileNav } from "./SiteNav";

/**
 * قالب مشترک وب‌سایت عمومی (هدر + فوتر).
 *
 * چرا جدا از MarketingPieces؟
 *   MarketingPieces مخصوص محتوای صفحه‌ی اصلی است. هدر و فوتر باید در
 *   همه‌ی صفحات یکسان باشند، پس در layout استفاده می‌شوند نه در تک‌تک صفحات.
 *
 * سرور-کامپوننت است؛ فقط منوی موبایل که به state نیاز دارد کلاینت است.
 */

export const SITE_NAV = [
  { href: "/", label: "خانه" },
  { href: "/features", label: "امکانات" },
  { href: "/pricing", label: "تعرفه‌ها" },
  { href: "/guide", label: "راهنما" },
  { href: "/faq", label: "سوالات متداول" },
  { href: "/about", label: "درباره ما" },
  { href: "/contact", label: "تماس" },
] as const;

/**
 * هدر سایت.
 *
 * `isAuthenticated` تعیین می‌کند دکمه‌ی چپ «ورود» باشد یا «ورود به پنل».
 * کاربر واردشده دیگر به زور به داشبورد منتقل نمی‌شود — می‌تواند سایت را
 * ببیند و هر وقت خواست وارد پنل شود.
 */
export function SiteHeader({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Receipt size={18} />
          </span>
          <span className="text-base font-black text-foreground">{BRAND_NAME}</span>
        </Link>

        <SiteNav items={SITE_NAV} />

        <div className="flex shrink-0 items-center gap-2">
          {isAuthenticated ? (
            <Link
              href="/dashboard"
              className="inline-flex min-h-9 items-center rounded-xl bg-primary px-3.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 active:scale-95"
            >
              ورود به پنل
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden min-h-9 items-center rounded-xl px-3 text-sm font-bold text-foreground/80 transition hover:bg-muted hover:text-foreground sm:inline-flex"
              >
                ورود
              </Link>
              <Link
                href="/register"
                className="inline-flex min-h-9 items-center rounded-xl bg-primary px-3.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 active:scale-95"
              >
                ثبت‌نام رایگان
              </Link>
            </>
          )}
          <SiteMobileNav items={SITE_NAV} isAuthenticated={isAuthenticated} />
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */

const FOOTER_PRODUCT = [
  { href: "/features", label: "امکانات" },
  { href: "/pricing", label: "تعرفه‌ها" },
  { href: "/guide", label: "راهنمای شروع" },
];

const FOOTER_COMPANY = [
  { href: "/about", label: "درباره ما" },
  { href: "/contact", label: "تماس با ما" },
  { href: "/faq", label: "سوالات متداول" },
];

const FOOTER_LEGAL = [
  { href: "/privacy", label: "حریم خصوصی" },
  { href: "/terms", label: "قوانین و مقررات" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Receipt size={18} />
            </span>
            <span className="text-base font-black text-foreground">{BRAND_NAME}</span>
          </div>
          <p className="mt-3 text-xs leading-7 text-muted-foreground">
            {BRAND_NAME} همراه هوشمند شما در مدیریت مالی و انبارداری است. ما با ساده‌سازی فرآیندهای
            حسابداری، فرصت تمرکز روی رشد کسب‌وکارتان را فراهم می‌کنیم.
          </p>
        </div>

        <FooterColumn title="محصول" links={FOOTER_PRODUCT} />
        <FooterColumn title="شرکت" links={FOOTER_COMPANY} />

        <div>
          <h3 className="text-sm font-black text-foreground">ارتباط با ما</h3>
          <ul className="mt-3 space-y-2.5">
            <ContactRow icon={Phone} text={toFaDigits("021-12345678")} />
            <ContactRow icon={Mail} text={BRAND_CONTACT_EMAIL} />
            <ContactRow icon={MapPin} text="تهران، خیابان ولیعصر، برج مدیریت" />
          </ul>
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
            {FOOTER_LEGAL.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="text-xs text-muted-foreground transition hover:text-primary"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        © {toFaDigits(1404)} تمامی حقوق برای {BRAND_NAME} محفوظ است.
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: readonly { href: string; label: string }[];
}) {
  return (
    <div>
      <h3 className="text-sm font-black text-foreground">{title}</h3>
      <ul className="mt-3 space-y-2.5">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="text-xs text-muted-foreground transition hover:text-primary"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ContactRow({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <li className="flex items-center gap-2 text-xs text-muted-foreground">
      <Icon size={14} className="shrink-0 text-primary" />
      <span>{text}</span>
    </li>
  );
}

/* ------------------------------------------------------------------ */

/** پوسته‌ی صفحه — پس‌زمینه و جهت راست‌به‌چپ. */
export function SiteShell({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-background text-foreground">{children}</div>;
}

/** سربرگ استاندارد صفحات داخلی سایت. */
export function PageHero({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <section className="border-b border-border bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-12 text-center sm:px-6 sm:py-16">
        {eyebrow ? (
          <span className="text-xs font-bold uppercase tracking-wider text-primary">{eyebrow}</span>
        ) : null}
        <h1 className="mt-2 text-2xl font-black leading-[1.7] text-foreground sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-8 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
    </section>
  );
}
