import type { Role } from "@/types/db";

export type Permission =
  | "*"
  | "contacts.view"
  | "contacts.edit"
  | "contacts.call"
  | "crm.create"
  | "sales.view"
  | "sales.create"
  | "purchases.view"
  | "purchases.create"
  | "products.view"
  | "products.edit"
  | "products.update_price"
  | "inventory.view"
  | "inventory.adjust"
  | "finance.view"
  | "finance.create"
  | "reports.view"
  | "settings.manage";

type AppRole = Role | "warehouse" | null | undefined;

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  owner: ["*"],
  manager: [
    "contacts.view",
    "contacts.edit",
    "contacts.call",
    "crm.create",
    "sales.view",
    "sales.create",
    "purchases.view",
    "purchases.create",
    "products.view",
    "products.edit",
    "products.update_price",
    "inventory.view",
    "inventory.adjust",
    "finance.view",
    "finance.create",
    "reports.view",
  ],
  cashier: ["contacts.view", "contacts.call", "sales.view", "sales.create", "products.view", "finance.create"],
  inventory: ["products.view", "products.edit", "inventory.view", "inventory.adjust"],
  warehouse: ["products.view", "products.edit", "inventory.view", "inventory.adjust"],
  accountant: ["contacts.view", "sales.view", "purchases.view", "finance.view", "finance.create", "reports.view"],
};

const ALIASES: Record<string, Permission> = {
  "contact:read": "contacts.view",
  "contact:edit": "contacts.edit",
  "contact:update": "contacts.edit",
  "contacts:update": "contacts.edit",
  "contacts:call": "contacts.call",
  "crm:create": "crm.create",
  "product:read": "products.view",
  "product:edit": "products.edit",
  "products:update": "products.edit",
  "products:update-price": "products.update_price",
  "sales:read": "sales.view",
  "sales:create": "sales.create",
  "purchases:read": "purchases.view",
  "purchases:create": "purchases.create",
  "inventory:read": "inventory.view",
  "inventory:adjust": "inventory.adjust",
  "finance:read": "finance.view",
  "finance:create": "finance.create",
  "settings:manage": "settings.manage",
};

export function normalizePermission(permission?: string | null): Permission | null {
  if (!permission) return null;
  if (permission === "*") return "*";
  return (ALIASES[permission] ?? permission.replace(":", ".")) as Permission;
}

export function roleHasPermission(role: AppRole, permission?: string | null) {
  const normalized = normalizePermission(permission);
  if (!normalized) return true;
  const grants = ROLE_PERMISSIONS[role ?? ""] ?? [];
  return grants.includes("*") || grants.includes(normalized);
}

export function getRolePermissions(role: AppRole) {
  return ROLE_PERMISSIONS[role ?? ""] ?? [];
}
