import type { EntityType } from "./types";

export const ENTITY_ROUTE_PATTERNS: Record<EntityType, string> = {
  contact: "/contacts/[id]",
  product: "/products/[id]",
  sale: "/sales/[id]",
  purchase: "/purchases/[id]",
  transaction: "/finance?transaction=[id]",
  stockMovement: "/inventory?movement=[id]",
};

/**
 * Only these detail routes exist in the current App Router tree.
 * Route patterns for the other entities are kept as a contract, but links to
 * unimplemented detail pages should be disabled unless explicitly allowed.
 */
export const IMPLEMENTED_ENTITY_ROUTES: Record<EntityType, boolean> = {
  contact: true,
  product: true,
  sale: true,
  purchase: true,
  transaction: false,
  stockMovement: false,
};

export function getEntityHref(type: EntityType, id?: string | null) {
  if (!id) return null;

  switch (type) {
    case "contact":
      return `/contacts/${id}`;
    case "product":
      return `/products/${id}`;
    case "sale":
      return `/sales/${id}`;
    case "purchase":
      return `/purchases/${id}`;
    case "transaction":
      return `/finance?transaction=${id}`;
    case "stockMovement":
      return `/inventory?movement=${id}`;
    default:
      return null;
  }
}

export function canNavigateToEntity(type: EntityType, id?: string | null, allowUnimplemented = false) {
  return Boolean(id && (allowUnimplemented || IMPLEMENTED_ENTITY_ROUTES[type]));
}
