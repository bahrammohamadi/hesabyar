"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/**
 * آیا کاربر جاری سوپرادمین پلتفرم است؟
 *
 * چرا یک هوک جدا و نه استفاده از usePermission؟
 *   نقش سوپرادمین «فرا-سازمانی» است و در memberships/permissions نیست
 *   (migration 0021 عمداً جدول جدا ساخت تا مدل RLS سازمان‌ها خراب نشود).
 *   پس usePermission که بر پایه‌ی نقشِ عضویت کار می‌کند هرگز آن را
 *   تشخیص نمی‌دهد.
 *
 * چرا RPC و نه select مستقیم از platform_admins؟
 *   جدول RLS دارد و policy آن خودش is_platform_admin() را صدا می‌زند؛
 *   برای کاربر غیرادمین آرایه‌ی خالی برمی‌گردد که از «خطا» قابل تفکیک
 *   نیست. تابع security definer پاسخ قطعی true/false می‌دهد.
 *
 * ⚠️ این فقط برای *نمایش* در UI است، نه کنترل دسترسی. گارد واقعی در
 *    سه لایه‌ی دیگر است: layout سرور، requirePlatformAdmin در API، و
 *    خود RPCهای approve/reject در دیتابیس.
 */
export function usePlatformAdmin(): { isPlatformAdmin: boolean; loading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ["is-platform-admin"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("is_platform_admin");
      /*
        اگر migration 0021 روی این دیتابیس اجرا نشده باشد تابع وجود ندارد
        و خطا برمی‌گردد. در آن حالت «نه» فرض می‌کنیم تا فقط آیتم منو پنهان
        شود و بقیه‌ی اپ از کار نیفتد.
      */
      if (error) return false;
      return Boolean(data);
    },
    // نقش پلتفرمی به‌ندرت عوض می‌شود؛ در هر ناوبری دوباره پرسیده نشود.
    staleTime: 5 * 60_000,
    retry: false,
  });

  return { isPlatformAdmin: data === true, loading: isLoading };
}
