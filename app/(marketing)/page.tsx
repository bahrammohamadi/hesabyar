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
import { BRAND_TITLE, BRAND_DESCRIPTION } from "@/lib/brand";

export const metadata: Metadata = {
  title: BRAND_TITLE,
  description: BRAND_DESCRIPTION,
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
