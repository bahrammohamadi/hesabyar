import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";
import { serviceClient } from "@/lib/security/api-guard";

/**
 * ثبت و ارسال پوش دستگاه.
 *
 * ⚠️ `route.ts` فقط export نام‌های شناخته‌شده می‌پذیرد
 * (GET/POST/PUT/DELETE/dynamic/runtime/…). هر export دیگر باعث
 * می‌شود `next build` بشکند در حالی که `tsc` تمیز رد می‌شود — یک بار
 * این تله را خورده‌ایم.
 */

export const dynamic = "force-dynamic";

/** پیکربندی VAPID. اگر کلیدها نباشند، ارسال پوش بی‌صدا غیرفعال می‌شود. */
function configureWebPush(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:support@hesabyar.app";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  return true;
}

/**
 * ثبت اشتراک دستگاه.
 *
 * `endpoint` کلید یکتای طبیعی است؛ همان دستگاه اگر دوباره اجازه
 * بدهد، ردیف قبلی به‌روز می‌شود نه ردیف دوم.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    orgId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const sub = body.subscription;
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return NextResponse.json({ error: "اشتراک ناقص است" }, { status: 400 });
  }

  const admin = serviceClient();
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      user_id: auth.user.id,
      org_id: body.orgId ?? null,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      user_agent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
      last_used_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );

  /*
    ⚠️ کلاینت Supabase برای خطای دیتابیس استثنا پرتاب نمی‌کند؛ خطا در
    `error` است. try/catch اینجا بی‌فایده بود.
  */
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/** لغو اشتراک این دستگاه. */
export async function DELETE(req: NextRequest) {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const endpoint = req.nextUrl.searchParams.get("endpoint");
  if (!endpoint) return NextResponse.json({ error: "endpoint لازم است" }, { status: 400 });

  const admin = serviceClient();
  await admin
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    // فقط اشتراک خودِ کاربر؛ endpoint دیگری را نباید بتواند حذف کند.
    .eq("user_id", auth.user.id);

  return NextResponse.json({ ok: true });
}

/**
 * ارسال پوش آزمایشی به دستگاه‌های همین کاربر.
 *
 * چرا فقط آزمایشی و نه ارسال گروهی؟ ارسال واقعی باید از یک زمان‌بند
 * سمت سرور بیاید، نه از درخواست کاربر — وگرنه هر کسی می‌تواند به
 * همکارانش پوش بفرستد.
 */
export async function PUT() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!configureWebPush()) {
    return NextResponse.json({ error: "کلیدهای پوش تنظیم نشده‌اند" }, { status: 503 });
  }

  const admin = serviceClient();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", auth.user.id);

  if (!subs || subs.length === 0) {
    return NextResponse.json({ error: "هیچ دستگاهی ثبت نشده" }, { status: 404 });
  }

  const payload = JSON.stringify({
    title: "ترازو",
    body: "اعلان آزمایشی — همه‌چیز درست کار می‌کند.",
    url: "/dashboard",
  });

  let sent = 0;
  const dead: string[] = [];

  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload
      );
      sent += 1;
    } catch (e) {
      /*
        ۴۰۴ و ۴۱۰ یعنی اشتراک مرده است (کاربر اپ را حذف کرده یا
        اجازه را برداشته). نگه‌داشتنشان یعنی هر بار ارسال، چند خطای
        بی‌فایده. پاکشان می‌کنیم.
      */
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) dead.push(s.endpoint);
    }
  }

  if (dead.length > 0) {
    await admin.from("push_subscriptions").delete().in("endpoint", dead);
  }

  return NextResponse.json({ ok: true, sent, removed: dead.length });
}
