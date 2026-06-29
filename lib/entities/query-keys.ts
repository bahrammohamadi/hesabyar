import type { EntityType } from "./types";

export const entityQueryKeys = {
  contactSummary: (contactId?: string | null) => ["entity", "contact", "summary", contactId] as const,
  productSummary: (productId?: string | null) => ["entity", "product", "summary", productId] as const,
  timeline: (type: EntityType, id?: string | null) => ["entity", type, "timeline", id] as const,
};
