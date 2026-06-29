import { getEntityHref, canNavigateToEntity } from "./routes";
import type { EntityAction, EntityType } from "./types";

function cleanPhone(phone?: string | null) {
  if (!phone) return null;
  const normalized = phone.trim().replace(/[^\d+]/g, "");
  return normalized || null;
}

export function getDefaultEntityActions({
  type,
  id,
  phone,
  allowUnimplementedRoutes = false,
}: {
  type: EntityType;
  id?: string | null;
  phone?: string | null;
  allowUnimplementedRoutes?: boolean;
}): EntityAction[] {
  const actions: EntityAction[] = [];
  const href = getEntityHref(type, id);

  if ((type === "contact" || type === "product") && id) {
    actions.push({ id: "quick-view", label: "نمای سریع", tone: "primary", requiredPermission: type === "contact" ? "contacts.view" : "products.view" });
  }

  if (href && canNavigateToEntity(type, id, allowUnimplementedRoutes)) {
    const readPermission = type === "contact" ? "contacts.view" : type === "product" ? "products.view" : type === "sale" ? "sales.view" : type === "purchase" ? "purchases.view" : undefined;
    actions.push({ id: "view", label: "مشاهده جزئیات", href, tone: "primary", requiredPermission: readPermission });
  }

  if (type === "contact" && id) {
    actions.push({ id: "edit", label: "ویرایش شخص", href: `/contacts/${id}?action=edit`, requiredPermission: "contacts.edit" });
    const tel = cleanPhone(phone);
    if (tel) actions.push({ id: "call", label: "تماس", href: `tel:${tel}`, external: true, tone: "success", requiredPermission: "contacts.call" });
    actions.push({ id: "interaction", label: "ثبت تعامل", href: `/contacts/${id}?action=interaction`, requiredPermission: "crm.create" });
    actions.push({ id: "new-sale", label: "فروش جدید", href: `/sales?contact=${id}`, requiredPermission: "sales.create" });
    actions.push({ id: "payment", label: "ثبت دریافت/پرداخت", href: `/contacts/${id}?action=payment`, requiredPermission: "finance.create" });
    actions.push({ id: "new-purchase", label: "خرید جدید", href: `/purchases?contact=${id}`, requiredPermission: "purchases.create" });
  }

  if (type === "product" && id) {
    actions.push({ id: "edit", label: "ویرایش کالا", href: `/products/${id}?action=edit`, requiredPermission: "products.edit" });
    actions.push({ id: "adjust-stock", label: "تعدیل موجودی", href: `/inventory?type=adjust&product=${id}`, requiredPermission: "inventory.adjust" });
    actions.push({ id: "price-change", label: "تغییر قیمت", href: `/products/${id}?action=price`, requiredPermission: "products.update_price" });
    actions.push({ id: "stock-history", label: "گردش موجودی", href: `/products/${id}?tab=movements`, requiredPermission: "inventory.view" });
  }

  if (type === "sale" && id) {
    actions.push({ id: "print", label: "مشاهده/چاپ", href: `/sales/${id}`, requiredPermission: "sales.view" });
  }

  return actions;
}
