import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import {
  Clock, Instagram, MapPin, Package, Phone, Receipt, Send, Store,
} from "lucide-react";
import { BRAND_NAME } from "@/lib/brand";
import { formatToman, toFaDigits } from "@/lib/utils/format";
import { STOREFRONT_PRODUCT_LIMIT } from "@/lib/storefront";

/**
 * صفحه‌ی عمومی فروشگاه — /shop/<slug>
 *
 * کاربر لینکش را در بیوی اینستاگرام می‌گذارد و مشتری بدون ورود،
 * آدرس و ساعت کاری و چند کالا را می‌بیند.
 *
 * 🔴 چرا کاملاً سمت سرور رندر می‌شود؟
 *   اگر کلاینت مستقیم به Supabase وصل می‌شد، کلید anon در مرورگر
 *   قرار می‌گرفت و هر بازدیدکننده می‌توانست کوئری دلخواه بزند.
 *   امنیت آنگاه فقط به درستی RLS بند بود. اینجا مرورگر هیچ کلیدی
 *   نمی‌بیند و فقط HTML آماده می‌گیرد.
 *
 *   داده هم از دو تابع `security definer` با ستون‌های صریح می‌آید
 *   (مهاجرت ۰۰۴۱)، نه از جدول‌ها. قیمت خرید و موجودی عددی حتی اگر
 *   اینجا اشتباهی بخواهیم، در دسترس نیست.
 */

export const revalidate = 300;

type Storefront = {
  org_id: string;
  title: string;
  tagline: string | null;
  about: string | null;
  address: string | null;
  phone: string | null;
  instagram: string | null;
  telegram: string | null;
  whatsapp: string | null;
  hours: string | null;
  show_prices: boolean;
  org_name: string;
  logo_url: string | null;
};

type ShopProduct = {
  product_id: string;
  name: string;
  category: string | null;
  image_url: string | null;
  price: number | null;
  in_stock: boolean;
};

/**
 * کلاینت سرویس فقط برای خواندن دو تابع عمومی.
 *
 * ⚠️ کلید سرویس هرگز به کلاینت نمی‌رود — این فایل سرور-کامپوننت است.
 * توابع فراخوانی‌شده خودشان محدودند، پس حتی با این کلید چیزی بیش از
 * داده‌ی عمومی برنمی‌گردد.
 */
function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createServiceClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function loadStorefront(slug: string): Promise<Storefront | null> {
  const { data } = await serviceClient().rpc("get_public_storefront", { p_slug: slug });
  const rows = (data ?? []) as Storefront[];
  return rows[0] ?? null;
}

export async function generateMetadata(
  { params }: { params: { slug: string } }
): Promise<Metadata> {
  const shop = await loadStorefront(params.slug);
  if (!shop) return { title: "فروشگاه یافت نشد" };

  const description =
    shop.tagline ?? shop.about ?? `${shop.title} — اطلاعات تماس، آدرس و محصولات`;

  return {
    title: `${shop.title} | ${BRAND_NAME}`,
    description,
    // اشتراک در اینستاگرام و تلگرام کارت پیش‌نمایش می‌سازد.
    openGraph: { title: shop.title, description, type: "website" },
    robots: { index: true, follow: true },
  };
}

export default async function ShopPage({ params }: { params: { slug: string } }) {
  const shop = await loadStorefront(params.slug);

  /*
    ۴۰۴ برای فروشگاه منتشرنشده هم درست است: نباید فرق «وجود ندارد» با
    «هست ولی خصوصی است» را لو بدهیم، وگرنه می‌شود با حدس‌زدن نشانی
    فهمید چه کسی مشتری ماست.
  */
  if (!shop) notFound();

  const { data: productData } = await serviceClient().rpc("get_public_storefront_products", {
    p_slug: params.slug,
    p_limit: STOREFRONT_PRODUCT_LIMIT,
  });
  const products = (productData ?? []) as ShopProduct[];

  const contactItems = [
    shop.address && { icon: MapPin, label: "نشانی", value: shop.address },
    shop.hours && { icon: Clock, label: "ساعت کاری", value: shop.hours },
  ].filter(Boolean) as { icon: React.ElementType; label: string; value: string }[];

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* ── سربرگ فروشگاه ── */}
      <header className="border-b border-border bg-muted/30">
        <div className="mx-auto max-w-4xl px-4 py-10 text-center sm:px-6 sm:py-14">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Store size={28} aria-hidden />
          </div>
          <h1 className="text-2xl font-black leading-[1.7] text-foreground sm:text-3xl">
            {shop.title}
          </h1>
          {shop.tagline && (
            <p className="mx-auto mt-2 max-w-xl text-sm leading-8 text-muted-foreground">
              {shop.tagline}
            </p>
          )}

          {/* دکمه‌های تماس — بزرگ‌ترین دلیل وجود این صفحه */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {shop.phone && (
              <a
                href={`tel:${shop.phone}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
              >
                <Phone size={16} aria-hidden />
                تماس
              </a>
            )}
            {shop.whatsapp && (
              <a
                href={`https://wa.me/${shop.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-bold text-foreground transition hover:border-primary/40"
              >
                <Send size={16} aria-hidden />
                واتس‌اپ
              </a>
            )}
            {shop.instagram && (
              <a
                href={`https://instagram.com/${shop.instagram}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-bold text-foreground transition hover:border-primary/40"
              >
                <Instagram size={16} aria-hidden />
                اینستاگرام
              </a>
            )}
            {shop.telegram && (
              <a
                href={`https://t.me/${shop.telegram}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-bold text-foreground transition hover:border-primary/40"
              >
                <Send size={16} aria-hidden />
                تلگرام
              </a>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        {shop.about && (
          <section className="mb-8">
            <h2 className="mb-2 text-sm font-extrabold text-foreground">درباره‌ی ما</h2>
            <p className="whitespace-pre-line text-sm leading-8 text-muted-foreground">
              {shop.about}
            </p>
          </section>
        )}

        {contactItems.length > 0 && (
          <section className="mb-8 grid gap-3 sm:grid-cols-2">
            {contactItems.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4"
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <Icon size={17} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <div className="text-2xs text-muted-foreground">{item.label}</div>
                    <div className="mt-0.5 text-sm font-bold leading-7 text-foreground">
                      {item.value}
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* ── ویترین کالا ── */}
        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-extrabold text-foreground">محصولات</h2>
            {products.length > 0 && (
              <span className="text-2xs text-muted-foreground">
                {toFaDigits(products.length)} کالا
              </span>
            )}
          </div>

          {products.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border py-12 text-center">
              <Package size={26} className="mx-auto mb-2 text-muted-foreground/40" aria-hidden />
              <p className="text-sm text-muted-foreground">
                هنوز محصولی برای نمایش ثبت نشده است.
              </p>
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <li
                  key={product.product_id}
                  className="flex flex-col rounded-2xl border border-border bg-card p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="min-w-0 text-sm font-bold leading-7 text-foreground">
                      {product.name}
                    </h3>
                    {/*
                      موجودی به‌صورت بله/خیر، نه عدد.
                      مشتری باید بداند «هست یا نیست»؛ اینکه «۳ تا
                      مانده» اطلاعات تجاری فروشگاه است.
                    */}
                    {!product.in_stock && (
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-2xs font-bold text-muted-foreground">
                        ناموجود
                      </span>
                    )}
                  </div>

                  {product.category && (
                    <span className="mt-1 text-2xs text-muted-foreground">{product.category}</span>
                  )}

                  {/*
                    قیمت فقط وقتی می‌آید که فروشگاه اجازه داده باشد.
                    تصمیمش در دیتابیس گرفته شده (تابع NULL برمی‌گرداند)،
                    پس این شرط لایه‌ی دوم است نه تنها لایه.
                  */}
                  {shop.show_prices && product.price != null && (
                    <div className="mt-3 text-sm font-black tabular-nums text-primary">
                      {formatToman(product.price)}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {products.length >= STOREFRONT_PRODUCT_LIMIT && (
            <p className="mt-4 text-center text-2xs text-muted-foreground">
              برای دیدن بقیه‌ی محصولات تماس بگیرید.
            </p>
          )}
        </section>
      </main>

      <footer className="border-t border-border py-6">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-2xs text-muted-foreground transition hover:text-primary"
          >
            <Receipt size={13} aria-hidden />
            ساخته‌شده با {BRAND_NAME}
          </Link>
        </div>
      </footer>
    </div>
  );
}
