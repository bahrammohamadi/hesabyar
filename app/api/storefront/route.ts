import { NextResponse } from "next/server";
import { requireMember, serviceClient, safeError, readJsonBody } from "@/lib/security/api-guard";
import { hit, clientIp, tooManyRequests } from "@/lib/security/rate-limit";
import {
  validateSlug, normalizeInstagram, normalizeTelegram, normalizeWhatsapp,
} from "@/lib/storefront";

export const dynamic = "force-dynamic";

/** طول بیشینه‌ی هر فیلد متنی — جلوگیری از پرکردن جدول با متن چندمگابایتی. */
const LIMITS = {
  title: 80, tagline: 120, about: 2000, address: 300,
  phone: 30, instagram: 60, telegram: 60, whatsapp: 30, hours: 120,
} as const;

const clip = (raw: unknown, max: number): string | null => {
  if (typeof raw !== "string") return null;
  const value = raw.trim().slice(0, max);
  return value.length > 0 ? value : null;
};

/** تنظیمات فعلی ویترین کسب‌وکار. */
export async function GET(request: Request) {
  try {
    const rl = hit(`storefront-get:${clientIp(request)}`, { limit: 60, windowSeconds: 60 });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const auth = await requireMember(null, "settings.manage");
    if ("response" in auth) return auth.response;
    const { membership } = auth.ctx;

    const svc = serviceClient();
    const { data, error } = await svc
      .from("storefronts")
      .select("*")
      .eq("org_id", membership.org_id)
      .maybeSingle();
    if (error) throw error;

    const { data: org } = await svc
      .from("organizations")
      .select("name")
      .eq("id", membership.org_id)
      .maybeSingle();

    return NextResponse.json({ storefront: data, orgName: org?.name ?? null });
  } catch (error) {
    return safeError("storefront:GET", error, 500, request);
  }
}

/**
 * ذخیره یا به‌روزرسانی ویترین.
 *
 * چرا `settings.manage`؟ انتشار عمومی نام، آدرس و فهرست کالاها
 * تصمیمی در سطح کسب‌وکار است، نه کاری که یک صندوق‌دار باید بتواند
 * انجام دهد.
 */
export async function PUT(request: Request) {
  try {
    const rl = hit(`storefront-put:${clientIp(request)}`, {
      limit: 20, windowSeconds: 60, blockSeconds: 120,
    });
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const auth = await requireMember(null, "settings.manage");
    if ("response" in auth) return auth.response;
    const { membership } = auth.ctx;

    const parsed = await readJsonBody<Record<string, unknown>>(request);
    if ("response" in parsed) return parsed.response;
    const body = parsed.data;

    const slug = String(body.slug ?? "").trim().toLowerCase();
    const check = validateSlug(slug);
    if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 400 });

    const title = clip(body.title, LIMITS.title);
    if (!title) return NextResponse.json({ error: "عنوان فروشگاه الزامی است." }, { status: 400 });

    const svc = serviceClient();

    /*
      نشانی نباید مال کسب‌وکار دیگری باشد.

      قید unique در دیتابیس هم هست، ولی بررسی اینجا پیام فارسی
      قابل‌فهم می‌دهد به‌جای خطای خام ۲۳۵۰۵.
    */
    const { data: available } = await svc.rpc("is_storefront_slug_available", {
      p_slug: slug,
      p_org: membership.org_id,
    });
    if (available !== true) {
      return NextResponse.json(
        { error: "این نشانی قبلاً توسط کسب‌وکار دیگری گرفته شده است." },
        { status: 409 }
      );
    }

    const isPublished = body.is_published === true;

    const payload = {
      org_id: membership.org_id,
      slug,
      title,
      tagline: clip(body.tagline, LIMITS.tagline),
      about: clip(body.about, LIMITS.about),
      address: clip(body.address, LIMITS.address),
      phone: clip(body.phone, LIMITS.phone),
      // نرمال‌سازی: کاربر ممکن است آدرس کامل یا @ بنویسد.
      instagram: normalizeInstagram(clip(body.instagram, LIMITS.instagram)),
      telegram: normalizeTelegram(clip(body.telegram, LIMITS.telegram)),
      whatsapp: normalizeWhatsapp(clip(body.whatsapp, LIMITS.whatsapp)),
      hours: clip(body.hours, LIMITS.hours),
      show_prices: body.show_prices === true,
      is_published: isPublished,
      published_at: isPublished ? new Date().toISOString() : null,
    };

    const { data, error } = await svc
      .from("storefronts")
      .upsert(payload, { onConflict: "org_id" })
      .select()
      .maybeSingle();

    if (error) {
      // قید قالب slug در دیتابیس — نباید به اینجا برسد ولی محکم‌کاری.
      if (error.code === "23514") {
        return NextResponse.json({ error: "قالب نشانی نامعتبر است." }, { status: 400 });
      }
      if (error.code === "23505") {
        return NextResponse.json({ error: "این نشانی قبلاً گرفته شده است." }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ storefront: data });
  } catch (error) {
    return safeError("storefront:PUT", error, 500, request);
  }
}
