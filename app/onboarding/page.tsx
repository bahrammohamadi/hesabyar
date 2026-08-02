"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Store, User, Phone, Sparkles } from "lucide-react";
import { BRAND_NAME } from "@/lib/brand";
import { BUSINESS_TYPES } from "@/lib/business-types";
import { normalizeIranMobile, toFaDigits } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/**
 * فرم معارفه — بعد از ثبت‌نام، قبل از ورود به پنل.
 *
 * چرا بعد از ثبت‌نام و نه داخل آن؟
 *   هر فیلد اضافه در فرم ثبت‌نام نرخ تکمیل را پایین می‌آورد. اینجا
 *   کاربر از قبل حساب دارد؛ حتی اگر فرم را رها کند، حسابش باقی است
 *   و دفعه‌ی بعد همین‌جا ادامه می‌دهد.
 *
 * چرا بیرون از گروه (app)؟
 *   هنوز سازمانی وجود ندارد، پس AppShell (که سایدبار و منو دارد)
 *   بی‌معنا است و layout سازمان هم کاربر را به /setup می‌فرستد.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  const [orgName, setOrgName] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [businessType, setBusinessType] = useState<string>("");

  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  /*
    اگر کاربر از قبل سازمان دارد و معارفه‌اش تمام شده، اینجا کاری
    ندارد. بدون این بررسی، رفرش‌کردن صفحه بعد از تکمیل، فرم خالی را
    دوباره نشان می‌داد.
  */
  useEffect(() => {
    let alive = true;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data: rows } = await supabase
        .from("memberships")
        .select("org_id")
        .eq("is_active", true)
        .limit(1);

      const orgId = rows?.[0]?.org_id;
      if (orgId) {
        const { data: org } = await supabase
          .from("organizations")
          .select("name, onboarded_at")
          .eq("id", orgId)
          .maybeSingle();

        if (org?.onboarded_at) {
          router.replace("/dashboard");
          return;
        }
        // سازمان هست ولی معارفه ناقص — نامش را پیش‌فرض بگذار
        if (org?.name && alive) setOrgName(org.name);
      }
      if (alive) setChecking(false);
    })();
    return () => { alive = false; };
  }, [router]);

  function validate() {
    const errs: Record<string, string> = {};
    if (!orgName.trim()) errs.orgName = "نام کسب‌وکار را وارد کنید";
    if (!fullName.trim()) errs.fullName = "نام و نام خانوادگی را وارد کنید";
    if (!normalizeIranMobile(phone)) errs.phone = "شماره موبایل معتبر نیست (مثال: ۰۹۱۲۳۴۵۶۷۸۹)";
    if (!businessType) errs.businessType = "نوع کسب‌وکار را انتخاب کنید";
    setFieldError(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!validate()) return;

    setLoading(true);
    const supabase = createClient();
    const normalized = normalizeIranMobile(phone)!;

    /*
      دو مسیر: اگر سازمان هنوز ساخته نشده bootstrap_org، وگرنه
      complete_onboarding. هر دو در دیتابیس idempotent‌اند.
    */
    const { data: rows } = await supabase
      .from("memberships")
      .select("org_id")
      .eq("is_active", true)
      .limit(1);

    const hasOrg = Boolean(rows?.[0]?.org_id);

    const { error: rpcError } = hasOrg
      ? await supabase.rpc("complete_onboarding", {
          p_business_type: businessType,
          p_owner_full_name: fullName.trim(),
          p_owner_phone: normalized,
          p_org_name: orgName.trim(),
        })
      : await supabase.rpc("bootstrap_org", {
          p_org_name: orgName.trim(),
          p_business_type: businessType,
          p_owner_full_name: fullName.trim(),
          p_owner_phone: normalized,
        });

    if (rpcError) {
      setError("خطا در ثبت اطلاعات. لطفاً دوباره تلاش کنید.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={28} />
        <span className="sr-only">در حال بارگذاری</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 text-center sm:mb-8">
          <img
            src="/logo.png"
            alt={BRAND_NAME}
            className="mx-auto mb-3 h-16 w-16 object-contain sm:h-20 sm:w-20"
          />
          <h1 className="text-xl font-extrabold text-foreground sm:text-2xl">
            به {BRAND_NAME} خوش آمدید
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            چند اطلاعات کوتاه تا پنل شما آماده شود
          </p>

          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-success-soft px-4 py-2 text-xs font-bold text-success-onSoft">
            <Sparkles size={14} aria-hidden />
            {toFaDigits(14)} روز استفاده‌ی رایگان — بدون نیاز به پرداخت
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
          {/* نوع کسب‌وکار — اول می‌آید چون بصری است و کاربر را درگیر می‌کند */}
          <fieldset>
            <legend className="mb-2.5 flex items-center gap-2 text-sm font-bold text-foreground">
              <Store size={16} className="text-primary" aria-hidden />
              نوع کسب‌وکار شما چیست؟
            </legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {BUSINESS_TYPES.map((type) => {
                const selected = businessType === type.id;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setBusinessType(type.id)}
                    aria-pressed={selected}
                    className={cn(
                      "flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border p-2.5 text-center transition",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                      selected
                        ? "border-primary bg-primary/10 font-bold text-primary"
                        : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-muted"
                    )}
                  >
                    <span className="text-xl leading-none" aria-hidden>{type.emoji}</span>
                    <span className="text-2xs leading-tight sm:text-xs">{type.label}</span>
                  </button>
                );
              })}
            </div>
            {fieldError.businessType && (
              <p role="alert" className="mt-2 text-xs font-bold text-destructive-text">
                {fieldError.businessType}
              </p>
            )}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ob-org" className="mb-1.5 block text-sm font-bold text-foreground">
                نام کسب‌وکار
              </label>
              <input
                id="ob-org"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="مثلاً: پوشاک آرام"
                aria-invalid={Boolean(fieldError.orgName)}
                className="min-h-11 w-full rounded-xl border border-border bg-card px-3.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              {fieldError.orgName && (
                <p role="alert" className="mt-1.5 text-xs font-bold text-destructive-text">{fieldError.orgName}</p>
              )}
            </div>

            <div>
              <label htmlFor="ob-name" className="mb-1.5 flex items-center gap-1.5 text-sm font-bold text-foreground">
                <User size={14} className="text-muted-foreground" aria-hidden />
                نام و نام خانوادگی
              </label>
              <input
                id="ob-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="مثلاً: مریم رضایی"
                aria-invalid={Boolean(fieldError.fullName)}
                className="min-h-11 w-full rounded-xl border border-border bg-card px-3.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              {fieldError.fullName && (
                <p role="alert" className="mt-1.5 text-xs font-bold text-destructive-text">{fieldError.fullName}</p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="ob-phone" className="mb-1.5 flex items-center gap-1.5 text-sm font-bold text-foreground">
              <Phone size={14} className="text-muted-foreground" aria-hidden />
              شماره تماس
            </label>
            <input
              id="ob-phone"
              inputMode="tel"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09123456789"
              aria-invalid={Boolean(fieldError.phone)}
              aria-describedby="ob-phone-hint"
              className="min-h-11 w-full rounded-xl border border-border bg-card px-3.5 text-left text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <p id="ob-phone-hint" className="mt-1.5 text-2xs text-muted-foreground">
              برای پشتیبانی و بازیابی حساب استفاده می‌شود. ارقام فارسی هم پذیرفته می‌شود.
            </p>
            {fieldError.phone && (
              <p role="alert" className="mt-1 text-xs font-bold text-destructive-text">{fieldError.phone}</p>
            )}
          </div>

          {error && (
            <div role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive-text">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-extrabold text-primary-foreground transition hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading && <Loader2 className="animate-spin" size={18} aria-hidden />}
            ورود به پنل
          </button>
        </form>
      </div>
    </div>
  );
}
