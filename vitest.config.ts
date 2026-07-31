import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * تا پیش از این فایل، vitest بدون تنظیمات اجرا می‌شد و alias مسیر `@/`
 * را نمی‌شناخت؛ برای همین هر تستی که ماژولی با import مطلق داشت شکست می‌خورد.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
