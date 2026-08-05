import type { Permission } from "@/lib/permissions";

export type PermissionTreeItem = {
  key: string;
  label: string;
  href?: string;
  permissions: Permission[];
  warning?: string;
  recommendedWith?: Permission[];
  children?: PermissionTreeItem[];
};

export const PERMISSION_TREE: PermissionTreeItem[] = [
  { key: "dashboard", label: "داشبورد", href: "/dashboard", permissions: [], children: [{ key: "dashboard.view", label: "نمایش داشبورد", href: "/dashboard", permissions: [] }] },
  { key: "sales", label: "فروش", permissions: ["sales.view", "sales.create"], recommendedWith: ["contacts.view", "products.view"], children: [
    { key: "sales.pos", label: "فاکتورهای فروش / POS", href: "/sales", permissions: ["sales.view", "sales.create"], recommendedWith: ["contacts.view", "products.view"] },
    { key: "sales.orders", label: "سفارش فروش", href: "/sales/orders", permissions: ["sales.view"] },
    { key: "sales.returns", label: "مرجوعی فروش", href: "/sales/returns", permissions: ["sales.view", "sales.create"], warning: "مرجوعی فروش روی موجودی و حساب مشتری اثر دارد." },
  ] },
  { key: "purchases", label: "خرید", permissions: ["purchases.view", "purchases.create"], recommendedWith: ["contacts.view", "products.view", "inventory.view"], children: [
    { key: "purchases.list", label: "فاکتورهای خرید", href: "/purchases", permissions: ["purchases.view", "purchases.create"], recommendedWith: ["contacts.view", "products.view"] },
    { key: "purchases.returns", label: "مرجوعی خرید", href: "/purchases/returns", permissions: ["purchases.view", "purchases.create"], warning: "مرجوعی خرید روی موجودی کالا اثر دارد." },
  ] },
  { key: "contacts", label: "اشخاص", permissions: ["contacts.view", "contacts.edit", "contacts.call", "crm.create"], children: [
    { key: "contacts.all", label: "همه اشخاص", href: "/contacts", permissions: ["contacts.view"] },
    { key: "contacts.customers", label: "مشتریان", href: "/contacts/customers", permissions: ["contacts.view"] },
    { key: "contacts.suppliers", label: "تأمین‌کنندگان", href: "/contacts/suppliers", permissions: ["contacts.view"] },
    { key: "contacts.debtors", label: "بدهکاران / بستانکاران", href: "/contacts/debtors", permissions: ["contacts.view", "finance.view"], warning: "این بخش مانده حساب اشخاص را نمایش می‌دهد." },
    { key: "contacts.edit", label: "ثبت و ویرایش شخص", permissions: ["contacts.edit"], warning: "با این دسترسی کاربر می‌تواند اطلاعات مشتری/تأمین‌کننده را تغییر دهد." },
  ] },
  { key: "inventory-products", label: "کالا و انبار", permissions: ["products.view", "products.edit", "products.update_price", "inventory.view", "inventory.adjust"], children: [
    { key: "products.list", label: "کالاها", href: "/products", permissions: ["products.view"] },
    { key: "inventory.movements", label: "گردش انبار", href: "/inventory/movements", permissions: ["inventory.view"] },
    { key: "inventory.stock-card", label: "کاردکس کالا", href: "/inventory/stock-card", permissions: ["inventory.view"] },
    { key: "inventory.as-of", label: "موجودی به تاریخ", href: "/inventory/as-of", permissions: ["inventory.view"] },
    { key: "inventory.in", label: "ورود کالا", href: "/inventory/in", permissions: ["inventory.adjust"], warning: "ورود کالا موجودی را تغییر می‌دهد." },
    { key: "inventory.out", label: "خروج کالا", href: "/inventory/out", permissions: ["inventory.adjust"], warning: "خروج کالا موجودی را کاهش می‌دهد." },
    { key: "inventory.adjust", label: "انبارگردانی", href: "/inventory/adjust", permissions: ["inventory.adjust"], warning: "انبارگردانی دسترسی حساسی است؛ موجودی را مستقیم تغییر می‌دهد." },
    { key: "inventory.waste", label: "ضایعات", href: "/inventory/waste", permissions: ["inventory.adjust"], warning: "ثبت ضایعات موجودی را کاهش می‌دهد." },
    { key: "products.edit", label: "ثبت/ویرایش کالا", permissions: ["products.edit"] },
    { key: "products.price", label: "تغییر قیمت کالا", permissions: ["products.update_price"], warning: "تغییر قیمت روی فروش و سود اثر مستقیم دارد." },
  ] },
  { key: "finance", label: "مالی", permissions: ["finance.view", "finance.create"], warning: "دسترسی مالی حساس است و می‌تواند دریافت/پرداخت/هزینه ثبت کند.", children: [
    { key: "finance.list", label: "تراکنش‌ها", href: "/finance", permissions: ["finance.view"] },
    { key: "finance.receipts", label: "دریافت", href: "/finance/receipts", permissions: ["finance.create"], recommendedWith: ["contacts.view"] },
    { key: "finance.payments", label: "پرداخت", href: "/finance/payments", permissions: ["finance.create"], recommendedWith: ["contacts.view"] },
    { key: "finance.expenses", label: "هزینه", href: "/finance/expenses", permissions: ["finance.create"] },
    { key: "finance.income", label: "درآمد", href: "/finance/income", permissions: ["finance.create"] },
    { key: "finance.transfers", label: "انتقال وجه", href: "/finance/transfers", permissions: ["finance.create"], warning: "انتقال وجه بین حساب‌ها ثبت مالی حساس است." },
    { key: "finance.checks", label: "چک‌ها", href: "/checks", permissions: ["finance.view"] },
  ] },
  { key: "loyalty-crm", label: "باشگاه مشتریان", permissions: ["contacts.view", "crm.create", "reports.view"], warning: "این بخش به اطلاعات تماس مشتریان و سگمنت‌های بازاریابی دسترسی می‌دهد.", children: [
    { key: "loyalty.overview", label: "نمای کلی", href: "/loyalty", permissions: ["contacts.view"] },
    { key: "loyalty.segments", label: "سگمنت‌ها", href: "/crm/segments", permissions: ["contacts.view", "reports.view"] },
    { key: "loyalty.points", label: "امتیاز و کیف‌پول", href: "/loyalty/points", permissions: ["contacts.view", "finance.view"] },
    { key: "loyalty.campaigns", label: "کمپین‌ها", href: "/loyalty/campaigns", permissions: ["contacts.view", "crm.create"] },
  ] },
  { key: "reports", label: "گزارش‌ها", permissions: ["reports.view"], warning: "گزارش‌ها ممکن است سود، فروش و عملکرد کاربران را نمایش دهند.", children: [
    { key: "reports.overview", label: "نمای کلی گزارش‌ها", href: "/reports/overview-v2", permissions: ["reports.view"] },
    { key: "reports.sellers", label: "عملکرد فروشندگان", href: "/reports/sellers", permissions: ["reports.view"] },
    { key: "reports.profitability", label: "سود کالا/فاکتور", href: "/reports/profitability", permissions: ["reports.view"], warning: "این گزارش سود و بهای تمام‌شده را نشان می‌دهد." },
    { key: "reports.customer-profitability", label: "مشتریان سودآور", href: "/reports/customer-profitability", permissions: ["reports.view"] },
    { key: "reports.activity", label: "فعالیت کاربران", href: "/activity", permissions: ["reports.view"] },
  ] },
  { key: "settings", label: "تنظیمات", permissions: ["settings.manage"], warning: "این دسترسی بسیار حساس است؛ کاربر می‌تواند کاربران و تنظیمات را مدیریت کند.", children: [
    { key: "settings.dashboard", label: "داشبورد تنظیمات", href: "/settings", permissions: ["settings.manage"] },
    { key: "settings.users", label: "کاربران و دسترسی‌ها", href: "/settings/users", permissions: ["settings.manage"], warning: "مدیریت کاربران و سطح دسترسی‌ها." },
    { key: "settings.accounts", label: "مالی و حساب‌ها", href: "/settings/accounts", permissions: ["settings.manage"] },
    { key: "settings.catalog", label: "کاتالوگ", href: "/settings/catalog", permissions: ["settings.manage"] },
    { key: "settings.price-lists", label: "لیست قیمت‌ها", href: "/settings/price-lists", permissions: ["products.update_price"] },
  ] },
];

export function uniquePermissions(items = PERMISSION_TREE): Permission[] {
  return Array.from(new Set(items.flatMap((item) => [...item.permissions, ...(item.children ? uniquePermissions(item.children) : [])])));
}
