"use client";

import { createBrowserClient } from "@supabase/ssr";

/** کلاینت Supabase برای استفاده در کامپوننت‌های سمت مرورگر */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
