import type { Metadata } from "next";
import {
  MarketingCta,
  MarketingFeatures,
  MarketingHero,
  MarketingPricing,
} from "./components/MarketingPieces";
import { HomeExtras } from "./components/HomeExtras";
import { getMarketingPlans } from "./plans";
import { BRAND_TITLE, BRAND_DESCRIPTION } from "@/lib/brand";

export const metadata: Metadata = {
  title: BRAND_TITLE,
  description: BRAND_DESCRIPTION,
};

/**
 * صفحه‌ی اصلی وب‌سایت معرفی.
 *
 * هدر و فوتر از layout می‌آیند. کاربر واردشده دیگر ریدایرکت نمی‌شود —
 * هدر برایش دکمه‌ی «ورود به پنل» نشان می‌دهد.
 */
export default async function HomePage() {
  // پلن‌ها از دیتابیس؛ در صورت خطا به داده‌ی پشتیبان برمی‌گردد.
  const plans = await getMarketingPlans();

  return (
    <>
      <MarketingHero />
      <MarketingFeatures />
      <HomeExtras />
      <MarketingPricing plans={plans} />
      <MarketingCta />
    </>
  );
}
