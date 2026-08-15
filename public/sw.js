/*
 * Service Worker — ترازو
 *
 * 🔴 چرا لازم است: بدون سرویس‌ورکر، کروم دکمه‌ی «نصب برنامه» را
 * نشان نمی‌دهد. مانیفست و آیکون‌ها از قبل آماده بودند ولی هیچ
 * سرویس‌ورکری وجود نداشت و هیچ‌جا هم ثبت نمی‌شد، پس اپ عملاً
 * قابل نصب نبود.
 *
 * ⚠️ فلسفه‌ی این فایل: **محافظه‌کارانه‌ترین کش ممکن.**
 *
 *   این یک نرم‌افزار حسابداری است. نمایش داده‌ی کهنه — موجودی
 *   قدیمی، فاکتور پاک‌شده، قیمت قبلی — از نمایش خطای شبکه
 *   *بسیار* خطرناک‌تر است. کاربری که موجودی کهنه ببیند ممکن است
 *   کالایی را بفروشد که ندارد.
 *
 *   پس:
 *     • هیچ پاسخ API هرگز کش نمی‌شود
 *     • هیچ صفحه‌ی HTML کش نمی‌شود
 *     • فقط دارایی‌های ثابت و نسخه‌دار (_next/static) کش می‌شوند،
 *       که نامشان هش دارد و هرگز تغییر محتوا نمی‌دهند
 *     • یک صفحه‌ی آفلاین ساده برای وقتی شبکه نیست
 */

const VERSION = "v1";
const STATIC_CACHE = `tarazoo-static-${VERSION}`;
const OFFLINE_URL = "/offline.html";

/*
  فقط پوسته‌ی آفلاین از پیش کش می‌شود.
  کش‌کردن صفحات واقعی در نصب یعنی همان لحظه‌ی نصب، عکس فوری از
  داده گرفته می‌شود و روزها بعد همان را نشان می‌دهیم.
*/
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      // نصب نباید به‌خاطر یک فایل غایب شکست بخورد.
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            // کش نسخه‌های قبلی پاک می‌شود، وگرنه فضای مرورگر بی‌نهایت رشد می‌کند.
            .filter((key) => key.startsWith("tarazoo-") && key !== STATIC_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // فقط GET. POST/PATCH/DELETE هرگز نباید از کش بیایند.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // درخواست به دامنه‌ی دیگر (Supabase، API قیمت) دست‌نخورده رد می‌شود.
  if (url.origin !== self.location.origin) return;

  /*
    🔴 هیچ‌چیز زیر /api کش نمی‌شود.

    داده‌ی حسابداری باید همیشه تازه باشد. ضمناً پاسخ‌های API
    مخصوص کاربر واردشده‌اند؛ کش‌کردنشان یعنی اگر روی یک دستگاه
    مشترک کاربر عوض شود، ممکن است داده‌ی نفر قبلی دیده شود.
  */
  if (url.pathname.startsWith("/api/")) return;

  /*
    دارایی‌های ثابت نسخه‌دار: cache-first.

    نام فایل‌های _next/static هش محتوا دارد، پس اگر محتوا عوض شود
    نام هم عوض می‌شود. یعنی کش کهنه از نظر منطقی ممکن نیست.
  */
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
            }
            return response;
          })
      )
    );
    return;
  }

  /*
    ناوبری صفحه: network-only با صفحه‌ی آفلاین به‌عنوان پشتیبان.

    عمداً network-first با کش نیست: اگر HTML را کش کنیم، کاربر
    ممکن است نسخه‌ای از صفحه را ببیند که به chunkهای جاوااسکریپتِ
    حذف‌شده اشاره می‌کند و صفحه سفید شود.
  */
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
  }
});

/*
  پیام از صفحه برای فعال‌سازی فوری نسخه‌ی تازه.
  UpdatePrompt وقتی کاربر «به‌روزرسانی» را می‌زند این را می‌فرستد.
*/
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

/* ================================================================== */
/* پوش دستگاه                                                          */
/* ================================================================== */

/*
  دریافت پوش و نمایش اعلان سیستمی.

  ⚠️ `event.waitUntil` اجباری است. بدون آن مرورگر ممکن است
  سرویس‌ورکر را پیش از نمایش اعلان بخواباند و پیام گم شود — یا بدتر،
  کروم اعلان پیش‌فرض «This site has been updated in the background»
  را نشان می‌دهد که کاملاً بی‌ربط است.
*/
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // payload خراب نباید کل اعلان را از بین ببرد.
    data = { title: "ترازو", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "ترازو";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    dir: "rtl",
    lang: "fa",
    // مسیر مقصد را همراه اعلان نگه می‌داریم تا کلیک بداند کجا برود.
    data: { url: data.url || "/dashboard" },
    /*
      tag یعنی اعلان جدید جای قبلی را می‌گیرد به‌جای انباشتن.
      برای یادآوری روزانه‌ی چک، ده اعلان یکسان در مرکز اعلان گوشی
      همان کاری را می‌کند که با زنگوله کردیم: کاربر نادیده می‌گیرد.
    */
    tag: data.tag || "tarazoo-notification",
    renotify: Boolean(data.tag),
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/*
  کلیک روی اعلان.

  اگر پنجره‌ای از برنامه باز است، همان را جلو می‌آوریم و مسیر را عوض
  می‌کنیم؛ باز کردن تب دوم برای کاربری که برنامه را باز دارد آزاردهنده
  است.
*/
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/dashboard";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
