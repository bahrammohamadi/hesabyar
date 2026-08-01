"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent, ReactNode } from "react";
import { usePanelManager } from "./panel-manager.store";

/**
 * لینکی که کاربر را از پنل کشویی به یک صفحه‌ی کامل می‌برد.
 *
 * مشکلی که حل می‌کند:
 *   پنل‌ها با `<Link>` معمولی به صفحه‌ی اختصاصی لینک می‌دادند. مسیر عوض
 *   می‌شد ولی پشته‌ی پنل دست‌نخورده می‌ماند، چون PanelManager وضعیتش را
 *   در query string نگه می‌دارد و ناوبری کلاینتی آن را پاک نمی‌کند.
 *   نتیجه: صفحه‌ی مقصد پشت یک کشوی تمام‌صفحه پنهان می‌شد.
 *
 *   (تأیید شده: کلیک روی «مشاهده کامل» در پنل فاکتور، URL را عوض می‌کرد
 *   ولی پنل با ابعاد ۱۴۴۰×۹۰۰ روی صفحه باقی می‌ماند.)
 *
 * ترتیب کار مهم است: اول پنل‌ها بسته می‌شوند، بعد ناوبری انجام می‌شود،
 * وگرنه بستنِ پنل، query string صفحه‌ی جدید را بازنویسی می‌کند.
 */
export function PanelExitLink({
  href,
  children,
  onClick,
  ...rest
}: {
  href: string;
  children: ReactNode;
} & Omit<ComponentProps<typeof Link>, "href" | "children">) {
  const { closeAll } = usePanelManager();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented) return;
    // کلیک با Ctrl/Cmd یا دکمه وسط یعنی «باز کردن در تب جدید» → دست نمی‌زنیم.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    closeAll();
  }

  return (
    <Link href={href} onClick={handleClick} {...rest}>
      {children}
    </Link>
  );
}
