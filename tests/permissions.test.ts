import { describe, expect, it } from "vitest";
import { normalizePermission, roleHasPermission } from "../lib/permissions";

describe("permissions", () => {
  it("owner has all permissions", () => {
    expect(roleHasPermission("owner", "settings.manage")).toBe(true);
    expect(roleHasPermission("owner", "products.update_price")).toBe(true);
  });

  it("cashier cannot manage settings", () => {
    expect(roleHasPermission("cashier", "settings.manage")).toBe(false);
  });

  it("inventory role can adjust inventory", () => {
    expect(roleHasPermission("inventory", "inventory.adjust")).toBe(true);
  });

  it("normalizes legacy colon permissions", () => {
    expect(normalizePermission("sales:create")).toBe("sales.create");
    expect(normalizePermission("products:update-price")).toBe("products.update_price");
  });
});
