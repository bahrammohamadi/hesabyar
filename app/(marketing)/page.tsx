import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  MarketingCta,
  MarketingFeatures,
  MarketingFooter,
  MarketingHeader,
  MarketingHero,
  MarketingPricing,
  MarketingShell,
} from "./components/MarketingPieces";
import { getMarketingPlans } from "./plans";

export const metadata: Metadata = {
  title: "حساب‌یار | مدیریت هوشمند فروش و انبارداری",
  description:
    "حساب‌یار به شما کمک می‌کند فاکتورها را سریع صادر کنید، موجودی انبار را در لحظه چک کنید و با گزارش‌های دقیق سود و زیان تصمیم بگیرید.",
};

/**
 * صفحه‌ی معرفی عمومی (لندینگ).
 *
 * سرور-کامپوننت است تا کاربر واردشده پیش از رندر به داشبورد هدایت شود.
 * مسیرهای /login و /register و /setup دست‌نخورده باقی مانده‌اند.
 */
export default async function MarketingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  // پلن‌ها از دیتابیس؛ در صورت خطا به داده‌ی پشتیبان برمی‌گردد.
  const plans = await getMarketingPlans();

  return (
    <MarketingShell>
      <MarketingHeader />
      <main>
        <MarketingHero />
        <MarketingFeatures />
        <MarketingPricing plans={plans} />
        <MarketingCta />
      </main>
      <MarketingFooter />
    </MarketingShell>
  );
}
