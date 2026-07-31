"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type NavItem = { href: string; label: string };

/** ناوبری دسکتاپ با برجسته‌سازی صفحه‌ی جاری. */
export function SiteNav({ items }: { items: readonly NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="hidden items-center gap-1 lg:flex">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-bold transition",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * منوی موبایل.
 *
 * با تغییر مسیر خودش بسته می‌شود — بدون این، کاربر بعد از کلیک روی لینک
 * صفحه‌ی جدید را پشت منوی باز می‌دید.
 */
export function SiteMobileNav({
  items,
  isAuthenticated,
}: {
  items: readonly NavItem[];
  isAuthenticated: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // وقتی منو باز است، اسکرول پس‌زمینه قفل می‌شود.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // بستن با کلید Escape (دسترس‌پذیری).
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="باز کردن منو"
        aria-expanded={open}
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border text-foreground transition hover:bg-muted lg:hidden"
      >
        <Menu size={18} />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 right-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto overscroll-contain border-l border-border bg-background p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-foreground">منو</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="بستن منو"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border text-foreground transition hover:bg-muted"
              >
                <X size={18} />
              </button>
            </div>

            <nav className="mt-4 flex flex-col gap-1">
              {items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "rounded-xl px-3 py-2.5 text-sm font-bold transition",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto flex flex-col gap-2 pt-6">
              {isAuthenticated ? (
                <Link
                  href="/dashboard"
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground"
                >
                  ورود به پنل
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-bold text-foreground"
                  >
                    ورود
                  </Link>
                  <Link
                    href="/register"
                    className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground"
                  >
                    ثبت‌نام رایگان
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
