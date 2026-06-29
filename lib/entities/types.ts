export type EntityType = "contact" | "product" | "sale" | "purchase" | "transaction" | "stockMovement";

export interface EntityRef {
  type: EntityType;
  id?: string | null;
  label?: string | null;
}

export interface EntityAction {
  id: string;
  label: string;
  href?: string;
  external?: boolean;
  disabled?: boolean;
  tone?: "default" | "primary" | "success" | "danger";
  requiredPermission?: string;
}
