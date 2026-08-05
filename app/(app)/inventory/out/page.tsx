import { InventoryOperationPage } from "@/components/shared/inventory-operation-page";

/*
  🔴 این فایل گم بود.

  سایدبار به /inventory/out لینک می‌داد («خروج کالا») ولی پوشه‌اش وجود
  نداشت — یعنی هر کاربری که روی آن کلیک می‌کرد صفحه‌ی ۴۰۴ می‌گرفت.
  خودِ کامپوننت از mode="out" پشتیبانی می‌کرد و فقط همین دو خط کم بود.

  با بازرسی خودکار همه‌ی صفحات پیدا شد: پیش‌واکشی Next.js لینک را
  می‌گرفت و در هر صفحه‌ای که سایدبار باز بود، یک 404 در کنسول ثبت
  می‌شد — علامتی که کسی متوجهش نشده بود.
*/
export default function Page() {
  return <InventoryOperationPage mode="out" />;
}
