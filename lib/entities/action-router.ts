export type EntityActionParam =
  | "view"
  | "quick-view"
  | "edit"
  | "payment"
  | "receipt"
  | "pay"
  | "interaction"
  | "new-sale"
  | "new-purchase"
  | "price"
  | "adjust-stock"
  | "movements"
  | "stock-history";

export function getActionParam(searchParams: URLSearchParams | ReadonlyURLSearchParamsLike): EntityActionParam | null {
  const action = searchParams.get("action") as EntityActionParam | null;
  return action || null;
}

export function getParam(searchParams: URLSearchParams | ReadonlyURLSearchParamsLike, key: string) {
  const value = searchParams.get(key);
  return value && value.trim() ? value : null;
}

export interface ReadonlyURLSearchParamsLike {
  get(name: string): string | null;
}
