"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { toFaDigits } from "@/lib/utils/format";
import { usePermission } from "@/lib/hooks/usePermission";
import { usePlatformAdmin } from "@/lib/hooks/usePlatformAdmin";
import { BRAND_NAME, BRAND_VERSION, BRAND_BUILD_SHA } from "@/lib/brand";
import {
  PanelRightClose, PanelRightOpen,
  LayoutDashboard, Package, Warehouse, ShoppingCart, Receipt, Users,
  Wallet, Settings, BarChart3, X, ChevronDown, ShieldCheck, Shield,
  PackageSearch, Plus as PlusIcon, Layers, ArrowDownToLine,
  ArrowUpFromLine, ArrowLeftRight, ClipboardList, UserPlus, Truck,
  ArrowDownCircle, ArrowUpCircle, Scale, Landmark, ReceiptText,
  TrendingUp, ShoppingBag, BarChart2, Calculator, CreditCard,
  FileText, Percent, ShoppingBasket, Boxes, PercentCircle,
  Building, UserCheck, AlertCircle, PieChart, Activity,
  Briefcase, BookOpen, ShoppingBagIcon, Tags, Barcode,
  ArrowRightLeft, History, PiggyBank, Banknote, Coins, Gift, MessageCircle, Calendar, Target, Bell, UserCircle,
  LifeBuoy, TicketCheck, FileSpreadsheet, Stethoscope, Server, DatabaseBackup, Store, Palette,
} from "lucide-react";

export const NAV = [
  { href: "/dashboard", label: "داشبورد", icon: LayoutDashboard, showInMobileBottomNav: true },
  {
    label: "فروش",
    icon: ShoppingBag,
    highlight: true,
    showInMobileBottomNav: true,
    mobileHref: "/sales",
    children: [
      { href: "/sales", label: "فاکتورهای فروش / POS", icon: ShoppingBag },
      { href: "/sales/orders", label: "سفارش فروش", icon: ClipboardList },
      { href: "/sales/returns", label: "مرجوعی فروش", icon: ArrowLeftRight },
    ],
  },
  {
    label: "خرید",
    icon: ShoppingBasket,
    children: [
      { href: "/purchases", label: "فاکتورهای خرید", icon: ShoppingBasket },
      { href: "/purchases/returns", label: "مرجوعی خرید", icon: ArrowLeftRight },
    ],
  },
  {
    label: "اشخاص",
    icon: Users,
    showInMobileBottomNav: true,
    children: [
      { href: "/contacts", label: "همه اشخاص", icon: Scale },
      { href: "/contacts/customers", label: "مشتریان", icon: ShoppingBag },
      { href: "/contacts/suppliers", label: "تأمین‌کنندگان", icon: Truck },
      { href: "/contacts/debtors", label: "بدهکاران", icon: ArrowDownCircle },
      { href: "/contacts/creditors", label: "بستانکاران", icon: ArrowUpCircle },
    ],
  },
  {
    label: "کالا و انبار",
    icon: Package,
    showInMobileBottomNav: true,
    children: [
      { href: "/products", label: "کالاها", icon: PackageSearch },
      { href: "/inventory/movements", label: "گردش انبار", icon: ClipboardList },
      { href: "/inventory/stock-card", label: "کاردکس کالا", icon: History },
      { href: "/inventory/as-of", label: "موجودی به تاریخ", icon: Calendar },
      { href: "/inventory/in", label: "ورود کالا", icon: ArrowDownToLine },
      { href: "/inventory/out", label: "خروج کالا", icon: ArrowUpFromLine },
      { href: "/inventory/adjust", label: "انبارگردانی", icon: ArrowLeftRight },
      { href: "/inventory/waste", label: "ضایعات", icon: AlertCircle },
    ],
  },
  {
    label: "مالی",
    icon: Wallet,
    children: [
      { href: "/finance", label: "تراکنش‌ها", icon: ReceiptText },
      { href: "/finance/receipts", label: "دریافت", icon: ArrowDownCircle },
      { href: "/finance/payments", label: "پرداخت", icon: ArrowUpCircle },
      { href: "/finance/expenses", label: "هزینه", icon: Coins },
      { href: "/finance/income", label: "درآمد", icon: Banknote },
      { href: "/finance/transfers", label: "انتقال وجه", icon: ArrowRightLeft },
      { href: "/checks", label: "چک‌ها", icon: CreditCard },
    ],
  },
  {
    /*
      🔴 صفحات CRM ساخته شده بودند و کار می‌کردند، ولی **هیچ لینکی**
      در منو نداشتند — کاربر فقط با تایپ دستی نشانی پیدایشان می‌کرد.

      حسابرسی ۲۰ صفحه‌ی یتیم پیدا کرد. اینها پنج‌تایشان‌اند.
    */
    label: "مشتریان و باشگاه",
    icon: Gift,
    children: [
      { href: "/crm", label: "نمای کلی CRM", icon: Users },
      { href: "/crm/interactions", label: "پیگیری و تماس‌ها", icon: MessageCircle },
      { href: "/crm/rfm", label: "تحلیل RFM", icon: Target },
      { href: "/crm/segments", label: "سگمنت‌ها", icon: Tags },
      { href: "/crm/automation", label: "خودکارسازی", icon: Activity },
      { href: "/loyalty", label: "باشگاه و امتیاز", icon: Gift },
      { href: "/loyalty/points", label: "امتیاز و کیف‌پول", icon: Percent },
      { href: "/loyalty/campaigns", label: "کمپین‌ها", icon: Bell },
    ],
  },
  {
    label: "گزارش‌ها",
    icon: BarChart3,
    children: [
      { href: "/reports/overview-v2", label: "نمای کلی گزارش‌ها", icon: BarChart2 },
      { href: "/reports/sellers", label: "عملکرد فروشندگان", icon: UserCheck },
      { href: "/reports/profitability", label: "سود کالا/فاکتور", icon: TrendingUp },
      { href: "/reports/customer-profitability", label: "مشتریان سودآور", icon: Users },
      { href: "/activity", label: "فعالیت کاربران", icon: Activity },
    ],
  },
  {
    label: "تنظیمات",
    icon: Settings,
    children: [
      { href: "/settings", label: "داشبورد تنظیمات", icon: Settings },
      // حساب کاربری بالا می‌آید چون همه‌ی کاربران به آن نیاز دارند،
      // برخلاف بقیه‌ی تنظیمات که مخصوص مدیر است.
      /*
        🔴 این صفحه یتیم بود: فرم هویت برند و لوگو و اعلان دستگاه در
        آن ساخته شد ولی هیچ راهی برای رسیدن به آن از منو نبود.
      */
      { href: "/settings/general", label: "کسب‌وکار، برند و ظاهر", icon: Building },
      { href: "/settings/account", label: "حساب کاربری", icon: UserCircle },
      { href: "/settings/users", label: "کاربران و دسترسی‌ها", icon: UserCheck },
      { href: "/settings/accounts", label: "مالی و حساب‌ها", icon: Landmark },
      { href: "/settings/preferences", label: "نمایش و شخصی‌سازی", icon: Palette },
      { href: "/settings/catalog", label: "کاتالوگ", icon: Layers },
      { href: "/settings/price-lists", label: "لیست قیمت‌ها", icon: Tags },
      { href: "/settings/storefront", label: "صفحه‌ی عمومی فروشگاه", icon: Store },
    ],
  },
  {
    /*
      داده و ابزار از تنظیمات جدا شد.

      گروه تنظیمات به ۱۱ آیتم رسیده بود و تست سقف ده را گرفت. ولی
      مرز واقعی معنایی است نه عددی: «پشتیبان» و «ورود اکسل» و
      «بررسی میکروفون» عملیات‌اند نه تنظیم — کاربر برای عوض کردن
      چیزی سراغشان نمی‌رود، برای انجام کاری می‌رود.
    */
    label: "داده و ابزار",
    icon: DatabaseBackup,
    children: [
      { href: "/settings/backup", label: "پشتیبان و خروجی", icon: DatabaseBackup },
      { href: "/settings/import", label: "ورود اطلاعات از اکسل", icon: FileSpreadsheet },
      { href: "/settings/diagnostics", label: "بررسی میکروفون و دوربین", icon: Stethoscope },
    ],
  },
  /*
    پشتیبانی گروه ندارد و آخرین آیتم است.

    عمداً زیر «تنظیمات» نرفت: کاربری که مشکل دارد، «پشتیبانی» را در
    فهرست اصلی می‌گردد نه داخل تنظیمات. مخفی‌کردن راه ارتباطی پشت یک
    آکاردئون یعنی به‌جای تیکت، تماس تلفنی می‌گیرد.
  */
  { href: "/support", label: "پشتیبانی", icon: LifeBuoy },
];

/**
 * ناوبری سطح پلتفرم — جدا از NAV.
 *
 * چرا داخل NAV نگذاشتیم؟
 *   NAV بر پایه‌ی مجوزهای درون‌سازمانی فیلتر می‌شود (permissionForHref).
 *   مسیر /admin هیچ مجوز سازمانی متناظری ندارد، پس can(null) برای آن
 *   true برمی‌گشت و به *همه* نشان داده می‌شد. جدا نگه‌داشتن باعث می‌شود
 *   شرط نمایش صریح و غیرقابل‌اشتباه باشد.
 *
 *   ضمناً BottomNav روی NAV حلقه می‌زند؛ این جدایی تضمین می‌کند آیتم
 *   ادمین ناخواسته در نوار پایین موبایل ظاهر نشود.
 */
const ADMIN_NAV = [
  { href: "/admin", label: "داشبورد پلتفرم", icon: LayoutDashboard },
  { href: "/admin/organizations", label: "مدیریت کسب‌وکارها", icon: Building },
  { href: "/admin/users", label: "کاربران پلتفرم", icon: Users },
  { href: "/admin/invoices", label: "فاکتورهای کسب‌وکارها", icon: ReceiptText },
  { href: "/admin/announcements", label: "اعلان‌ها", icon: Bell },
  { href: "/admin/tickets", label: "تیکت‌های پشتیبانی", icon: TicketCheck },
  { href: "/admin/import", label: "ورود داده", icon: FileSpreadsheet },
  // مدیریت ادمین‌ها فقط برای کسی که مجوز admins.manage دارد معنا دارد،
  // ولی خود روت هم بررسی می‌کند — پنهان‌کردن لینک کنترل امنیتی نیست.
  { href: "/admin/usage", label: "آمار مصرف", icon: BarChart3 },
  { href: "/admin/roles", label: "ادمین‌ها و دسترسی‌ها", icon: Shield },
  { href: "/admin/audit", label: "گزارش فعالیت", icon: Activity },
  { href: "/admin/system", label: "وضعیت فنی سرویس", icon: Server },
];

/** کلید ذخیره‌ی حالت جمع‌شده در مرورگر کاربر. */
const RAIL_STORAGE_KEY = "tarazoo-sidebar-rail";

/**
 * ⚠️ این کامپوننت *دو بار* در DOM رندر می‌شود: یک نسخه برای دسکتاپ و
 * یکی برای موبایل (app-shell.tsx). بدون نام متمایز، هر دو یک landmark
 * هم‌نام می‌سازند و axe خطای `landmark-unique` می‌دهد — یعنی کاربر
 * صفحه‌خوان دو «ناوبری اصلی» می‌بیند و نمی‌داند کدام واقعی است.
 * (این ایراد روی *همه‌ی* صفحه‌ها بود، نه فقط یکی.)
 */
export function Sidebar({ open, onClose, variant = "desktop" }: { open: boolean; onClose: () => void; variant?: "desktop" | "mobile" }) {
  const navLabel = variant === "mobile" ? "ناوبری اصلی (موبایل)" : "ناوبری اصلی";
  const pathname = usePathname();
  const { can } = usePermission();
  const { isPlatformAdmin } = usePlatformAdmin();

  /*
    آکاردئون تک‌بازشو.

    پیش از این هر گروه state جدا داشت و شرط `expanded[i] || active` باعث
    می‌شد گروه صفحه‌ی جاری هرگز بسته نشود. نتیجه: تا ۴ گروه هم‌زمان باز
    و ارتفاع محتوا (۱۰۵۴px) بیشتر از فضای موجود (۷۸۲px) — کاربر مجبور
    به اسکرول طولانی می‌شد.

    حالا فقط یک شناسه نگهداری می‌شود؛ باز کردن یک گروه بقیه را می‌بندد.
  */
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  /** حالت باریک فقط-آیکون (دسکتاپ). ترجیح کاربر ذخیره می‌شود. */
  const [rail, setRail] = useState(false);

  useEffect(() => {
    try {
      setRail(window.localStorage.getItem(RAIL_STORAGE_KEY) === "1");
    } catch {
      /* دسترسی به localStorage ممکن است مسدود باشد */
    }
  }, []);

  function toggleRail() {
    setRail((value) => {
      const next = !value;
      try {
        window.localStorage.setItem(RAIL_STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* بی‌اهمیت */
      }
      return next;
    });
  }

  function toggle(key: string) {
    // باز کردن یک گروه، گروه قبلی را می‌بندد؛ کلیک دوباره آن را می‌بندد.
    setOpenGroup((current) => (current === key ? null : key));
  }


  /*
    وقتی کاربر مسیر عوض می‌کند، گروهِ صفحه‌ی جاری خودکار باز می‌شود.
    این با تک‌بازشو بودن تناقض ندارد: فقط همان یک گروه باز می‌ماند.
  */
  const activeGroupKey = useMemo(() => {
    for (const item of NAV) {
      const children = (item as { children?: { href: string }[] }).children;
      if (!children?.length) continue;
      if (children.some((child) => pathname.startsWith(child.href.split("?")[0]))) {
        return (item as { label: string }).label;
      }
    }
    return null;
  }, [pathname]);

  useEffect(() => {
    if (activeGroupKey) setOpenGroup(activeGroupKey);
  }, [activeGroupKey]);

  function permissionForHref(href?: string) {
    if (!href) return null;
    if (href.startsWith("/sales")) return "sales.view";
    if (href.startsWith("/purchases")) return "purchases.view";
    if (href.startsWith("/products")) return href.includes("action=new") ? "products.edit" : "products.view";
    if (href.startsWith("/inventory")) return href.includes("adjust") || href.endsWith("/in") || href.endsWith("/out") ? "inventory.adjust" : "inventory.view";
    if (href.startsWith("/contacts")) return href.includes("new-") ? "contacts.edit" : "contacts.view";
    if (href.startsWith("/crm")) return "contacts.view";
    if (href.startsWith("/loyalty")) return "contacts.view";
    if (href.startsWith("/finance")) return href === "/finance" ? "finance.view" : "finance.create";
    if (href.startsWith("/checks")) return "finance.view";
    if (href.startsWith("/reports") || href.startsWith("/activity")) return "reports.view";
    if (href.startsWith("/settings/price-lists")) return "products.edit";
    if (href.startsWith("/settings")) return "settings.manage";
    /*
      /support عمداً هیچ مجوزی نمی‌خواهد.
      صندوق‌دار هم باید بتواند بگوید «صفحه‌ی فروش باز نمی‌شود» —
      بستن راه پشتیبانی روی نقش‌های پایین یعنی مشکلشان هرگز به ما
      نمی‌رسد.
    */
    return null;
  }

  function itemAllowed(item: any) {
    if (item.children) return item.children.some((child: any) => can(permissionForHref(child.href)));
    return can(permissionForHref(item.href));
  }

  function visibleChildren(item: any) {
    return (item.children ?? []).filter((child: any) => can(permissionForHref(child.href)));
  }

  function isActive(href: string) {
    if (!href) return false;
    return pathname === href || pathname.startsWith(href.split("?")[0] + "/") || pathname.startsWith(href.split("?")[0]);
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-[2px] animate-fade-in lg:hidden" style={{ zIndex: "calc(var(--z-sidebar) - 10)" }} onClick={onClose} aria-hidden />
      )}

      <aside
        aria-label={navLabel}
        data-rail={rail ? "true" : "false"}
        className={cn(
          "fixed lg:sticky top-0 right-0 h-screen bg-card border-l border-border flex flex-col",
          "transition-[transform,width] duration-200 ease-out",
          // موبایل همیشه عرض کامل دارد؛ ریل فقط روی دسکتاپ معنا دارد.
          rail ? "w-[264px] lg:w-[68px]" : "w-[264px]",
          open ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        )}
        style={{ zIndex: "var(--z-sidebar)" }}
      >
        {/* Header */}
        <div className={cn(
          "flex items-center gap-2 border-b border-border p-3",
          rail && "lg:flex-col lg:gap-1.5 lg:px-2"
        )}>
          <Link
            href="/dashboard"
            onClick={onClose}
            aria-label={`${BRAND_NAME} — داشبورد`}
            className={cn("flex min-w-0 flex-1 items-center gap-2", rail && "lg:flex-none")}
          >
            <img
              src="/logo.png"
              alt={BRAND_NAME}
              className="h-9 w-9 shrink-0 rounded-xl border border-border bg-card object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }}
            />
            <span className={cn("min-w-0 leading-tight", rail && "lg:hidden")}>
              <span className="block truncate text-sm font-bold text-foreground">{BRAND_NAME}</span>
              <span className="block truncate text-2xs text-muted-foreground">سیستم مدیریت فروش</span>
            </span>
          </Link>

          {/* جمع/باز کردن ریل — فقط دسکتاپ */}
          <button
            type="button"
            onClick={toggleRail}
            aria-label={rail ? "باز کردن منو" : "جمع کردن منو"}
            title={rail ? "باز کردن منو" : "جمع کردن منو"}
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground lg:inline-flex"
          >
            {rail ? <PanelRightOpen size={17} /> : <PanelRightClose size={17} />}
          </button>

          {/* بستن کشو — فقط موبایل */}
          <button
            onClick={onClose}
            aria-label="بستن منو"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav aria-label={`فهرست بخش‌ها — ${navLabel}`} className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {NAV.filter(itemAllowed).map((item, i) => {
            const Icon = item.icon;
            const active = isActive(item.href ?? "");
            const children = visibleChildren(item);
            const hasChildren = children.length > 0;

            // Special style for highlighted items (like Sales)
            const isHighlight = (item as any).highlight;

            if (!hasChildren) {
              return (
                <Link
                  key={item.href}
                  href={item.href ?? "#"}
                  onClick={onClose}
                  aria-current={active ? "page" : undefined}
                  title={rail ? item.label : undefined}
                  className={cn(
                    "relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all",
                    rail && "lg:justify-center lg:px-0",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : isHighlight
                      ? "bg-success-soft text-success-onSoft hover:bg-success-soft"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon size={18} className="shrink-0" />
                  <span className={cn("truncate", rail && "lg:hidden")}>{item.label}</span>
                </Link>
              );
            }

            const groupKey = item.label;
            const isExpanded = openGroup === groupKey;
            const panelId = `nav-group-${i}`;

            /*
              در حالت ریل، زیرمنو جایی برای نمایش ندارد.
              کلیک روی گروه ابتدا ریل را باز می‌کند تا کاربر گم نشود.
            */
            function handleGroupClick() {
              if (rail) {
                toggleRail();
                setOpenGroup(groupKey);
                return;
              }
              toggle(groupKey);
            }

            return (
              <div key={groupKey}>
                <button
                  type="button"
                  onClick={handleGroupClick}
                  aria-expanded={isExpanded}
                  aria-controls={panelId}
                  title={rail ? item.label : undefined}
                  className={cn(
                    "flex w-full min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                    rail && "lg:justify-center lg:px-0",
                    active || isExpanded
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon size={18} className="shrink-0" />
                  <span className={cn("flex-1 truncate text-right", rail && "lg:hidden")}>{item.label}</span>
                  <ChevronDown
                    size={14}
                    aria-hidden
                    className={cn(
                      "shrink-0 transition-transform duration-200",
                      rail && "lg:hidden",
                      isExpanded && "rotate-180"
                    )}
                  />
                </button>

                {/*
                  انیمیشن باز/بسته با grid-template-rows انجام می‌شود
                  چون ارتفاع محتوا از قبل معلوم نیست و height:auto
                  قابل ترنزیشن نیست.
                */}
                <div
                  id={panelId}
                  className={cn(
                    "grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none",
                    isExpanded && !rail ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                    rail && "lg:hidden"
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="mr-3 mt-1 space-y-0.5 border-r-2 border-border pr-2">
                      {children.map((child: { href: string; label: string; icon: React.ElementType }) => {
                        const childActive = isActive(child.href);
                        const ChildIcon = child.icon;
                        return (
                          <Link
                            key={child.href + child.label}
                            href={child.href}
                            onClick={onClose}
                            tabIndex={isExpanded && !rail ? undefined : -1}
                            aria-current={childActive ? "page" : undefined}
                            className={cn(
                              "flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-sm transition-colors lg:min-h-10",
                              childActive
                                ? "bg-primary/10 font-bold text-primary"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                          >
                            <ChildIcon size={14} className="shrink-0" />
                            <span className="truncate">{child.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/*
            بخش سوپرادمین.

            فقط وقتی is_platform_admin برابر true باشد رندر می‌شود. برای
            کاربر عادی هیچ ردی در DOM نمی‌ماند، پس وجود این بخش را هم
            حدس نمی‌زند.

            جداکننده‌ی بصری دارد چون این مسیر از جنس «مدیریت پلتفرم» است
            نه «کار روزمره‌ی کسب‌وکار»؛ قاطی‌شدنشان گیج‌کننده بود.
          */}
          {isPlatformAdmin && (
            <div className="pt-2">
              <div
                className={cn(
                  "mb-1 border-t border-border pt-2.5",
                  rail && "lg:mx-1"
                )}
              >
                <div
                  className={cn(
                    "flex items-center gap-1.5 px-3 pb-1 text-2xs font-extrabold uppercase tracking-wide text-muted-foreground",
                    rail && "lg:hidden"
                  )}
                >
                  <ShieldCheck size={12} aria-hidden />
                  مدیریت پلتفرم
                </div>
              </div>

              {ADMIN_NAV.map((item) => {
                const Icon = item.icon;
                /*
                  «/admin» پیشوند همه‌ی مسیرهای ادمین است، پس isActive
                  عمومی آن را در همه‌ی صفحه‌ها فعال نشان می‌داد.
                  برای داشبورد تطبیق دقیق لازم است.
                */
                const active =
                  item.href === "/admin"
                    ? pathname === "/admin"
                    : isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    aria-current={active ? "page" : undefined}
                    title={rail ? item.label : undefined}
                    className={cn(
                      "relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all",
                      rail && "lg:justify-center lg:px-0",
                      active
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon size={18} className="shrink-0" />
                    <span className={cn("truncate", rail && "lg:hidden")}>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="border-t border-border p-3">
          <div className={cn("text-center text-xs text-muted-foreground", rail && "lg:hidden")}>
            {BRAND_NAME} — نسخه {toFaDigits(BRAND_VERSION)}
            {/* هش بیلد برای پشتیبانی؛ با انتخاب متن قابل کپی است. */}
            {/*
              ⚠️ opacity استفاده نمی‌شود: توکن متن از قبل دقیقاً روی
              آستانه‌ی WCAG کالیبره شده و شفافیت آن را زیر ۴.۵
              می‌آورد (همان اشتباهی که در شمارنده‌ی تست هم رخ داد).
            */}
            <span className="mt-0.5 block select-all text-2xs text-muted-foreground" dir="ltr">
              {BRAND_BUILD_SHA}
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
