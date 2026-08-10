/**
 * منطق خالص «کاربران و دسترسی‌ها».
 *
 * در `.ts` جداست چون Vitest نمی‌تواند JSX را از `.tsx` بخواند و این
 * توابع (به‌خصوص نگاشت نقش → مجوز) دقیقاً همان چیزی‌اند که باید
 * تست شوند.
 */

import { uniquePermissions } from "@/lib/access/permission-tree";

export type ManagedUser = {
  id: string;
  user_id: string;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  permissions: string[] | null;
};

export const ROLE_LABELS: Record<string, string> = {
  owner: "مدیر کل",
  manager: "مدیر",
  cashier: "فروشنده",
  inventory: "انباردار",
  accountant: "حسابدار",
};

/**
 * مجوزهای پیش‌فرض هر نقش.
 *
 * ⚠️ این فهرست باید با تابع `has_permission` در دیتابیس
 * (مهاجرت ۰۰۰۶) هم‌راستا بماند. اینجا فقط پیشنهادِ اولیه‌ی UI است؛
 * حرف آخر را همیشه RLS می‌زند. اگر این دو از هم جدا بیفتند،
 * کاربر تیکِ سبز می‌بیند ولی عمل واقعی رد می‌شود — بدترین حالت
 * ممکن، چون کاربر فکر می‌کند دسترسی دارد.
 */
export function defaultPermissions(role: string): string[] {
  if (role === "owner") return ["*"];
  if (role === "manager") return uniquePermissions();
  if (role === "cashier")
    return [
      "contacts.view", "contacts.call", "sales.view", "sales.create",
      "products.view", "finance.create",
    ];
  if (role === "inventory")
    return ["products.view", "products.edit", "inventory.view", "inventory.adjust"];
  if (role === "accountant")
    return [
      "contacts.view", "sales.view", "purchases.view",
      "finance.view", "finance.create", "reports.view",
    ];
  return [];
}

/** آیا مجموعه‌ی مجوزها همه‌ی موارد لازم را دارد؟ `*` یعنی همه‌چیز. */
export function hasAll(perms: string[], required: string[]): boolean {
  return (
    required.length === 0 ||
    required.every((permission) => perms.includes("*") || perms.includes(permission))
  );
}

/**
 * افزودن یا برداشتن مجموعه‌ای از مجوزها.
 *
 * `*` عمداً حذف می‌شود: به‌محض اینکه کاربر دستی چیزی را تیک بزند یا
 * بردارد، دیگر «همه‌چیز» نیست و باید به فهرست صریح تبدیل شود.
 * بدون این، برداشتن یک تیک از حالت `*` هیچ اثری نداشت.
 */
export function togglePermissions(
  current: string[],
  permissions: string[],
  checked: boolean
): string[] {
  const next = new Set(current.filter((permission) => permission !== "*"));
  permissions.forEach((permission) => (checked ? next.add(permission) : next.delete(permission)));
  return Array.from(next);
}
